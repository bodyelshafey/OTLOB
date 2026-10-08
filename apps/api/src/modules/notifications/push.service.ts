import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../prisma/prisma.service';

interface DeliveryRow {
  token: string;
  ticketId: string | null;
  status: 'SENT' | 'FAILED' | 'INVALID_TOKEN';
  errorMessage: string | null;
}

// Wraps expo-server-sdk: sends to every token a user has registered (they
// may be logged in on more than one device), tracks a PushDelivery row per
// (token, send attempt) so delivery status is actually visible later, and
// prunes tokens Expo tells us are no longer valid — otherwise every future
// send keeps retrying a dead token forever.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private expo = new Expo();

  constructor(private prisma: PrismaService) {}

  // Returns the ticket ids worth checking receipts for later — the caller
  // (the notifications processor, which already has JobsService) schedules
  // the delayed receipt-check job. PushService intentionally doesn't depend
  // on JobsService itself, to avoid a circular module dependency between
  // the jobs and notifications modules.
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return { ticketIds: [] as string[] };
    return this.sendToTokens(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    );
  }

  async sendToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
    if (userIds.length === 0) return { ticketIds: [] as string[] };
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
    if (tokens.length === 0) return { ticketIds: [] as string[] };
    return this.sendToTokens(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    );
  }

  private async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<{ ticketIds: string[] }> {
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) return { ticketIds: [] };

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }));
    const chunks = this.expo.chunkPushNotifications(messages);

    const deadTokens: string[] = [];
    const rows: DeliveryRow[] = [];

    for (const chunk of chunks) {
      // Keep the token list for THIS chunk explicitly, rather than relying
      // on a flat index into the full token list — a previous version of
      // this used a shared counter across chunks, which silently
      // misaligned token-to-ticket mapping the moment any earlier chunk
      // failed to send (fewer tickets than tokens from that point on).
      const chunkTokens = chunk.map((m) => m.to as string);
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          const token = chunkTokens[i];
          if (ticket.status === 'error') {
            const isDeadToken = ticket.details?.error === 'DeviceNotRegistered';
            if (isDeadToken) deadTokens.push(token);
            rows.push({
              token,
              ticketId: null,
              status: isDeadToken ? 'INVALID_TOKEN' : 'FAILED',
              errorMessage: ticket.message ?? ticket.details?.error ?? 'Unknown error',
            });
          } else {
            rows.push({ token, ticketId: ticket.id, status: 'SENT', errorMessage: null });
          }
        });
      } catch (err) {
        // The whole chunk failed to reach Expo (network/outage) — every
        // token in it gets a FAILED row rather than being silently
        // dropped from tracking.
        this.logger.warn(`Failed to send a push notification chunk: ${(err as Error).message}`);
        chunkTokens.forEach((token) =>
          rows.push({ token, ticketId: null, status: 'FAILED', errorMessage: (err as Error).message }),
        );
      }
    }

    if (deadTokens.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
    }
    if (rows.length > 0) {
      await this.prisma.pushDelivery.createMany({ data: rows });
    }

    return { ticketIds: rows.filter((r) => r.ticketId).map((r) => r.ticketId as string) };
  }

  // Expo recommends checking receipts at least 15 minutes after sending —
  // the job that calls this is scheduled with that delay. Guards on
  // status === 'SENT' make this idempotent: a receipt-check retry (from
  // BullMQ, after a transient failure) or a duplicate ticket id in a
  // batch never double-processes a delivery that was already resolved.
  async checkReceipts(ticketIds: string[]) {
    if (ticketIds.length === 0) return;
    const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);

    for (const chunk of receiptIdChunks) {
      try {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
        const chunkTicketIds = Object.keys(receipts);
        if (chunkTicketIds.length === 0) continue;

        // One query for the whole chunk (up to ~100 receipts), not one
        // per receipt — a per-ticket findFirst here would be a real N+1
        // against a job that can legitimately process a full Expo chunk
        // at once.
        const deliveries = await this.prisma.pushDelivery.findMany({
          where: { ticketId: { in: chunkTicketIds }, status: 'SENT' },
        });
        const deliveryByTicketId = new Map(deliveries.map((d) => [d.ticketId as string, d]));

        const deliveredIds: string[] = [];
        const failedUpdates: { id: string; status: string; errorMessage: string }[] = [];
        const deadTokens: string[] = [];

        for (const ticketId of chunkTicketIds) {
          const delivery = deliveryByTicketId.get(ticketId);
          if (!delivery) continue; // already processed, or not one of ours

          const receipt = receipts[ticketId];
          if (receipt.status === 'ok') {
            deliveredIds.push(delivery.id);
          } else {
            const isDeadToken = receipt.details?.error === 'DeviceNotRegistered';
            failedUpdates.push({
              id: delivery.id,
              status: isDeadToken ? 'INVALID_TOKEN' : 'FAILED',
              errorMessage: receipt.message ?? receipt.details?.error ?? 'Unknown error',
            });
            if (isDeadToken) deadTokens.push(delivery.token);
          }
        }

        // Successes share one status, so they can share one updateMany.
        // Failures don't (different error messages), so those stay
        // per-row — but that's now bounded by actual failures in this
        // chunk, not every receipt in it.
        if (deliveredIds.length > 0) {
          await this.prisma.pushDelivery.updateMany({
            where: { id: { in: deliveredIds } },
            data: { status: 'DELIVERED', checkedAt: new Date() },
          });
        }
        for (const update of failedUpdates) {
          await this.prisma.pushDelivery.update({
            where: { id: update.id },
            data: { status: update.status, errorMessage: update.errorMessage, checkedAt: new Date() },
          });
        }
        if (deadTokens.length > 0) {
          await this.prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
        }
      } catch (err) {
        // Transient failure fetching receipts from Expo — the enclosing
        // BullMQ job already has attempts/backoff for exactly this case;
        // log and let the job retry rather than swallowing it here.
        this.logger.warn(`Failed to check push receipts: ${(err as Error).message}`);
        throw err;
      }
    }
  }
}

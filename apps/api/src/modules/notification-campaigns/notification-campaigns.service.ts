import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { resolveCampaignTargetUserIds } from '../../common/notification-targeting';
import { CreateNotificationCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class NotificationCampaignsService {
  constructor(
    private prisma: PrismaService,
    private jobsService: JobsService,
  ) {}

  findAll() {
    return this.prisma.notificationCampaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.notificationCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(createdBy: string, dto: CreateNotificationCampaignDto) {
    this.validateTargeting(dto);

    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title: dto.title,
        bodyAr: dto.bodyAr,
        bodyEn: dto.bodyEn,
        type: dto.type ?? 'PROMO',
        targetType: dto.targetType,
        targetRole: dto.targetRole,
        targetUserId: dto.targetUserId,
        targetStoreId: dto.targetStoreId,
        status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        createdBy,
      },
    });

    if (dto.scheduledAt) {
      await this.jobsService.scheduleCampaign(campaign.id, new Date(dto.scheduledAt));
    }

    return campaign;
  }

  async update(id: string, dto: Partial<CreateNotificationCampaignDto>) {
    const campaign = await this.findOne(id);
    if (campaign.status === 'SENT') {
      throw new BadRequestException('This campaign has already been sent and can no longer be edited');
    }
    if (Object.keys(dto).some((k) => k !== 'scheduledAt')) {
      this.validateTargeting({ ...campaign, ...dto } as CreateNotificationCampaignDto);
    }

    const updated = await this.prisma.notificationCampaign.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: dto.scheduledAt ? 'SCHEDULED' : campaign.status,
      },
    });

    if (dto.scheduledAt) {
      await this.jobsService.scheduleCampaign(id, new Date(dto.scheduledAt));
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.notificationCampaign.delete({ where: { id } });
  }

  // Sends immediately regardless of any scheduledAt — used for the "send
  // now" action. A campaign can only be sent once; SENT is terminal.
  async sendNow(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status === 'SENT') {
      throw new BadRequestException('This campaign has already been sent');
    }

    const userIds = await resolveCampaignTargetUserIds(this.prisma, campaign);

    await this.jobsService.queueBulkNotification({
      userIds,
      titleAr: campaign.title,
      titleEn: campaign.title,
      bodyAr: campaign.bodyAr,
      bodyEn: campaign.bodyEn ?? undefined,
      type: campaign.type,
      data: { campaignId: campaign.id },
    });

    return this.prisma.notificationCampaign.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: userIds.length },
    });
  }

  // Cheap preview so the admin UI can show "this will reach ~N people"
  // before actually sending.
  async previewAudienceSize(dto: Pick<CreateNotificationCampaignDto, 'targetType' | 'targetRole' | 'targetUserId' | 'targetStoreId'>) {
    const userIds = await resolveCampaignTargetUserIds(this.prisma, dto);
    return { count: userIds.length };
  }

  private validateTargeting(dto: Pick<CreateNotificationCampaignDto, 'targetType' | 'targetRole' | 'targetUserId' | 'targetStoreId'>) {
    if (dto.targetType === 'ROLE' && !dto.targetRole) {
      throw new BadRequestException('targetRole is required when targetType is ROLE');
    }
    if (dto.targetType === 'USER' && !dto.targetUserId) {
      throw new BadRequestException('targetUserId is required when targetType is USER');
    }
    if (dto.targetType === 'STORE_CUSTOMERS' && !dto.targetStoreId) {
      throw new BadRequestException('targetStoreId is required when targetType is STORE_CUSTOMERS');
    }
  }
}

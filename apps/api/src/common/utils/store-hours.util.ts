// Shared by StoresService (to show "closed now" on the storefront) and
// OrdersService (to actually block checkout) — one place computes "is this
// store open right now" so the two can never disagree.

export interface WorkingHourLike {
  dayOfWeek: number; // 0-6, Sunday = 0 (matches Prisma schema comment)
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  isClosed: boolean;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h % 24) * 60 + (m % 60);
}

// A store with no working_hours rows at all has never configured them —
// treat that as "hours not restricted" so existing stores keep working
// exactly as before this feature existed. Only once an owner actually sets
// hours does the schedule get enforced.
export function isStoreOpenNow(
  manuallyOpen: boolean,
  hours: WorkingHourLike[],
  now: Date = new Date(),
): boolean {
  if (!manuallyOpen) return false;
  if (hours.length === 0) return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;

  const todayRow = hours.find((h) => h.dayOfWeek === today);
  if (todayRow && !todayRow.isClosed) {
    const open = toMinutes(todayRow.openTime);
    const close = toMinutes(todayRow.closeTime);
    if (close > open) {
      // Normal same-day window, e.g. 09:00–23:00.
      if (nowMinutes >= open && nowMinutes < close) return true;
    }
    // close <= open means this window crosses midnight (e.g. 20:00–02:00);
    // the part of it that falls on "today" is [open, 24:00).
    else if (nowMinutes >= open) {
      return true;
    }
  }

  // The tail end of yesterday's overnight window can still be open right
  // now (e.g. yesterday 20:00–02:00 is still "open" at today 01:00).
  const yesterdayRow = hours.find((h) => h.dayOfWeek === yesterday);
  if (yesterdayRow && !yesterdayRow.isClosed) {
    const open = toMinutes(yesterdayRow.openTime);
    const close = toMinutes(yesterdayRow.closeTime);
    if (close <= open && nowMinutes < close) return true;
  }

  return false;
}

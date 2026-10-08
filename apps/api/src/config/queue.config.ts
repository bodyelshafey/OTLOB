// Centralizes BullMQ worker concurrency so it's read from env vars in one
// place, not scattered as magic numbers across processor files.
//
// Chosen defaults (deliberately conservative — controlled parallelism,
// not maximum parallelism):
//
// - Notifications: 5. Each job does 1-2 lightweight DB writes plus an Expo
//   push send (which the SDK already internally batches into chunks of
//   100 recipients). 5 concurrent jobs is enough to stop notification
//   delivery lagging behind order creation during a burst, without
//   meaningfully competing with live user request traffic for the shared
//   10-connection Postgres pool.
// - Reports: 2. Daily store-report generation runs aggregation queries
//   (heavier than a simple write) and is deduped per store+day, so there's
//   no latency pressure to parallelize it aggressively — keeping this low
//   protects the DB pool from several expensive aggregations running at
//   once during a burst of order completions.
// - Delivery automation: 1. Only one scan job is ever in flight at a time
//   (it's a repeatable job with a stable jobId, not bursty like the other
//   two), and each run already loops over its own candidates internally —
//   no benefit to parallelizing multiple concurrent SCANS of the same
//   query.
//
// Override via NOTIFICATIONS_QUEUE_CONCURRENCY / REPORTS_QUEUE_CONCURRENCY /
// DELIVERY_AUTOMATION_QUEUE_CONCURRENCY if load testing shows a different
// value is actually justified.
function readConcurrency(envVar: string, fallback: number): number {
  const raw = Number(process.env[envVar]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const QUEUE_CONCURRENCY = {
  notifications: readConcurrency('NOTIFICATIONS_QUEUE_CONCURRENCY', 5),
  reports: readConcurrency('REPORTS_QUEUE_CONCURRENCY', 2),
  deliveryAutomation: readConcurrency('DELIVERY_AUTOMATION_QUEUE_CONCURRENCY', 1),
};

/**
 * Serial outbound email queue — at most one send every GAP_MS.
 * Shared across booking notifications and client broadcasts so SMTP
 * hosts aren't hammered.
 */

const GAP_MS = 30_000;

type Job = {
  run: () => Promise<void>;
  resolve: () => void;
  reject: (err: unknown) => void;
};

const g = globalThis as unknown as {
  _emailQueue?: Job[];
  _emailQueueRunning?: boolean;
  _emailLastSentAt?: number;
};

function queue(): Job[] {
  if (!g._emailQueue) g._emailQueue = [];
  return g._emailQueue;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function drain(): Promise<void> {
  if (g._emailQueueRunning) return;
  g._emailQueueRunning = true;
  try {
    while (queue().length > 0) {
      const last = g._emailLastSentAt ?? 0;
      const wait = Math.max(0, GAP_MS - (Date.now() - last));
      if (wait > 0) await sleep(wait);
      const job = queue().shift();
      if (!job) break;
      try {
        await job.run();
        g._emailLastSentAt = Date.now();
        job.resolve();
      } catch (err) {
        g._emailLastSentAt = Date.now();
        job.reject(err);
      }
    }
  } finally {
    g._emailQueueRunning = false;
    // A job may have been enqueued while we were finishing.
    if (queue().length > 0) void drain();
  }
}

/** Enqueue work; resolves when this job has actually run (after prior gaps). */
export function enqueueEmail(run: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    queue().push({ run, resolve, reject });
    void drain();
  });
}

/** Fire-and-forget enqueue (doesn't await send completion). */
export function enqueueEmailDetached(run: () => Promise<void>): void {
  queue().push({
    run,
    resolve: () => {},
    reject: () => {},
  });
  void drain();
}

export function emailQueueDepth(): number {
  return queue().length;
}

export function emailQueueBusy(): boolean {
  return Boolean(g._emailQueueRunning) || queue().length > 0;
}

export function emailQueueGapSeconds(): number {
  return GAP_MS / 1000;
}

/** Rough ETA for the current queue (seconds until last job starts). */
export function emailQueueEtaSeconds(): number {
  const pending = queue().length;
  if (pending <= 0) return 0;
  const sinceLast = Date.now() - (g._emailLastSentAt ?? 0);
  const firstWait = Math.max(0, GAP_MS - sinceLast);
  return Math.ceil((firstWait + (pending - 1) * GAP_MS) / 1000);
}

export const EMAIL_CONFIG = {
  smtp: {
    timeoutMs: 15000,
    connectionTimeoutMs: 15000,
    greetingTimeoutMs: 15000,
  },
  retry: {
    maxRetries: 5,
    baseDelayMs: 60 * 1000,
    maxDelayMs: 6 * 60 * 60 * 1000,
    backoffFactor: 2,
  },
  assignment: {
    claimStaleAfterMs: 5 * 60 * 1000,
    batchSize: 100,
    claimLockKey: "assignment_fallback",
    claimLockTtlMs: 10 * 60 * 1000,
  },
  queue: {
    concurrency: 5,
    maxPending: 1000,
  },
  timezone: {
    display: "Asia/Kolkata",
  },
};

export const getRetryDelayMs = (attempt) => {
  const factor = Math.pow(EMAIL_CONFIG.retry.backoffFactor, attempt - 1);
  const delay = EMAIL_CONFIG.retry.baseDelayMs * factor;
  return Math.min(delay, EMAIL_CONFIG.retry.maxDelayMs);
};

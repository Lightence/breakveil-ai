const MINUTE = 60 * 1000

const BUILT_IN_POLICIES = {
  reed: { minimumRefreshMs: MINUTE, cacheMs: 15 * MINUTE },
  adzuna: { minimumRefreshMs: MINUTE, cacheMs: 15 * MINUTE },
  jooble: { minimumRefreshMs: MINUTE, cacheMs: 15 * MINUTE },
  arbeitnow: { minimumRefreshMs: 5 * MINUTE, cacheMs: 30 * MINUTE },
  jobicy: { minimumRefreshMs: 60 * MINUTE, cacheMs: 60 * MINUTE },
  remotive: { minimumRefreshMs: 6 * 60 * MINUTE, cacheMs: 6 * 60 * MINUTE },
}

const DEFAULT_POLICY = {
  minimumRefreshMs: 2 * MINUTE,
  cacheMs: 15 * MINUTE,
}

function getProviderPolicy(source) {
  return {
    ...DEFAULT_POLICY,
    ...(BUILT_IN_POLICIES[String(source || "").toLowerCase()] || {}),
  }
}

function parseRetryAfter(value, now = Date.now()) {
  const clean = String(value || "").trim()
  if (!clean) return 0
  if (/^\d+$/.test(clean)) return now + Number(clean) * 1000
  const timestamp = Date.parse(clean)
  return Number.isFinite(timestamp) && timestamp > now ? timestamp : 0
}

function failureBackoffMs(failureType, consecutiveFailures = 1) {
  if (failureType === "authentication") return 24 * 60 * MINUTE
  if (failureType === "rate-limit") return Math.min(6 * 60 * MINUTE, 15 * MINUTE * Math.max(1, consecutiveFailures))
  const exponent = Math.max(0, Math.min(5, consecutiveFailures - 1))
  return Math.min(30 * MINUTE, 2 * MINUTE * (2 ** exponent))
}

function nextRetryAt({ failureType, consecutiveFailures, retryAfterAt, attemptedAt = Date.now() }) {
  const supplied = Date.parse(retryAfterAt || "")
  if (Number.isFinite(supplied) && supplied > attemptedAt) return new Date(supplied).toISOString()
  return new Date(attemptedAt + failureBackoffMs(failureType, consecutiveFailures)).toISOString()
}

function refreshDecision({ source, health, forceRefresh = false, now = Date.now() }) {
  if (!health) return { allowed: true, reason: "", retryAt: "" }
  if (health.failureType === "authentication") return { allowed: true, reason: "", retryAt: "" }
  const retryAt = Date.parse(health.retryAt || "")
  if (health.status !== "available" && Number.isFinite(retryAt) && retryAt > now) {
    return { allowed: false, reason: health.failureType === "rate-limit" ? "rate-limit" : "backoff", retryAt: new Date(retryAt).toISOString() }
  }
  if (forceRefresh && health.status === "available") {
    const lastAttempt = Date.parse(health.lastAttemptAt || "")
    const nextAllowed = Number.isFinite(lastAttempt) ? lastAttempt + getProviderPolicy(source).minimumRefreshMs : 0
    if (nextAllowed > now) return { allowed: false, reason: "refresh-cooldown", retryAt: new Date(nextAllowed).toISOString() }
  }
  return { allowed: true, reason: "", retryAt: "" }
}

function cacheTtlMs(sources) {
  const values = (Array.isArray(sources) ? sources : []).map((source) => getProviderPolicy(source).cacheMs)
  return values.length ? Math.min(...values) : DEFAULT_POLICY.cacheMs
}

module.exports = {
  getProviderPolicy,
  parseRetryAfter,
  failureBackoffMs,
  nextRetryAt,
  refreshDecision,
  cacheTtlMs,
}

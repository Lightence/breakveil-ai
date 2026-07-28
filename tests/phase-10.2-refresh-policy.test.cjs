const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const {
  parseRetryAfter,
  failureBackoffMs,
  nextRetryAt,
  refreshDecision,
  cacheTtlMs,
} = require("../electron/job-refresh-policy.cjs")

const root = path.resolve(__dirname, "..")

test("understands Retry-After seconds and HTTP dates", () => {
  const now = Date.parse("2026-07-28T10:00:00Z")
  assert.equal(parseRetryAfter("120", now), now + 120000)
  assert.equal(parseRetryAfter("Tue, 28 Jul 2026 10:05:00 GMT", now), now + 300000)
  assert.equal(parseRetryAfter("not-a-date", now), 0)
})

test("uses bounded exponential backoff and a longer rate-limit rest", () => {
  assert.equal(failureBackoffMs("network", 1), 2 * 60000)
  assert.equal(failureBackoffMs("network", 3), 8 * 60000)
  assert.equal(failureBackoffMs("network", 20), 30 * 60000)
  assert.equal(failureBackoffMs("rate-limit", 1), 15 * 60000)
})

test("honours a provider Retry-After value over the default", () => {
  const attemptedAt = Date.parse("2026-07-28T10:00:00Z")
  assert.equal(
    nextRetryAt({
      failureType: "rate-limit",
      consecutiveFailures: 1,
      retryAfterAt: "2026-07-28T11:00:00Z",
      attemptedAt,
    }),
    "2026-07-28T11:00:00.000Z",
  )
})

test("blocks repeated failed requests until retry time", () => {
  const now = Date.parse("2026-07-28T10:00:00Z")
  const decision = refreshDecision({
    source: "reed",
    health: {
      status: "offline",
      failureType: "network",
      retryAt: "2026-07-28T10:05:00Z",
    },
    now,
  })
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, "backoff")
})

test("normal searches remain allowed after success but forced refreshes rest briefly", () => {
  const now = Date.parse("2026-07-28T10:00:30Z")
  const health = { status: "available", lastAttemptAt: "2026-07-28T10:00:00Z" }
  assert.equal(refreshDecision({ source: "reed", health, now }).allowed, true)
  assert.equal(refreshDecision({ source: "reed", health, forceRefresh: true, now }).allowed, false)
})

test("credential fixes can be tested immediately", () => {
  const decision = refreshDecision({
    source: "reed",
    health: { failureType: "authentication", retryAt: "2099-01-01T00:00:00Z" },
  })
  assert.equal(decision.allowed, true)
})

test("uses the safest shortest cache lifetime in mixed-source searches", () => {
  assert.equal(cacheTtlMs(["remotive"]), 6 * 60 * 60000)
  assert.equal(cacheTtlMs(["remotive", "reed"]), 15 * 60000)
})

test("engine and interface expose waiting and retry information", () => {
  const engine = fs.readFileSync(path.join(root, "electron/job-search-engine.cjs"), "utf8")
  const jobs = fs.readFileSync(path.join(root, "src/pages/Jobs.jsx"), "utf8")
  const settings = fs.readFileSync(path.join(root, "src/pages/Settings.jsx"), "utf8")
  assert.match(engine, /response\.headers\.get\("retry-after"\)/)
  assert.match(engine, /cacheEligible/)
  assert.match(engine, /query\.requestMode === "manual"/)
  assert.match(jobs, /Try again after/)
  assert.match(settings, /BreakVeil will try again after/)
})

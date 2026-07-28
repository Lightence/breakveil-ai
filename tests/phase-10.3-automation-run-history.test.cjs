const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const root = path.resolve(__dirname, "..")

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}

async function historyModule() {
  return import(pathToFileURL(path.join(root, "src/lib/discoveryRunHistory.js")).href)
}

test("normalises bounded safe run-history records", async () => {
  const { normaliseRunHistoryEntry } = await historyModule()
  const entry = normaliseRunHistoryEntry({
    id: "run-1",
    trigger: "unexpected",
    status: "unexpected",
    durationMs: -20,
    queryCount: 999,
    error: "x".repeat(2000),
    providerErrors: Array.from({ length: 30 }, (_, index) => ({
      source: `source-${index}`,
      error: "failure",
    })),
  })
  assert.equal(entry.trigger, "scheduled")
  assert.equal(entry.status, "failed")
  assert.equal(entry.durationMs, 0)
  assert.equal(entry.queryCount, 4)
  assert.equal(entry.error.length, 1000)
  assert.equal(entry.providerErrors.length, 12)
})

test("redacts common secrets from stored errors", async () => {
  const { normaliseRunHistoryEntry } = await historyModule()
  const entry = normaliseRunHistoryEntry({
    error: "Bearer top-secret https://example.test?api_key=secret sk-projectSecret123",
  })
  assert.doesNotMatch(entry.error, /top-secret|api_key=secret|sk-projectSecret123/)
  assert.match(entry.error, /redacted/)
})

test("stores newest runs first and emits an update event", async () => {
  const {
    appendDiscoveryRunHistory,
    loadDiscoveryRunHistory,
  } = await historyModule()
  const storage = memoryStorage()
  let events = 0
  const target = { dispatchEvent: () => { events += 1 } }
  appendDiscoveryRunHistory({ id: "one", status: "success", trigger: "manual" }, storage, target)
  appendDiscoveryRunHistory({ id: "two", status: "failed", trigger: "retry", retryOf: "one" }, storage, target)
  const history = loadDiscoveryRunHistory(storage)
  assert.deepEqual(history.map((entry) => entry.id), ["two", "one"])
  assert.equal(history[0].retryOf, "one")
  assert.equal(events, 2)
})

test("keeps at most one hundred run records and survives damaged storage", async () => {
  const {
    appendDiscoveryRunHistory,
    discoveryRunHistoryStorageKey,
    loadDiscoveryRunHistory,
  } = await historyModule()
  const storage = memoryStorage()
  for (let index = 0; index < 105; index += 1) {
    appendDiscoveryRunHistory({ id: `run-${index}`, status: "success" }, storage, null)
  }
  assert.equal(loadDiscoveryRunHistory(storage).length, 100)
  const damaged = memoryStorage({ [discoveryRunHistoryStorageKey]: "not-json" })
  assert.deepEqual(loadDiscoveryRunHistory(damaged), [])
})

test("records successful and failed discovery runs and wires safe controls", () => {
  const discovery = fs.readFileSync(path.join(root, "src/lib/jobDiscovery.js"), "utf8")
  const runner = fs.readFileSync(path.join(root, "src/components/BackgroundAutomationRunner.jsx"), "utf8")
  const control = fs.readFileSync(path.join(root, "src/components/JobDiscoveryControlCard.jsx"), "utf8")
  assert.match(discovery, /appendDiscoveryRunHistory\(\{/)
  assert.match(discovery, /status: "failed"/)
  assert.match(runner, /trigger: "scheduled"/)
  assert.match(control, /Discovery Run History/)
  assert.match(control, /Run again/)
  assert.match(control, /onClick=\{\(\) =>\s*runNow\(\)\s*\}/)
})

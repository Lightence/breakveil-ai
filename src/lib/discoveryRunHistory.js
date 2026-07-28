export const discoveryRunHistoryStorageKey = "jobpilot.discovery-run-history"

const maximumRunHistoryItems = 100
const maximumQueriesPerRun = 4

function createLocalId() {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function historyText(value, maximumLength = 500) {
  return String(value || "")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[a-z0-9_-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|key)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength)
}

export function normaliseRunHistoryEntry(entry = {}) {
  const allowedStatuses = new Set(["success", "partial", "cached", "failed"])
  const allowedTriggers = new Set(["manual", "scheduled", "retry"])
  return {
    id: historyText(entry.id, 100) || createLocalId(),
    startedAt: historyText(entry.startedAt, 40),
    completedAt: historyText(entry.completedAt, 40),
    durationMs: Math.max(0, Math.min(Number(entry.durationMs || 0), 24 * 60 * 60 * 1000)),
    trigger: allowedTriggers.has(entry.trigger) ? entry.trigger : "scheduled",
    retryOf: historyText(entry.retryOf, 100),
    status: allowedStatuses.has(entry.status) ? entry.status : "failed",
    mode: historyText(entry.mode, 40),
    queryCount: Math.max(0, Math.min(Number(entry.queryCount || 0), maximumQueriesPerRun)),
    sourceCount: Math.max(0, Math.min(Number(entry.sourceCount || 0), 100)),
    successfulProviderCount: Math.max(0, Math.min(Number(entry.successfulProviderCount || 0), 500)),
    rawCount: Math.max(0, Math.min(Number(entry.rawCount || 0), 100000)),
    newCount: Math.max(0, Math.min(Number(entry.newCount || 0), 100000)),
    totalCount: Math.max(0, Math.min(Number(entry.totalCount || 0), 100000)),
    error: historyText(entry.error, 1000),
    providerErrors: Array.isArray(entry.providerErrors)
      ? entry.providerErrors.slice(0, 12).map((item) => ({
          source: historyText(item?.source || item?.sourceName, 100),
          query: historyText(item?.query, 200),
          error: historyText(item?.error, 500),
        }))
      : [],
  }
}

export function loadDiscoveryRunHistory(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(discoveryRunHistoryStorageKey) || "[]")
    return Array.isArray(stored)
      ? stored.slice(0, maximumRunHistoryItems).map(normaliseRunHistoryEntry)
      : []
  } catch {
    return []
  }
}

export function appendDiscoveryRunHistory(
  entry,
  storage = globalThis.localStorage,
  eventTarget = globalThis.window,
) {
  const updated = [
    normaliseRunHistoryEntry(entry),
    ...loadDiscoveryRunHistory(storage),
  ].slice(0, maximumRunHistoryItems)
  try {
    storage?.setItem(discoveryRunHistoryStorageKey, JSON.stringify(updated))
  } catch {
    // Run history must never interrupt job discovery if browser storage is full.
  }
  try {
    eventTarget?.dispatchEvent?.(new Event("jobpilot:discovery-run-history-updated"))
  } catch {
    // The record is still usable even when no browser event target is available.
  }
  return updated[0]
}

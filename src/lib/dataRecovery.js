import {
  applyBreakVeilStorage,
  collectBreakVeilStorage,
} from "./dataManagement"

import {
  currentDataSchemaVersion,
  inspectDataSnapshot,
  repairDataSnapshot,
} from "./dataSchema"

export const safeModeStorageKey =
  "jobpilot.recovery-safe-mode"

const safeModeRequestStorageKey =
  "jobpilot.recovery-safe-mode-request"

const lastRestoreStorageKey =
  "jobpilot.recovery-last-restore"

function parseObject(
  value,
) {
  try {
    const parsed =
      JSON.parse(
        value ||
        "{}",
      )

    return (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed,
      )
        ? parsed
        : {}
    )
  } catch {
    return {}
  }
}

export function readSafeModeState() {
  return parseObject(
    localStorage.getItem(
      safeModeStorageKey,
    ),
  )
}

export function isSafeModeActive() {
  return Boolean(
    readSafeModeState()
      .active,
  )
}

export function requestSafeModeStartup(
  reason =
    "Renderer recovery was requested.",
) {
  try {
    localStorage.setItem(
      safeModeRequestStorageKey,
      JSON.stringify({
        requestedAt:
          new Date()
            .toISOString(),

        reason,
      }),
    )

    return true
  } catch {
    return false
  }
}

export function consumeSafeModeStartupRequest() {
  try {
    const request =
      parseObject(
        localStorage.getItem(
          safeModeRequestStorageKey,
        ),
      )

    localStorage.removeItem(
      safeModeRequestStorageKey,
    )

    return request
  } catch {
    return {}
  }
}

export async function getRecoveryStatus() {
  const result =
    await window.jobPilot
      ?.dataRecovery
      ?.getStatus?.()

  if (
    result &&
    !result.ok
  ) {
    throw new Error(
      result.error ||
      "BreakVeil recovery status could not be loaded.",
    )
  }

  return {
    ...(result?.status ||
      {}),

    safeMode:
      readSafeModeState(),
  }
}

export async function enterSafeMode({
  issues =
    [],
  reason =
    "BreakVeil detected incompatible local data.",
} = {}) {
  const originalSnapshot =
    collectBreakVeilStorage()

  const quarantineResult =
    await window.jobPilot
      ?.dataRecovery
      ?.createQuarantine?.({
        rendererStorage:
          originalSnapshot,

        issues,

        reason,
      })

  if (
    quarantineResult &&
    !quarantineResult.ok
  ) {
    throw new Error(
      quarantineResult.error ||
      "BreakVeil could not preserve the original data in recovery quarantine.",
    )
  }

  const repair =
    repairDataSnapshot(
      originalSnapshot,
    )

  const repairedSnapshot = {
    ...repair.snapshot,
  }

  const checkedAt =
    new Date()
      .toISOString()

  repairedSnapshot[
    safeModeStorageKey
  ] =
    JSON.stringify({
      active:
        true,

      startedAt:
        checkedAt,

      reason,

      issueCount:
        issues.length,

      quarantinePath:
        quarantineResult
          ?.quarantine
          ?.path ||
        "",

      repairedKeyCount:
        repair.summary
          .changedKeys
          .length,

      schemaVersion:
        currentDataSchemaVersion,
    })

  const metadata =
    parseObject(
      repairedSnapshot[
        "jobpilot.data-schema"
      ],
    )

  const validation =
    inspectDataSnapshot(
      repairedSnapshot,
    )

  repairedSnapshot[
    "jobpilot.data-schema"
  ] =
    JSON.stringify({
      ...metadata,

      version:
        currentDataSchemaVersion,

      applicationVersion:
        "0.3.1",

      lastCheckedAt:
        validation.checkedAt,

      lastValidation:
        validation,

      lastRecovery: {
        type:
          "safe-mode",

        completedAt:
          checkedAt,

        quarantinePath:
          quarantineResult
            ?.quarantine
            ?.path ||
          "",

        summary:
          repair.summary,
      },
    })

  applyBreakVeilStorage(
    repairedSnapshot,
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:data-schema-updated",
    ),
  )

  return {
    ok:
      true,

    quarantine:
      quarantineResult
        ?.quarantine ||
      null,

    summary:
      repair.summary,

    validation,
  }
}

export async function restoreLatestSafetySnapshot() {
  const result =
    await window.jobPilot
      ?.dataRecovery
      ?.getLatestSnapshot?.()

  if (
    !result?.ok
  ) {
    throw new Error(
      result?.error ||
      "No valid migration safety snapshot is available.",
    )
  }

  const rendererStorage =
    result.snapshot
      ?.rendererStorage

  if (
    !rendererStorage ||
    typeof rendererStorage !==
      "object" ||
    Array.isArray(
      rendererStorage,
    )
  ) {
    throw new Error(
      "The latest migration safety snapshot does not contain restorable BreakVeil data.",
    )
  }

  applyBreakVeilStorage(
    rendererStorage,
  )

  localStorage.removeItem(
    safeModeStorageKey,
  )

  localStorage.setItem(
    lastRestoreStorageKey,
    JSON.stringify({
      restoredAt:
        new Date()
          .toISOString(),

      snapshotPath:
        result.snapshot
          ?.path ||
        "",

      snapshotCreatedAt:
        result.snapshot
          ?.createdAt ||
        "",
    }),
  )

  return {
    ok:
      true,

    snapshot:
      result.snapshot,
  }
}

export function exitSafeMode() {
  localStorage.removeItem(
    safeModeStorageKey,
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:recovery-updated",
    ),
  )
}

export async function repairResumeLibraryIndex() {
  const result =
    await window.jobPilot
      ?.dataRecovery
      ?.repairDocumentIndex?.()

  if (
    !result?.ok
  ) {
    throw new Error(
      result?.error ||
      "The Resume Library index could not be repaired.",
    )
  }

  window.dispatchEvent(
    new Event(
      "jobpilot:documents-updated",
    ),
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:recovery-updated",
    ),
  )

  return result
}

export async function openRecoveryFolder() {
  const result =
    await window.jobPilot
      ?.dataRecovery
      ?.openFolder?.()

  if (
    result &&
    !result.ok
  ) {
    throw new Error(
      result.error ||
      "The recovery folder could not be opened.",
    )
  }

  return result
}

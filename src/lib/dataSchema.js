import {
  applyBreakVeilStorage,
  collectBreakVeilStorage,
} from "./dataManagement.js"

import {
  emptyReviewAcknowledgements,
  normaliseReviewAcknowledgements,
} from "./applicationPreparation.js"

export const currentDataSchemaVersion =
  2

export const dataSchemaStorageKey =
  "jobpilot.data-schema"

const migrationHistoryStorageKey =
  "jobpilot.data-migration-history"

const sessionSnapshotStorageKey =
  "jobpilot.data-migration-session-snapshot"

const validJobStatuses =
  new Set([
    "Saved",
    "Applied",
    "Interview",
    "Offer",
    "Rejected",
  ])

const validPackageStatuses =
  new Set([
    "Draft",
    "Ready for Review",
    "Approved",
    "Sent",
  ])

const expectedContainers = {
  "jobpilot.jobs":
    "array",

  "jobpilot.application-queue":
    "array",

  "jobpilot.candidate-profile":
    "object",

  "jobpilot.application-tailoring":
    "object",

  "jobpilot.match-inbox-decisions":
    "object",

  "jobpilot.discovery-settings":
    "object",

  "jobpilot.discovery-results":
    "array",

  "jobpilot.discovery-history":
    "object",

  "jobpilot.ui-preferences":
    "object",
}

function isPlainObject(
  value,
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    ),
  )
}

function safeInteger(
  value,
  fallback =
    0,
) {
  const parsed =
    Number.parseInt(
      String(
        value,
      ),
      10,
    )

  return Number.isFinite(
    parsed,
  )
    ? Math.max(
        0,
        parsed,
      )
    : fallback
}

function readJsonValue(
  snapshot,
  key,
) {
  if (
    !Object.prototype
      .hasOwnProperty
      .call(
        snapshot,
        key,
      )
  ) {
    return {
      exists:
        false,

      value:
        undefined,

      error:
        "",
    }
  }

  try {
    return {
      exists:
        true,

      value:
        JSON.parse(
          snapshot[
            key
          ],
        ),

      error:
        "",
    }
  } catch (error) {
    return {
      exists:
        true,

      value:
        undefined,

      error:
        error?.message ||
        "Stored JSON could not be read.",
    }
  }
}

function writeJsonValue(
  snapshot,
  key,
  value,
) {
  snapshot[
    key
  ] =
    JSON.stringify(
      value,
    )
}


function repairKnownSchemaCompatibility(
  inputSnapshot,
) {
  let snapshot = {
    ...inputSnapshot,
  }

  const changedKeys =
    []

  const notes =
    []

  const discoveryHistory =
    readJsonValue(
      snapshot,
      "jobpilot.discovery-history",
    )

  if (
    discoveryHistory.exists &&
    !discoveryHistory.error &&
    Array.isArray(
      discoveryHistory.value,
    )
  ) {
    const legacySeen =
      discoveryHistory.value
        .filter(
          (value) =>
            typeof value ===
              "string" &&
            value.trim(),
        )
        .map(
          (value) =>
            value.trim(),
        )

    writeJsonValue(
      snapshot,
      "jobpilot.discovery-history",
      {
        seen: [
          ...new Set(
            legacySeen,
          ),
        ],

        dismissed:
          [],
      },
    )

    changedKeys.push(
      "jobpilot.discovery-history",
    )

    notes.push(
      "Automatic Job Discovery history was converted from the old array shape to the current seen/dismissed object shape.",
    )
  }

  const reviewCompatibility =
    migrateToVersion2(
      snapshot,
    )

  if (
    reviewCompatibility
      .summary
      .changedKeys
      .length >
    0
  ) {
    snapshot =
      reviewCompatibility
        .snapshot

    changedKeys.push(
      ...reviewCompatibility
        .summary
        .changedKeys,
    )

    notes.push(
      ...reviewCompatibility
        .summary
        .notes,
    )
  }

  return {
    snapshot,
    changedKeys: [
      ...new Set(
        changedKeys,
      ),
    ],
    notes,
  }
}

function stableLegacyId(
  prefix,
  value,
  index,
) {
  const source =
    `${prefix}|${index}|${JSON.stringify(
      value,
    )}`

  let hash =
    2166136261

  for (
    let characterIndex =
      0;
    characterIndex <
    source.length;
    characterIndex +=
      1
  ) {
    hash ^=
      source.charCodeAt(
        characterIndex,
      )

    hash =
      Math.imul(
        hash,
        16777619,
      )
  }

  return `${prefix}-${(
    hash >>>
    0
  ).toString(
    36,
  )}`
}

function normaliseObjectArray(
  value,
  {
    prefix,
    statusSet,
    defaultStatus,
    summary,
    key,
  },
) {
  const array =
    Array.isArray(
      value,
    )
      ? value
      : []

  const normalised =
    []

  array.forEach(
    (
      item,
      index,
    ) => {
      if (
        !isPlainObject(
          item,
        )
      ) {
        summary.removedInvalidItems +=
          1

        summary.notes.push(
          `${key}: removed a non-object item at position ${index + 1}.`,
        )

        return
      }

      const nextItem = {
        ...item,
      }

      if (
        !String(
          nextItem.id ||
          "",
        ).trim()
      ) {
        nextItem.id =
          stableLegacyId(
            prefix,
            item,
            index,
          )

        summary.generatedIds +=
          1
      } else {
        nextItem.id =
          String(
            nextItem.id,
          )
      }

      if (
        key ===
        "jobpilot.jobs"
      ) {
        if (
          !String(
            nextItem.role ||
            "",
          ).trim() &&
          String(
            nextItem.title ||
            "",
          ).trim()
        ) {
          nextItem.role =
            String(
              nextItem.title,
            ).trim()

          summary.aliasesRestored +=
            1
        }

        if (
          !String(
            nextItem.status ||
            "",
          ).trim() ||
          (
            statusSet &&
            !statusSet.has(
              nextItem.status,
            )
          )
        ) {
          nextItem.status =
            defaultStatus

          summary.normalisedStatuses +=
            1
        }

        if (
          nextItem.activityHistory !==
            undefined &&
          !Array.isArray(
            nextItem.activityHistory,
          )
        ) {
          nextItem.activityHistory =
            []

          summary.normalisedContainers +=
            1
        }
      }

      if (
        key ===
        "jobpilot.application-queue"
      ) {
        if (
          !String(
            nextItem.status ||
            "",
          ).trim() ||
          (
            statusSet &&
            !statusSet.has(
              nextItem.status,
            )
          )
        ) {
          nextItem.status =
            defaultStatus

          summary.normalisedStatuses +=
            1
        }

        if (
          nextItem.gmailDraftHistory !==
            undefined &&
          !Array.isArray(
            nextItem.gmailDraftHistory,
          )
        ) {
          nextItem.gmailDraftHistory =
            []

          summary.normalisedContainers +=
            1
        }
      }

      normalised.push(
        nextItem,
      )
    },
  )

  return normalised
}

function inspectSnapshot(
  snapshot,
) {
  const issues =
    []

  for (
    const [
      key,
      expectedType,
    ]
    of Object.entries(
      expectedContainers,
    )
  ) {
    const result =
      readJsonValue(
        snapshot,
        key,
      )

    if (
      !result.exists
    ) {
      continue
    }

    if (
      result.error
    ) {
      issues.push({
        key,

        type:
          "invalid-json",

        message:
          `${key} contains unreadable JSON.`,
      })

      continue
    }

    const validType =
      expectedType ===
      "array"
        ? Array.isArray(
            result.value,
          )
        : isPlainObject(
            result.value,
          )

    if (
      !validType
    ) {
      issues.push({
        key,

        type:
          "unexpected-container",

        message:
          `${key} should contain a JSON ${expectedType}.`,
      })
    }
  }

  const jobsResult =
    readJsonValue(
      snapshot,
      "jobpilot.jobs",
    )

  if (
    Array.isArray(
      jobsResult.value,
    )
  ) {
    jobsResult.value.forEach(
      (
        job,
        index,
      ) => {
        if (
          !isPlainObject(
            job,
          )
        ) {
          issues.push({
            key:
              "jobpilot.jobs",

            type:
              "invalid-item",

            message:
              `Tracked job ${index + 1} is not a valid object.`,
          })

          return
        }

        if (
          !String(
            job.id ||
            "",
          ).trim()
        ) {
          issues.push({
            key:
              "jobpilot.jobs",

            type:
              "missing-id",

            message:
              `Tracked job ${index + 1} does not have an identifier.`,
          })
        }
      },
    )
  }

  const queueResult =
    readJsonValue(
      snapshot,
      "jobpilot.application-queue",
    )

  if (
    Array.isArray(
      queueResult.value,
    )
  ) {
    queueResult.value.forEach(
      (
        applicationPackage,
        index,
      ) => {
        if (
          !isPlainObject(
            applicationPackage,
          )
        ) {
          issues.push({
            key:
              "jobpilot.application-queue",

            type:
              "invalid-item",

            message:
              `Application package ${index + 1} is not a valid object.`,
          })

          return
        }

        if (
          !String(
            applicationPackage.id ||
            "",
          ).trim()
        ) {
          issues.push({
            key:
              "jobpilot.application-queue",

            type:
              "missing-id",

            message:
              `Application package ${index + 1} does not have an identifier.`,
          })
        }
      },
    )
  }

  return {
    checkedAt:
      new Date()
        .toISOString(),

    storageKeyCount:
      Object.keys(
        snapshot,
      ).length,

    issueCount:
      issues.length,

    issues,
  }
}

function createSummary(
  fromVersion,
  toVersion,
) {
  return {
    fromVersion,
    toVersion,

    changedKeys:
      [],

    repairedJsonValues:
      0,

    normalisedContainers:
      0,

    removedInvalidItems:
      0,

    generatedIds:
      0,

    aliasesRestored:
      0,

    normalisedStatuses:
      0,

    reviewRecordsNormalised:
      0,

    approvalsReopened:
      0,

    notes:
      [],
  }
}

function ensureExpectedContainer(
  snapshot,
  key,
  expectedType,
  summary,
) {
  const result =
    readJsonValue(
      snapshot,
      key,
    )

  if (
    !result.exists
  ) {
    return
  }

  const valid =
    expectedType ===
    "array"
      ? Array.isArray(
          result.value,
        )
      : isPlainObject(
          result.value,
        )

  if (
    result.error ||
    !valid
  ) {
    writeJsonValue(
      snapshot,
      key,
      expectedType ===
        "array"
        ? []
        : {},
    )

    summary.changedKeys.push(
      key,
    )

    summary.repairedJsonValues +=
      result.error
        ? 1
        : 0

    summary.normalisedContainers +=
      1

    summary.notes.push(
      `${key}: replaced an unreadable or incompatible ${expectedType} container with a safe empty value.`,
    )
  }
}

function migrateToVersion1(
  inputSnapshot,
) {
  const snapshot = {
    ...inputSnapshot,
  }

  const summary =
    createSummary(
      0,
      1,
    )

  for (
    const [
      key,
      expectedType,
    ]
    of Object.entries(
      expectedContainers,
    )
  ) {
    ensureExpectedContainer(
      snapshot,
      key,
      expectedType,
      summary,
    )
  }

  const jobsResult =
    readJsonValue(
      snapshot,
      "jobpilot.jobs",
    )

  if (
    Array.isArray(
      jobsResult.value,
    )
  ) {
    const normalisedJobs =
      normaliseObjectArray(
        jobsResult.value,
        {
          prefix:
            "legacy-job",

          statusSet:
            validJobStatuses,

          defaultStatus:
            "Saved",

          summary,

          key:
            "jobpilot.jobs",
        },
      )

    if (
      JSON.stringify(
        normalisedJobs,
      ) !==
      JSON.stringify(
        jobsResult.value,
      )
    ) {
      writeJsonValue(
        snapshot,
        "jobpilot.jobs",
        normalisedJobs,
      )

      summary.changedKeys.push(
        "jobpilot.jobs",
      )
    }
  }

  const queueResult =
    readJsonValue(
      snapshot,
      "jobpilot.application-queue",
    )

  if (
    Array.isArray(
      queueResult.value,
    )
  ) {
    const normalisedQueue =
      normaliseObjectArray(
        queueResult.value,
        {
          prefix:
            "legacy-application",

          statusSet:
            validPackageStatuses,

          defaultStatus:
            "Draft",

          summary,

          key:
            "jobpilot.application-queue",
        },
      )

    if (
      JSON.stringify(
        normalisedQueue,
      ) !==
      JSON.stringify(
        queueResult.value,
      )
    ) {
      writeJsonValue(
        snapshot,
        "jobpilot.application-queue",
        normalisedQueue,
      )

      summary.changedKeys.push(
        "jobpilot.application-queue",
      )
    }
  }

  summary.changedKeys =
    [
      ...new Set(
        summary.changedKeys,
      ),
    ]

  return {
    snapshot,
    summary,
  }
}

function migrateToVersion2(
  inputSnapshot,
) {
  const snapshot = {
    ...inputSnapshot,
  }

  const summary =
    createSummary(
      1,
      2,
    )

  const queueResult =
    readJsonValue(
      snapshot,
      "jobpilot.application-queue",
    )

  if (
    !Array.isArray(
      queueResult.value,
    )
  ) {
    return {
      snapshot,
      summary,
    }
  }

  const migratedQueue =
    queueResult.value.map(
      (applicationPackage) => {
        if (
          !isPlainObject(
            applicationPackage,
          )
        ) {
          return applicationPackage
        }

        const original =
          JSON.stringify(
            applicationPackage,
          )

        const reviewAcknowledgements =
          applicationPackage.status ===
          "Draft"
            ? {
                ...emptyReviewAcknowledgements,
              }
            : normaliseReviewAcknowledgements(
                applicationPackage
                  .reviewAcknowledgements,
              )

        const reviewComplete =
          Object.values(
            reviewAcknowledgements,
          ).every(
            (value) =>
              value === true,
          )

        const reopenApproval =
          applicationPackage.status ===
            "Approved" &&
          !reviewComplete

        const nextPackage = {
          ...applicationPackage,

          status:
            reopenApproval
              ? "Ready for Review"
              : applicationPackage.status,

          reviewAcknowledgements,

          reviewedAt:
            reopenApproval ||
            applicationPackage.status ===
              "Draft"
              ? ""
              : String(
                  applicationPackage
                    .reviewedAt ||
                    "",
                ),

          approvedAt:
            reopenApproval ||
            applicationPackage.status ===
              "Draft"
              ? ""
              : String(
                  applicationPackage
                    .approvedAt ||
                    "",
                ),

          applicationAnswers:
            Array.isArray(
              applicationPackage
                .applicationAnswers,
            )
              ? applicationPackage
                  .applicationAnswers
              : [],
        }

        if (
          reopenApproval
        ) {
          summary.approvalsReopened +=
            1
        }

        if (
          JSON.stringify(
            nextPackage,
          ) !== original
        ) {
          summary.reviewRecordsNormalised +=
            1
        }

        return nextPackage
      },
    )

  if (
    JSON.stringify(
      migratedQueue,
    ) !==
    JSON.stringify(
      queueResult.value,
    )
  ) {
    writeJsonValue(
      snapshot,
      "jobpilot.application-queue",
      migratedQueue,
    )

    summary.changedKeys.push(
      "jobpilot.application-queue",
    )

    summary.notes.push(
      summary.approvalsReopened >
        0
        ? `${summary.approvalsReopened} previously approved application package${summary.approvalsReopened === 1 ? " was" : "s were"} returned to human review because no Phase 10.4 review confirmation existed.`
        : "Application packages were updated with the Phase 10.4 human-review record.",
    )
  }

  return {
    snapshot,
    summary,
  }
}

const migrations = {
  1:
    migrateToVersion1,

  2:
    migrateToVersion2,
}

function readStoredMetadata() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          dataSchemaStorageKey,
        ) ||
        "{}",
      )

    return isPlainObject(
      parsed,
    )
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function writeStoredMetadata(
  metadata,
) {
  localStorage.setItem(
    dataSchemaStorageKey,
    JSON.stringify(
      metadata,
    ),
  )
}

function appendMigrationHistory(
  entry,
) {
  let history

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          migrationHistoryStorageKey,
        ) ||
        "[]",
      )

    history =
      Array.isArray(
        parsed,
      )
        ? parsed
        : []
  } catch {
    history =
      []
  }

  localStorage.setItem(
    migrationHistoryStorageKey,
    JSON.stringify(
      [
        entry,
        ...history,
      ].slice(
        0,
        10,
      ),
    ),
  )
}

function saveSessionFallbackSnapshot(
  snapshot,
  fromVersion,
  toVersion,
) {
  try {
    sessionStorage.setItem(
      sessionSnapshotStorageKey,
      JSON.stringify({
        createdAt:
          new Date()
            .toISOString(),

        fromVersion,
        toVersion,
        rendererStorage:
          snapshot,
      }),
    )

    return {
      ok:
        true,

      path:
        "Current BreakVeil session",

      warning:
        "Electron migration storage was unavailable, so the safety copy is available only until this session closes.",
    }
  } catch {
    return {
      ok:
        false,

      error:
        "A migration safety snapshot could not be created.",
    }
  }
}

async function prepareMigrationSnapshot({
  snapshot,
  fromVersion,
  toVersion,
}) {
  const prepare =
    window.jobPilot
      ?.dataMigrations
      ?.prepare

  if (
    typeof prepare !==
    "function"
  ) {
    return saveSessionFallbackSnapshot(
      snapshot,
      fromVersion,
      toVersion,
    )
  }

  const result =
    await prepare({
      fromVersion,
      toVersion,

      rendererStorage:
        snapshot,
    })

  if (
    !result?.ok
  ) {
    return {
      ok:
        false,

      error:
        result?.error ||
        "The migration safety snapshot could not be created.",
    }
  }

  return {
    ok:
      true,

    path:
      result.snapshot
        ?.path ||
      "",

    snapshot:
      result.snapshot ||
      null,

    warning:
      "",
  }
}

async function completeMigrationRecord({
  fromVersion,
  toVersion,
  snapshotPath,
  summary,
}) {
  const complete =
    window.jobPilot
      ?.dataMigrations
      ?.complete

  if (
    typeof complete !==
    "function"
  ) {
    return {
      ok:
        true,
    }
  }

  return complete({
    fromVersion,
    toVersion,
    snapshotPath,
    summary,
  })
}

export function readDataSchemaMetadata() {
  const metadata =
    readStoredMetadata()

  return {
    version:
      safeInteger(
        metadata.version,
      ),

    applicationVersion:
      String(
        metadata.applicationVersion ||
        "",
      ),

    lastCheckedAt:
      String(
        metadata.lastCheckedAt ||
        "",
      ),

    lastMigration:
      isPlainObject(
        metadata.lastMigration,
      )
        ? metadata.lastMigration
        : null,

    lastValidation:
      isPlainObject(
        metadata.lastValidation,
      )
        ? metadata.lastValidation
        : null,
  }
}

export function inspectBreakVeilData() {
  return inspectSnapshot(
    collectBreakVeilStorage(),
  )
}

export function inspectDataSnapshot(
  snapshot,
) {
  return inspectSnapshot(
    snapshot &&
    typeof snapshot ===
      "object" &&
    !Array.isArray(
      snapshot,
    )
      ? snapshot
      : {},
  )
}

export function repairDataSnapshot(
  snapshot,
) {
  const version1 =
    migrateToVersion1(
      snapshot &&
      typeof snapshot ===
        "object" &&
      !Array.isArray(
        snapshot,
      )
        ? snapshot
        : {},
    )

  const result =
    migrateToVersion2(
      version1.snapshot,
    )

  const summary = {
    ...createSummary(
      0,
      currentDataSchemaVersion,
    ),

    changedKeys: [
      ...new Set([
        ...version1.summary
          .changedKeys,
        ...result.summary
          .changedKeys,
      ]),
    ],

    repairedJsonValues:
      version1.summary
        .repairedJsonValues +
      result.summary
        .repairedJsonValues,

    normalisedContainers:
      version1.summary
        .normalisedContainers +
      result.summary
        .normalisedContainers,

    removedInvalidItems:
      version1.summary
        .removedInvalidItems +
      result.summary
        .removedInvalidItems,

    generatedIds:
      version1.summary
        .generatedIds +
      result.summary
        .generatedIds,

    aliasesRestored:
      version1.summary
        .aliasesRestored +
      result.summary
        .aliasesRestored,

    normalisedStatuses:
      version1.summary
        .normalisedStatuses +
      result.summary
        .normalisedStatuses,

    reviewRecordsNormalised:
      version1.summary
        .reviewRecordsNormalised +
      result.summary
        .reviewRecordsNormalised,

    approvalsReopened:
      version1.summary
        .approvalsReopened +
      result.summary
        .approvalsReopened,

    notes: [
      ...version1.summary
        .notes,
      ...result.summary
        .notes,
    ],
  }

  return {
    ...result,

    summary,

    validation:
      inspectSnapshot(
        result.snapshot,
      ),
  }
}

export function recordDataValidation(
  validation,
) {
  const previous =
    readStoredMetadata()

  const metadata = {
    ...previous,

    version:
      safeInteger(
        previous.version,
      ),

    lastCheckedAt:
      new Date()
        .toISOString(),

    lastValidation:
      validation,
  }

  writeStoredMetadata(
    metadata,
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:data-schema-updated",
    ),
  )

  return metadata
}

export async function runStartupDataMigration() {
  const originalSnapshot =
    collectBreakVeilStorage()

  const storedMetadata =
    readStoredMetadata()

  const fromVersion =
    safeInteger(
      storedMetadata.version,
    )

  if (
    fromVersion >
    currentDataSchemaVersion
  ) {
    return {
      ok:
        false,

      incompatible:
        true,

      currentVersion:
        currentDataSchemaVersion,

      storedVersion:
        fromVersion,

      error:
        `This BreakVeil build supports local data schema v${currentDataSchemaVersion}, but the stored data uses v${fromVersion}.`,
    }
  }

  if (
    fromVersion ===
    currentDataSchemaVersion
  ) {
    const compatibilityRepair =
      repairKnownSchemaCompatibility(
        originalSnapshot,
      )

    const startupSnapshot =
      compatibilityRepair.snapshot

    if (
      compatibilityRepair
        .changedKeys
        .length >
      0
    ) {
      applyBreakVeilStorage(
        startupSnapshot,
      )
    }

    const validation =
      inspectSnapshot(
        startupSnapshot,
      )

    const metadata = {
      ...storedMetadata,

      version:
        currentDataSchemaVersion,

      applicationVersion:
        "0.3.1",

      lastCheckedAt:
        validation.checkedAt,

      lastValidation:
        validation,

      ...(compatibilityRepair
        .changedKeys
        .length >
      0
        ? {
            lastCompatibilityRepair: {
              completedAt:
                validation.checkedAt,

              changedKeys:
                compatibilityRepair.changedKeys,

              notes:
                compatibilityRepair.notes,
            },
          }
        : {}),
    }

    writeStoredMetadata(
      metadata,
    )

    if (
      validation.issueCount >
      0
    ) {
      return {
        ok:
          false,

        recoveryRequired:
          true,

        currentVersion:
          currentDataSchemaVersion,

        storedVersion:
          fromVersion,

        validation,

        metadata,

        error:
          `BreakVeil detected ${validation.issueCount} local data compatibility issue${validation.issueCount === 1 ? "" : "s"}. The affected records have not been deleted.`,
      }
    }

    return {
      ok:
        true,

      migrated:
        false,

      repairedCompatibility:
        compatibilityRepair
          .changedKeys
          .length >
        0,

      compatibilityRepair:
        compatibilityRepair
          .changedKeys
          .length >
        0
          ? compatibilityRepair
          : null,

      currentVersion:
        currentDataSchemaVersion,

      validation,

      metadata,
    }
  }

  const snapshotResult =
    await prepareMigrationSnapshot({
      snapshot:
        originalSnapshot,

      fromVersion,

      toVersion:
        currentDataSchemaVersion,
    })

  if (
    !snapshotResult.ok
  ) {
    return {
      ok:
        false,

      error:
        snapshotResult.error ||
        "BreakVeil could not create a migration safety snapshot.",
    }
  }

  let workingSnapshot = {
    ...originalSnapshot,
  }

  const combinedSummary =
    createSummary(
      fromVersion,
      currentDataSchemaVersion,
    )

  try {
    for (
      let nextVersion =
        fromVersion +
        1;
      nextVersion <=
      currentDataSchemaVersion;
      nextVersion +=
        1
    ) {
      const migration =
        migrations[
          nextVersion
        ]

      if (
        typeof migration !==
        "function"
      ) {
        throw new Error(
          `The migration from schema v${nextVersion - 1} to v${nextVersion} is unavailable.`,
        )
      }

      const result =
        migration(
          workingSnapshot,
        )

      workingSnapshot =
        result.snapshot

      combinedSummary.changedKeys.push(
        ...result.summary
          .changedKeys,
      )

      combinedSummary.repairedJsonValues +=
        result.summary
          .repairedJsonValues

      combinedSummary.normalisedContainers +=
        result.summary
          .normalisedContainers

      combinedSummary.removedInvalidItems +=
        result.summary
          .removedInvalidItems

      combinedSummary.generatedIds +=
        result.summary
          .generatedIds

      combinedSummary.aliasesRestored +=
        result.summary
          .aliasesRestored

      combinedSummary.normalisedStatuses +=
        result.summary
          .normalisedStatuses

      combinedSummary.reviewRecordsNormalised +=
        result.summary
          .reviewRecordsNormalised

      combinedSummary.approvalsReopened +=
        result.summary
          .approvalsReopened

      combinedSummary.notes.push(
        ...result.summary
          .notes,
      )
    }

    combinedSummary.changedKeys =
      [
        ...new Set(
          combinedSummary.changedKeys,
        ),
      ]

    const completedAt =
      new Date()
        .toISOString()

    const validation =
      inspectSnapshot(
        workingSnapshot,
      )

    if (
      validation.issueCount >
      0
    ) {
      return {
        ok:
          false,

        recoveryRequired:
          true,

        error:
          `The migration completed its conversion steps but ${validation.issueCount} compatibility issue${validation.issueCount === 1 ? "" : "s"} remain.`,

        snapshotPath:
          snapshotResult.path,

        validation,
      }
    }

    workingSnapshot[
      dataSchemaStorageKey
    ] =
      JSON.stringify({
        version:
          currentDataSchemaVersion,

        applicationVersion:
          "0.3.1",

        lastCheckedAt:
          validation.checkedAt,

        lastValidation:
          validation,

        lastMigration: {
          fromVersion,
          toVersion:
            currentDataSchemaVersion,

          completedAt,

          snapshotPath:
            snapshotResult.path,

          changedKeyCount:
            combinedSummary
              .changedKeys
              .length,

          warning:
            snapshotResult.warning ||
            "",
        },
      })

    applyBreakVeilStorage(
      workingSnapshot,
    )

    appendMigrationHistory({
      fromVersion,

      toVersion:
        currentDataSchemaVersion,

      completedAt,

      snapshotPath:
        snapshotResult.path,

      summary:
        combinedSummary,
    })

    const completeResult =
      await completeMigrationRecord({
        fromVersion,

        toVersion:
          currentDataSchemaVersion,

        snapshotPath:
          snapshotResult.path,

        summary:
          combinedSummary,
      })

    if (
      completeResult &&
      !completeResult.ok
    ) {
      console.warn(
        "The migration completed, but the backend migration record could not be updated:",
        completeResult.error,
      )
    }

    window.dispatchEvent(
      new Event(
        "jobpilot:data-schema-updated",
      ),
    )

    return {
      ok:
        true,

      migrated:
        true,

      fromVersion,

      currentVersion:
        currentDataSchemaVersion,

      snapshotPath:
        snapshotResult.path,

      snapshotWarning:
        snapshotResult.warning ||
        "",

      summary:
        combinedSummary,

      validation,
    }
  } catch (error) {
    try {
      applyBreakVeilStorage(
        originalSnapshot,
      )
    } catch {
      // The backend snapshot remains available if renderer rollback fails.
    }

    return {
      ok:
        false,

      error:
        error?.message ||
        "The local data migration could not be completed.",

      snapshotPath:
        snapshotResult.path,
    }
  }
}

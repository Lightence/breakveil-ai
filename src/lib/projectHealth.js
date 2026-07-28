function safeCount(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10)

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function check(id, label, status, detail) {
  return {
    id,
    label,
    status,
    detail,
  }
}

export function buildProjectHealthReport({
  checkedAt,
  currentSchemaVersion,
  schemaMetadata,
  schemaValidation,
  backupStatus,
  recoveryStatus,
  migrationStatus,
  encryptionAvailable,
  bridges,
} = {}) {
  const expectedSchema = safeCount(currentSchemaVersion)
  const storedSchema = safeCount(schemaMetadata?.version)
  const dataIssueCount = safeCount(schemaValidation?.issueCount)
  const documentIssueCount = safeCount(
    recoveryStatus?.documentIntegrity?.issueCount,
  )
  const automaticBackupCount = safeCount(backupStatus?.automaticBackupCount)
  const snapshotCount = safeCount(migrationStatus?.snapshotCount)
  const requiredBridges = [
    "dataManagement",
    "dataRecovery",
    "dataMigrations",
    "documents",
    "jobSources",
  ]
  const missingBridges = requiredBridges.filter(
    (bridgeName) => bridges?.[bridgeName] !== true,
  )
  const safeMode = recoveryStatus?.safeMode?.active === true
  const backupFrequency = String(
    backupStatus?.settings?.automaticFrequency || "disabled",
  )

  const checks = [
    check(
      "desktop-services",
      "Desktop services",
      missingBridges.length === 0 ? "pass" : "fail",
      missingBridges.length === 0
        ? "All protected desktop services are available."
        : `${missingBridges.length} protected desktop service${missingBridges.length === 1 ? " is" : "s are"} unavailable.`,
    ),
    check(
      "data-schema",
      "Local data compatibility",
      storedSchema === expectedSchema && dataIssueCount === 0 ? "pass" : "fail",
      storedSchema !== expectedSchema
        ? `Stored schema v${storedSchema} does not match supported schema v${expectedSchema}.`
        : dataIssueCount === 0
          ? `Schema v${expectedSchema} is current and valid.`
          : `${dataIssueCount} local data issue${dataIssueCount === 1 ? " was" : "s were"} detected.`,
    ),
    check(
      "resume-library",
      "Resume Library integrity",
      recoveryStatus?.documentIntegrity?.critical
        ? "fail"
        : documentIssueCount > 0
          ? "warning"
          : "pass",
      documentIssueCount === 0
        ? "The document index and stored files agree."
        : `${documentIssueCount} document reference issue${documentIssueCount === 1 ? " needs" : "s need"} attention.`,
    ),
    check(
      "credential-protection",
      "Credential protection",
      encryptionAvailable === true ? "pass" : "fail",
      encryptionAvailable === true
        ? "Operating-system credential encryption is available."
        : "Operating-system credential encryption is unavailable.",
    ),
    check(
      "recovery-mode",
      "Recovery mode",
      safeMode ? "warning" : "pass",
      safeMode
        ? "Safe mode is active while local data is checked."
        : "BreakVeil is running normally.",
    ),
    check(
      "automatic-backups",
      "Automatic backups",
      backupFrequency === "disabled" || automaticBackupCount === 0
        ? "warning"
        : "pass",
      backupFrequency === "disabled"
        ? "Automatic backups are disabled."
        : automaticBackupCount === 0
          ? "Automatic backups are enabled, but no completed backup is available yet."
          : `${automaticBackupCount} automatic backup${automaticBackupCount === 1 ? " is" : "s are"} available.`,
    ),
    check(
      "migration-snapshots",
      "Migration recovery",
      bridges?.dataMigrations === true ? "pass" : "fail",
      snapshotCount > 0
        ? `${snapshotCount} migration safety snapshot${snapshotCount === 1 ? " is" : "s are"} available.`
        : "The migration service is available; a snapshot will be created before one is needed.",
    ),
  ]

  const failedCount = checks.filter((item) => item.status === "fail").length
  const warningCount = checks.filter(
    (item) => item.status === "warning",
  ).length

  return {
    format: "jobpilot-privacy-safe-diagnostics",
    formatVersion: 1,
    checkedAt: String(checkedAt || new Date().toISOString()),
    overallStatus:
      failedCount > 0 ? "needs-attention" : warningCount > 0 ? "ready-with-notes" : "healthy",
    summary: {
      checkCount: checks.length,
      passedCount: checks.length - failedCount - warningCount,
      warningCount,
      failedCount,
    },
    environment: {
      platform: "desktop",
      supportedSchemaVersion: expectedSchema,
      storedSchemaVersion: storedSchema,
    },
    counts: {
      localDataIssues: dataIssueCount,
      documentIssues: documentIssueCount,
      automaticBackups: automaticBackupCount,
      migrationSnapshots: snapshotCount,
      recoveryQuarantines: safeCount(recoveryStatus?.quarantineCount),
    },
    protections: {
      operatingSystemEncryption: encryptionAvailable === true,
      safeModeActive: safeMode,
      automaticBackupsEnabled: backupFrequency !== "disabled",
    },
    checks,
    privacyNotice:
      "This report contains status flags and counts only. It excludes names, email addresses, job details, document contents, credentials and local file paths.",
  }
}

export function formatPrivacySafeDiagnostics(report) {
  const safeReport = buildProjectHealthReport({
    checkedAt: report?.checkedAt,
    currentSchemaVersion: report?.environment?.supportedSchemaVersion,
    schemaMetadata: {
      version: report?.environment?.storedSchemaVersion,
    },
    schemaValidation: {
      issueCount: report?.counts?.localDataIssues,
    },
    backupStatus: {
      automaticBackupCount: report?.counts?.automaticBackups,
      settings: {
        automaticFrequency: report?.protections?.automaticBackupsEnabled
          ? "enabled"
          : "disabled",
      },
    },
    recoveryStatus: {
      quarantineCount: report?.counts?.recoveryQuarantines,
      documentIntegrity: {
        issueCount: report?.counts?.documentIssues,
        critical:
          report?.checks?.find((item) => item.id === "resume-library")
            ?.status === "fail",
      },
      safeMode: {
        active: report?.protections?.safeModeActive,
      },
    },
    migrationStatus: {
      snapshotCount: report?.counts?.migrationSnapshots,
    },
    encryptionAvailable: report?.protections?.operatingSystemEncryption,
    bridges: Object.fromEntries(
      ["dataManagement", "dataRecovery", "dataMigrations", "documents", "jobSources"].map(
        (bridgeName) => [
          bridgeName,
          report?.checks?.find((item) => item.id === "desktop-services")
            ?.status !== "fail",
        ],
      ),
    ),
  })

  return JSON.stringify(safeReport, null, 2)
}

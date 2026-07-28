import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  Archive,
  BellOff,
  BriefcaseBusiness,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  GitBranch,
  ExternalLink,
  FileArchive,
  FileJson,
  FileWarning,
  FolderOpen,
  HardDrive,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  Trash2,
  Upload,
} from "lucide-react"

import ConfirmDialog from "./ConfirmDialog"

import {
  createEmptyJobSourceMap,
  mergeJobSourceMap,
} from "../lib/jobProviders"

import {
  formatPreferenceDateTime,
} from "../lib/uiPreferences"

import {
  applyBreakVeilStorage,
  buildServiceSummary,
  clearAllBreakVeilStorage,
  clearAssistantDrafts,
  clearJobActivityHistory,
  clearRecentSearches,
  collectBreakVeilStorage,
} from "../lib/dataManagement"

import {
  currentDataSchemaVersion,
  inspectBreakVeilData,
  readDataSchemaMetadata,
  recordDataValidation,
} from "../lib/dataSchema"

import {
  exitSafeMode,
  getRecoveryStatus,
  isSafeModeActive,
  openRecoveryFolder,
  repairResumeLibraryIndex,
  restoreLatestSafetySnapshot,
} from "../lib/dataRecovery"

import {
  buildProjectHealthReport,
  formatPrivacySafeDiagnostics,
} from "../lib/projectHealth"

const emptyDataStatus = {
  settings: {
    automaticFrequency:
      "disabled",

    retentionCount:
      5,

    lastAutomaticBackupAt:
      "",

    lastManualBackupAt:
      "",
  },

  userDataPath:
    "",

  backupsPath:
    "",

  automaticBackupCount:
    0,

  newestAutomaticBackupAt:
    "",

  backupSizeBytes:
    0,

  documentSizeBytes:
    0,
}

const emptySourceStatus = {
  sources:
    createEmptyJobSourceMap(),
}


const emptyGmailStatus = {
  configured:
    false,

  connected:
    false,

  email:
    "",
}

const backupFrequencyOptions = [
  [
    "disabled",
    "Disabled",
  ],
  [
    "daily",
    "Daily",
  ],
  [
    "weekly",
    "Weekly",
  ],
  [
    "monthly",
    "Monthly",
  ],
]

const backupRetentionOptions = [
  [
    3,
    "Keep 3 Backups",
  ],
  [
    5,
    "Keep 5 Backups",
  ],
  [
    10,
    "Keep 10 Backups",
  ],
  [
    20,
    "Keep 20 Backups",
  ],
]

function formatBytes(
  value,
) {
  const bytes =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <=
      0
  ) {
    return "0 KB"
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ]

  const unitIndex =
    Math.min(
      Math.floor(
        Math.log(
          bytes,
        ) /
          Math.log(
            1024,
          ),
      ),
      units.length -
        1,
    )

  const amount =
    bytes /
    1024 **
      unitIndex

  return `${amount.toFixed(
    amount >=
      10 ||
    unitIndex ===
      0
      ? 0
      : 1,
  )} ${units[unitIndex]}`
}

function formatStoredDate(
  value,
  fallback =
    "Not Yet",
) {
  return (
    formatPreferenceDateTime(
      value,
    ) ||
    fallback
  )
}

function ProjectHealthPanel({
  onMessage,
}) {
  const [report, setReport] =
    useState(null)

  const [isChecking, setIsChecking] =
    useState(false)

  const runHealthCheck = useCallback(async ({
    announce = false,
  } = {}) => {
    setIsChecking(true)

    try {
      const bridgeRoot =
        window.jobPilot ||
        {}

      const bridges = {
        dataManagement:
          typeof bridgeRoot
            .dataManagement
            ?.getStatus ===
          "function",

        dataRecovery:
          typeof bridgeRoot
            .dataRecovery
            ?.getStatus ===
          "function",

        dataMigrations:
          typeof bridgeRoot
            .dataMigrations
            ?.getStatus ===
          "function",

        documents:
          typeof bridgeRoot
            .documents
            ?.list ===
          "function",

        jobSources:
          typeof bridgeRoot
            .jobSources
            ?.getStatus ===
          "function",
      }

      const [
        backupResult,
        recoveryResult,
        migrationResult,
        sourceResult,
      ] =
        await Promise.allSettled([
          bridgeRoot
            .dataManagement
            ?.getStatus?.(),

          bridgeRoot
            .dataRecovery
            ?.getStatus?.(),

          bridgeRoot
            .dataMigrations
            ?.getStatus?.(),

          bridgeRoot
            .jobSources
            ?.getStatus?.(),
        ])

      function resultStatus(
        result,
      ) {
        if (
          result.status !==
          "fulfilled" ||
          result.value?.ok ===
            false
        ) {
          return {}
        }

        return (
          result.value
            ?.status ||
          result.value ||
          {}
        )
      }

      const sourceStatus =
        resultStatus(
          sourceResult,
        )

      const nextReport =
        buildProjectHealthReport({
          checkedAt:
            new Date()
              .toISOString(),

          currentSchemaVersion:
            currentDataSchemaVersion,

          schemaMetadata:
            readDataSchemaMetadata(),

          schemaValidation:
            inspectBreakVeilData(),

          backupStatus:
            resultStatus(
              backupResult,
            ),

          recoveryStatus:
            resultStatus(
              recoveryResult,
            ),

          migrationStatus:
            resultStatus(
              migrationResult,
            ),

          encryptionAvailable:
            sourceStatus
              .encryptionAvailable ===
            true,

          bridges,
        })

      setReport(
        nextReport,
      )

      if (announce) {
        onMessage?.(
          nextReport
            .overallStatus ===
            "healthy"
            ? "Project health check passed with no warnings."
            : nextReport
                .overallStatus ===
                "ready-with-notes"
              ? `Project health check passed with ${nextReport.summary.warningCount} note${nextReport.summary.warningCount === 1 ? "" : "s"}.`
              : `Project health check found ${nextReport.summary.failedCount} item${nextReport.summary.failedCount === 1 ? "" : "s"} needing attention.`,
        )
      }
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The project health check could not be completed.",
      )
    } finally {
      setIsChecking(false)
    }
  }, [onMessage])

  useEffect(() => {
    const startupTimer =
      window.setTimeout(
        () =>
          runHealthCheck(),
        0,
      )

    return () =>
      window.clearTimeout(
        startupTimer,
      )
  }, [runHealthCheck])

  async function copySafeReport() {
    if (!report) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        formatPrivacySafeDiagnostics(
          report,
        ),
      )

      onMessage?.(
        "Privacy-safe diagnostic report copied. It contains counts and status flags, not your personal application data.",
      )
    } catch {
      onMessage?.(
        "BreakVeil could not copy the diagnostic report.",
      )
    }
  }

  const overallStatus =
    report?.overallStatus ||
    "checking"

  return (
    <section
      id="project-health"
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <SectionHeader
        icon={ShieldCheck}
        title="Project Health Check"
        description="Check BreakVeil's safety systems before final packaging, without reading or sharing your personal application content."
      >
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
            overallStatus ===
            "needs-attention"
              ? "jp-tone-danger"
              : overallStatus ===
                  "ready-with-notes"
                ? "jp-tone-warning"
                : "jp-tone-success",
          ].join(" ")}
        >
          {overallStatus ===
          "needs-attention"
            ? "Needs Attention"
            : overallStatus ===
                "ready-with-notes"
              ? "Ready With Notes"
              : overallStatus ===
                  "healthy"
                ? "Healthy"
                : "Checking"}
        </span>
      </SectionHeader>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3 sm:p-6">
        {(report?.checks || []).map(
          (item) => (
            <div
              key={item.id}
              className={[
                "rounded-xl border p-4",
                item.status ===
                "fail"
                  ? "border-red-500/20 bg-red-500/5"
                  : item.status ===
                      "warning"
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-emerald-500/20 bg-emerald-500/5",
              ].join(" ")}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                {item.status ===
                "pass" ? (
                  <CheckCircle2
                    size={15}
                    className="text-emerald-300"
                  />
                ) : (
                  <ShieldAlert
                    size={15}
                    className={
                      item.status ===
                      "fail"
                        ? "text-red-300"
                        : "text-amber-300"
                    }
                  />
                )}
                {item.label}
              </p>

              <p className="mt-2 text-xs leading-5 text-zinc-500">
                {item.detail}
              </p>
            </div>
          ),
        )}

        {!report && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
            Checking BreakVeil's safety systems…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-2xl text-xs leading-5 text-zinc-600">
          The copied report excludes names, emails, job details, CV and cover-letter contents, credentials and local file paths.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copySafeReport}
            disabled={!report}
            className={secondaryButtonClass}
          >
            <FileJson size={15} />
            Copy Safe Report
          </button>

          <button
            type="button"
            onClick={() =>
              runHealthCheck({
                announce: true,
              })
            }
            disabled={isChecking}
            className={primaryButtonClass}
          >
            <RefreshCw
              size={15}
              className={
                isChecking
                  ? "animate-spin"
                  : ""
              }
            />
            Run Health Check
          </button>
        </div>
      </div>
    </section>
  )
}

function RecoveryCentrePanel({
  onMessage,
}) {
  const [
    status,
    setStatus,
  ] = useState({
    quarantineCount:
      0,

    latestSnapshot:
      null,

    documentIntegrity: {
      healthy:
        true,

      critical:
        false,

      canRepair:
        false,

      issueCount:
        0,

      issues:
        [],
    },

    safeMode:
      {},
  })

  const [
    busyAction,
    setBusyAction,
  ] = useState("")

  const [
    confirmation,
    setConfirmation,
  ] = useState("")

  async function loadStatus({
    announce =
      false,
  } = {}) {
    setBusyAction(
      "scan",
    )

    try {
      const recoveryStatus =
        await getRecoveryStatus()

      setStatus({
        quarantineCount:
          Number(
            recoveryStatus
              .quarantineCount ||
            0,
          ),

        latestSnapshot:
          recoveryStatus
            .latestSnapshot ||
          null,

        documentIntegrity:
          recoveryStatus
            .documentIntegrity ||
          {
            healthy:
              true,

            critical:
              false,

            canRepair:
              false,

            issueCount:
              0,

            issues:
              [],
          },

        safeMode:
          recoveryStatus
            .safeMode ||
          {},
      })

      if (
        announce
      ) {
        onMessage?.(
          recoveryStatus
            .documentIntegrity
            ?.issueCount
            ? `${recoveryStatus.documentIntegrity.issueCount} Resume Library issue${recoveryStatus.documentIntegrity.issueCount === 1 ? "" : "s"} detected.`
            : "Recovery scan completed with no Resume Library issues.",
        )
      }
    } catch (error) {
      onMessage?.(
        error?.message ||
        "BreakVeil could not load recovery status.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  useEffect(() => {
    loadStatus()

    function handleRecoveryUpdate() {
      loadStatus()
    }

    window.addEventListener(
      "jobpilot:recovery-updated",
      handleRecoveryUpdate,
    )

    window.addEventListener(
      "jobpilot:documents-updated",
      handleRecoveryUpdate,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:recovery-updated",
        handleRecoveryUpdate,
      )

      window.removeEventListener(
        "jobpilot:documents-updated",
        handleRecoveryUpdate,
      )
    }
  }, [])

  async function restoreSnapshot() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "restore",
    )

    try {
      await restoreLatestSafetySnapshot()

      onMessage?.(
        "The latest migration safety snapshot was restored. BreakVeil is restarting the local data check.",
      )

      window.setTimeout(
        () =>
          window.location.reload(),
        350,
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The latest migration safety snapshot could not be restored.",
      )

      setBusyAction(
        "",
      )
    }
  }

  async function repairDocuments() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "repair-documents",
    )

    try {
      const result =
        await repairResumeLibraryIndex()

      if (
        !result.repaired
      ) {
        onMessage?.(
          "The Resume Library index did not require an automatic repair.",
        )
      } else {
        onMessage?.(
          `Resume Library repair completed. ${result.summary?.removedEntries || 0} unusable reference${result.summary?.removedEntries === 1 ? "" : "s"} removed, with the original index preserved in Recovery.`,
        )
      }

      await loadStatus()
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The Resume Library index could not be repaired.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function openFolder() {
    try {
      await openRecoveryFolder()
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The recovery folder could not be opened.",
      )
    }
  }

  function leaveSafeMode() {
    exitSafeMode()

    onMessage?.(
      "Safe mode has been disabled. BreakVeil will reload normally; the quarantine copy is being kept as a safety backup.",
    )

    window.setTimeout(
      () =>
        window.location.reload(),
      250,
    )
  }

  const safeMode =
    Boolean(
      status.safeMode
        ?.active ||
      isSafeModeActive(),
    )

  const documentIssues =
    Number(
      status
        .documentIntegrity
        ?.issueCount ||
      0,
    )

  const latestSnapshot =
    status.latestSnapshot

  return (
    <section
      id="data-recovery-centre"
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-amber-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <SectionHeader
        icon={
          LifeBuoy
        }
        title="Recovery Centre"
        description="Inspect quarantined records, restore a migration snapshot and repair missing Resume Library references without silently resetting all BreakVeil data."
      >
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",

            safeMode ||
            documentIssues >
              0
              ? "jp-tone-warning"
              : "jp-tone-success",
          ].join(
            " ",
          )}
        >
          {safeMode
            ? "Safe Mode Active"
            : documentIssues >
                0
              ? `${documentIssues} Issue${documentIssues === 1 ? "" : "s"}`
              : "Healthy"}
        </span>
      </SectionHeader>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
        <StatusCard
          label="Application Mode"
          value={
            safeMode
              ? "Safe Mode"
              : "Normal"
          }
          detail={
            safeMode
              ? "Original values preserved in quarantine"
              : "No recovery restrictions active"
          }
          compact
        />

        <StatusCard
          label="Recovery Quarantines"
          value={
            status.quarantineCount
          }
          detail="Original local records captured before repair"
        />

        <StatusCard
          label="Latest Safety Snapshot"
          value={
            latestSnapshot
              ? formatStoredDate(
                  latestSnapshot.createdAt,
                )
              : "Not Available"
          }
          detail={
            latestSnapshot
              ? `${latestSnapshot.storageKeyCount} local storage keys`
              : "Created before data migrations"
          }
          compact
        />

        <StatusCard
          label="Resume Library"
          value={
            documentIssues ===
              0
              ? "Healthy"
              : `${documentIssues} Issue${documentIssues === 1 ? "" : "s"}`
          }
          detail={
            status
              .documentIntegrity
              ?.critical
              ? "Manual recovery or full backup required"
              : status
                  .documentIntegrity
                  ?.canRepair
                ? "Automatic index repair is available"
                : "Files and index references agree"
          }
          compact
        />
      </div>

      {(safeMode ||
        documentIssues >
          0) && (
        <div className="mx-5 mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.055] p-4 sm:mx-6 sm:mb-6">
          <div className="flex items-start gap-3">
            <ShieldAlert
              size={18}
              className="mt-0.5 shrink-0 text-amber-300"
            />

            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-100">
                Recovery Attention Required
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {safeMode
                  ? "BreakVeil is using repaired local structures. The original values remain in a quarantine file until you decide they are no longer needed."
                  : status
                      .documentIntegrity
                      ?.critical
                    ? "The Resume Library index is unreadable. Automatic repair is disabled so BreakVeil does not guess at document records."
                    : "One or more Resume Library references no longer point to a valid file or identifier."}
              </p>

              {documentIssues >
                0 && (
                <div className="mt-3 space-y-2">
                  {status
                    .documentIntegrity
                    ?.issues
                    ?.slice(
                      0,
                      4,
                    )
                    .map(
                      (
                        issue,
                        index,
                      ) => (
                        <div
                          key={`${issue.type}-${index}`}
                          className="flex items-start gap-2 text-xs leading-5 text-zinc-600"
                        >
                          <FileWarning
                            size={13}
                            className="mt-0.5 shrink-0 text-amber-300"
                          />

                          <span>
                            {
                              issue.message
                            }
                          </span>
                        </div>
                      ),
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 border-t border-zinc-800 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
        <ActionCard
          icon={
            ShieldCheck
          }
          title="Run Recovery Scan"
          description="Refresh local-data, snapshot and Resume Library integrity information."
          buttonLabel="Scan Now"
          loading={
            busyAction ===
            "scan"
          }
          onClick={() =>
            loadStatus({
              announce:
                true,
            })
          }
        />

        <ActionCard
          icon={
            RefreshCw
          }
          title="Restore Latest Snapshot"
          description="Replace current localStorage with the newest valid migration safety snapshot."
          buttonLabel="Restore Snapshot"
          loading={
            busyAction ===
            "restore"
          }
          onClick={() =>
            setConfirmation(
              "restore-snapshot",
            )
          }
        />

        <ActionCard
          icon={
            Wrench
          }
          title="Repair Resume Library Index"
          description="Back up the index, remove missing-file references and repair missing or duplicate identifiers."
          buttonLabel="Repair Index"
          loading={
            busyAction ===
            "repair-documents"
          }
          onClick={() =>
            setConfirmation(
              "repair-documents",
            )
          }
        />

        <ActionCard
          icon={
            FolderOpen
          }
          title="Open Recovery Folder"
          description="View quarantine files and Resume Library index backups stored locally."
          buttonLabel="Open Folder"
          onClick={
            openFolder
          }
        />
      </div>

      {safeMode && (
        <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-zinc-600">
            Leaving safe mode keeps the repaired records currently in BreakVeil. It does not delete the quarantine copy.
          </p>

          <button
            type="button"
            onClick={
              leaveSafeMode
            }
            className={secondaryButtonClass}
          >
            <ShieldCheck
              size={15}
            />
            Exit Safe Mode
          </button>
        </div>
      )}

      <ConfirmDialog
        open={
          confirmation ===
            "restore-snapshot"
        }
        title="Restore Latest Migration Snapshot?"
        message="This replaces current BreakVeil localStorage with the latest migration safety snapshot. Resume Library files and connected-service credentials are not changed."
        confirmLabel="Restore Snapshot"
        cancelLabel="Cancel"
        danger
        onConfirm={
          restoreSnapshot
        }
        onCancel={() =>
          setConfirmation(
            "",
          )
        }
      />

      <ConfirmDialog
        open={
          confirmation ===
            "repair-documents"
        }
        title="Repair Resume Library Index?"
        message="BreakVeil will preserve the original index in the Recovery folder, remove references to files that no longer exist, and repair missing or duplicate identifiers."
        confirmLabel="Repair Index"
        cancelLabel="Cancel"
        danger
        onConfirm={
          repairDocuments
        }
        onCancel={() =>
          setConfirmation(
            "",
          )
        }
      />
    </section>
  )
}

function DataCompatibilityPanel({
  onMessage,
}) {
  const [
    schemaMetadata,
    setSchemaMetadata,
  ] = useState(
    readDataSchemaMetadata,
  )

  const [
    migrationStatus,
    setMigrationStatus,
  ] = useState({
    snapshotCount:
      0,

    newestSnapshot:
      null,

    snapshotFolder:
      "",
  })

  const [
    isChecking,
    setIsChecking,
  ] = useState(false)

  async function loadCompatibilityStatus() {
    setSchemaMetadata(
      readDataSchemaMetadata(),
    )

    try {
      const result =
        await window.jobPilot
          ?.dataMigrations
          ?.getStatus?.()

      if (
        result?.ok
      ) {
        setMigrationStatus({
          snapshotCount:
            Number(
              result.status
                ?.snapshotCount ||
              0,
            ),

          newestSnapshot:
            result.status
              ?.newestSnapshot ||
            null,

          snapshotFolder:
            result.status
              ?.snapshotFolder ||
            "",
        })
      }
    } catch {
      // The local schema metadata remains available without backend status.
    }
  }

  useEffect(() => {
    loadCompatibilityStatus()

    function handleSchemaUpdate() {
      loadCompatibilityStatus()
    }

    window.addEventListener(
      "jobpilot:data-schema-updated",
      handleSchemaUpdate,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:data-schema-updated",
        handleSchemaUpdate,
      )
    }
  }, [])

  function runCompatibilityCheck() {
    setIsChecking(
      true,
    )

    try {
      const validation =
        inspectBreakVeilData()

      const metadata =
        recordDataValidation(
          validation,
        )

      setSchemaMetadata(
        metadata,
      )

      onMessage?.(
        validation.issueCount ===
          0
          ? `Local data is compatible with schema v${currentDataSchemaVersion}.`
          : `${validation.issueCount} compatibility issue${validation.issueCount === 1 ? "" : "s"} detected. BreakVeil has not deleted or reset the affected data.`,
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The local data compatibility check could not be completed.",
      )
    } finally {
      setIsChecking(
        false,
      )
    }
  }

  async function openSnapshotFolder() {
    try {
      const result =
        await window.jobPilot
          ?.dataMigrations
          ?.openFolder?.()

      if (
        result &&
        !result.ok
      ) {
        throw new Error(
          result.error ||
          "The migration snapshot folder could not be opened.",
        )
      }
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The migration snapshot folder could not be opened.",
      )
    }
  }

  const issueCount =
    Number(
      schemaMetadata
        .lastValidation
        ?.issueCount ||
      0,
    )

  const current =
    schemaMetadata.version ===
    currentDataSchemaVersion

  return (
    <section
      id="data-compatibility"
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <SectionHeader
        icon={
          GitBranch
        }
        title="Data Compatibility and Migrations"
        description="BreakVeil versions your local data so future updates can change stored records without silently overwriting older information."
      >
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",

            current &&
            issueCount ===
              0
              ? "jp-tone-success"
              : "jp-tone-warning",
          ].join(
            " ",
          )}
        >
          {current
            ? `Schema v${schemaMetadata.version}`
            : `Schema v${schemaMetadata.version || 0} → v${currentDataSchemaVersion}`}
        </span>
      </SectionHeader>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
        <StatusCard
          label="Supported Schema"
          value={`v${currentDataSchemaVersion}`}
          detail="Used by this BreakVeil build"
          compact
        />

        <StatusCard
          label="Stored Data Schema"
          value={`v${schemaMetadata.version || 0}`}
          detail={
            current
              ? "Current and compatible"
              : "Migration required before normal use"
          }
          compact
        />

        <StatusCard
          label="Last Compatibility Check"
          value={
            formatStoredDate(
              schemaMetadata.lastCheckedAt,
            )
          }
          detail={
            issueCount ===
              0
              ? "No structural issues detected"
              : `${issueCount} issue${issueCount === 1 ? "" : "s"} detected`
          }
          compact
        />

        <StatusCard
          label="Migration Safety Snapshots"
          value={
            migrationStatus.snapshotCount
          }
          detail={
            migrationStatus.newestSnapshot
              ?.createdAt
              ? `Newest ${formatStoredDate(
                  migrationStatus.newestSnapshot
                    .createdAt,
                )}`
              : "Created before schema changes"
          }
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-zinc-400">
            Migration protection
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Unknown fields are preserved. A file-based safety snapshot is created before migration, and an older BreakVeil build will refuse to overwrite data created by a newer schema.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={
              openSnapshotFolder
            }
            className={secondaryButtonClass}
          >
            <FolderOpen
              size={15}
            />
            Open Snapshots
          </button>

          <button
            type="button"
            onClick={
              runCompatibilityCheck
            }
            disabled={
              isChecking
            }
            className={primaryButtonClass}
          >
            {isChecking ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : (
              <ShieldCheck
                size={15}
              />
            )}
            Check Compatibility
          </button>
        </div>
      </div>
    </section>
  )
}

export function DataRecoverySettings({
  onMessage,
  onResetAppearance,
}) {
  const [
    status,
    setStatus,
  ] = useState(
    emptyDataStatus,
  )

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    busyAction,
    setBusyAction,
  ] = useState("")

  const [
    confirmation,
    setConfirmation,
  ] = useState("")

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setIsLoading(
      true,
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.getStatus?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "Backup controls are unavailable. Fully restart BreakVeil.",
        )
      }

      setStatus({
        ...emptyDataStatus,
        ...(result.status ||
          {}),

        settings: {
          ...emptyDataStatus.settings,
          ...(result.status
            ?.settings ||
            {}),
        },
      })
    } catch (error) {
      onMessage?.(
        error?.message ||
        "BreakVeil could not load backup settings.",
      )
    } finally {
      setIsLoading(
        false,
      )
    }
  }

  async function updateBackupSettings(
    changes,
  ) {
    setBusyAction(
      "backup-settings",
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.updateSettings?.(
            changes,
          )

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The backup setting could not be saved.",
        )
      }

      let nextStatus = {
        ...emptyDataStatus,
        ...(result.status ||
          {}),

        settings: {
          ...emptyDataStatus.settings,
          ...(result.status
            ?.settings ||
            {}),
        },
      }

      if (
        changes.automaticFrequency &&
        changes.automaticFrequency !==
          "disabled"
      ) {
        const automaticResult =
          await window.jobPilot
            ?.dataManagement
            ?.runAutomaticBackup?.(
              collectBreakVeilStorage(),
            )

        if (
          automaticResult?.ok &&
          automaticResult.status
        ) {
          nextStatus = {
            ...emptyDataStatus,
            ...automaticResult.status,

            settings: {
              ...emptyDataStatus.settings,
              ...(automaticResult.status
                .settings ||
                {}),
            },
          }
        }
      }

      setStatus(
        nextStatus,
      )

      onMessage?.(
        changes.automaticFrequency &&
        changes.automaticFrequency !==
          "disabled"
          ? "Backup schedule saved and checked immediately."
          : "Backup settings saved.",
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The backup setting could not be saved.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function createBackup() {
    setBusyAction(
      "create-backup",
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.createBackup?.(
            collectBreakVeilStorage(),
          )

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The backup could not be created.",
        )
      }

      if (
        result.canceled
      ) {
        return
      }

      if (
        result.status
      ) {
        setStatus({
          ...emptyDataStatus,
          ...result.status,

          settings: {
            ...emptyDataStatus.settings,
            ...(result.status
              .settings ||
              {}),
          },
        })
      }

      onMessage?.(
        `Backup created successfully with ${result.backup?.documentCount || 0} Resume Library document${result.backup?.documentCount === 1 ? "" : "s"}.`,
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The backup could not be created.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function restoreBackup() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "restore-backup",
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.restoreBackup?.(
            collectBreakVeilStorage(),
          )

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The backup could not be restored.",
        )
      }

      if (
        result.canceled
      ) {
        return
      }

      applyBreakVeilStorage(
        result.rendererStorage ||
          {},
      )

      onMessage?.(
        "Backup restored. BreakVeil is refreshing the restored data.",
      )

      window.setTimeout(
        () =>
          window.location.reload(),
        450,
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The backup could not be restored.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function exportAllData() {
    setBusyAction(
      "export",
    )

    try {
      const [
        gmailResult,
        sourceResult,
      ] =
        await Promise.all([
          window.jobPilot
            ?.gmail
            ?.getStatus?.(),
          window.jobPilot
            ?.jobSources
            ?.getStatus?.(),
        ])

      const result =
        await window.jobPilot
          ?.dataManagement
          ?.exportAll?.({
            rendererStorage:
              collectBreakVeilStorage(),

            serviceSummary:
              buildServiceSummary({
                gmailStatus:
                  gmailResult?.ok
                    ? gmailResult
                    : emptyGmailStatus,

                sourceStatus:
                  sourceResult?.ok
                    ? sourceResult
                        .status ||
                      sourceResult
                    : emptySourceStatus,
              }),
          })

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "BreakVeil data could not be exported.",
        )
      }

      if (
        result.canceled
      ) {
        return
      }

      onMessage?.(
        `BreakVeil data was exported to ${result.exportPath}.`,
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "BreakVeil data could not be exported.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function openStorageLocation() {
    setBusyAction(
      "open-storage",
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.openStorage?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The local storage folder could not be opened.",
        )
      }
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The local storage folder could not be opened.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function clearSearchCache() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "clear-cache",
    )

    try {
      const result =
        await window.jobPilot
          ?.jobSources
          ?.clearCache?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The job-search cache could not be cleared.",
        )
      }

      onMessage?.(
        "The job-search cache has been cleared.",
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The job-search cache could not be cleared.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  function clearActivityHistory() {
    setConfirmation(
      "",
    )

    const jobCount =
      clearJobActivityHistory()

    onMessage?.(
      `Activity history was cleared from ${jobCount} tracked job${jobCount === 1 ? "" : "s"}.`,
    )
  }

  function resetAppearance() {
    setConfirmation(
      "",
    )

    onResetAppearance?.()
  }

  async function resetAllApplicationData() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "reset-all",
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.resetApplicationData?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "BreakVeil data could not be reset.",
        )
      }

      clearAllBreakVeilStorage()

      onMessage?.(
        "Application data reset. BreakVeil is returning to first-run defaults.",
      )

      window.setTimeout(
        () =>
          window.location.reload(),
        450,
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "BreakVeil data could not be reset.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  const confirmationDetails =
    useMemo(
      () => {
        const details = {
          "restore-backup": {
            title:
              "Restore a BreakVeil backup?",

            message:
              "The selected backup will replace current jobs, profile, application packages, preferences and Resume Library documents. BreakVeil creates a safety backup of the current data before restoring.",

            confirmLabel:
              "Choose and Restore Backup",

            onConfirm:
              restoreBackup,
          },

          "clear-cache": {
            title:
              "Clear the job-search cache?",

            message:
              "Cached search results will be removed. Connected job sources and saved vacancies are not affected.",

            confirmLabel:
              "Clear Search Cache",

            onConfirm:
              clearSearchCache,
          },

          "clear-activity": {
            title:
              "Clear all job activity history?",

            message:
              "Timeline entries will be removed from every tracked job. Job details, statuses, notes and applications remain unchanged.",

            confirmLabel:
              "Clear Activity History",

            onConfirm:
              clearActivityHistory,
          },

          "reset-appearance": {
            title:
              "Reset appearance and accessibility?",

            message:
              "Theme, scale, scrollbars, spacing, focus indicators and other appearance preferences will return to their defaults.",

            confirmLabel:
              "Reset Appearance",

            onConfirm:
              resetAppearance,
          },

          "reset-all": {
            title:
              "Reset all BreakVeil application data?",

            message:
              "This removes jobs, profile information, documents, applications, Assistant drafts, discovery data, activity history and preferences. Existing backup files and connected-service authorisations are preserved.",

            confirmLabel:
              "Reset All Application Data",

            onConfirm:
              resetAllApplicationData,
          },
        }

        return details[
          confirmation
        ] ||
        null
      },
      [
        confirmation,
      ],
    )

  return (
    <>
      <ProjectHealthPanel
        onMessage={
          onMessage
        }
      />

      <RecoveryCentrePanel
        onMessage={
          onMessage
        }
      />

      <DataCompatibilityPanel
        onMessage={
          onMessage
        }
      />

      <section id="data-overview" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            HardDrive
          }
          title="Backup Overview"
          description="Protect locally stored jobs, profile data, applications and Resume Library documents."
        >
          <button
            type="button"
            onClick={
              loadStatus
            }
            disabled={
              isLoading
            }
            className={secondaryButtonClass}
          >
            <RefreshCw
              size={15}
              className={
                isLoading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </SectionHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <StatusCard
            label="Automatic Backups"
            value={
              status.automaticBackupCount
            }
            detail={`Stored locally • ${formatBytes(
              status.backupSizeBytes,
            )}`}
          />

          <StatusCard
            label="Last Automatic Backup"
            value={
              formatStoredDate(
                status.settings
                  .lastAutomaticBackupAt,
              )
            }
            compact
            detail={
              status.settings
                .automaticFrequency ===
              "disabled"
                ? "Automatic backups are disabled"
                : `${status.settings.automaticFrequency} schedule`
            }
          />

          <StatusCard
            label="Last Manual Backup"
            value={
              formatStoredDate(
                status.settings
                  .lastManualBackupAt,
              )
            }
            compact
            detail="Created through Settings"
          />

          <StatusCard
            label="Resume Library Size"
            value={
              formatBytes(
                status.documentSizeBytes,
              )
            }
            detail="Included in restorable backups"
          />
        </div>

        <div className="border-t border-zinc-800 px-5 py-4 text-xs leading-5 text-zinc-600 sm:px-6">
          Backup files contain personal job-search information and documents. They are compressed but not password-encrypted. API credentials and Gmail authorisation tokens are excluded.
        </div>
      </section>

      <div className="jp-grid-equal mt-6 grid gap-6 xl:grid-cols-2">
        <section id="data-backup-restore" className="scroll-mt-28 h-fit overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
          <SectionHeader
            icon={
              Archive
            }
            title="Backup and Restore"
            description="Create a portable backup or restore an earlier BreakVeil state."
          />

          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            <ActionCard
              icon={
                Download
              }
              title="Create Backup"
              description="Choose where to save a restorable .jobpilot-backup file."
              buttonLabel="Create Backup"
              loading={
                busyAction ===
                "create-backup"
              }
              onClick={
                createBackup
              }
            />

            <ActionCard
              icon={
                Upload
              }
              title="Restore Backup"
              description="Replace current data with a selected backup after creating a safety copy."
              buttonLabel="Restore Backup"
              onClick={() =>
                setConfirmation(
                  "restore-backup",
                )
              }
            />
          </div>
        </section>

        <section id="data-automatic-backups" className="scroll-mt-28 h-fit overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
          <SectionHeader
            icon={
              FileArchive
            }
            title="Automatic Backups"
            description="BreakVeil checks the schedule while the application is running."
          />

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <label className="block">
              <span className={labelClass}>
                Backup Frequency
              </span>

              <select
                value={
                  status.settings
                    .automaticFrequency
                }
                disabled={
                  busyAction ===
                  "backup-settings"
                }
                onChange={(event) =>
                  updateBackupSettings({
                    automaticFrequency:
                      event.target.value,
                  })
                }
                className={selectClass}
              >
                {backupFrequencyOptions.map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>
                Backups to Retain
              </span>

              <select
                value={
                  status.settings
                    .retentionCount
                }
                disabled={
                  busyAction ===
                  "backup-settings"
                }
                onChange={(event) =>
                  updateBackupSettings({
                    retentionCount:
                      Number(
                        event.target.value,
                      ),
                  })
                }
                className={selectClass}
              >
                {backupRetentionOptions.map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="border-t border-zinc-800 px-5 py-4 text-xs leading-5 text-zinc-600 sm:px-6">
            Automatic backups are stored in BreakVeil's local backups folder. Older automatic files are removed according to the retention limit; manual and pre-restore safety backups are never removed automatically.
          </div>
        </section>
      </div>

      <section id="data-export-storage" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            FileJson
          }
          title="Export and Storage Location"
          description="Create a readable export or inspect where BreakVeil stores information on this computer."
        />

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <ActionRow
            icon={
              FileJson
            }
            title="Export All BreakVeil Data"
            description="Creates a readable JSON export with a documents folder. Credentials and OAuth tokens are excluded."
            buttonLabel="Export Data"
            loading={
              busyAction ===
              "export"
            }
            onClick={
              exportAllData
            }
          />

          <ActionRow
            icon={
              FolderOpen
            }
            title="Show Local Storage Location"
            description={
              status.userDataPath ||
              "Open the Windows folder containing BreakVeil's local application data."
            }
            buttonLabel="Open Folder"
            loading={
              busyAction ===
              "open-storage"
            }
            onClick={
              openStorageLocation
            }
          />
        </div>
      </section>

      <section id="data-cleanup-reset" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-red-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            Trash2
          }
          title="Data Cleanup and Reset"
          description="Remove selected local records. Every destructive action asks for confirmation first."
          danger
        />

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <DangerAction
            icon={
              Database
            }
            title="Clear Search Cache"
            description="Removes cached provider results without deleting saved jobs."
            onClick={() =>
              setConfirmation(
                "clear-cache",
              )
            }
          />

          <DangerAction
            icon={
              BriefcaseBusiness
            }
            title="Clear Activity History"
            description="Removes timeline entries from every tracked job."
            onClick={() =>
              setConfirmation(
                "clear-activity",
              )
            }
          />

          <DangerAction
            icon={
              RotateCcw
            }
            title="Reset Appearance Only"
            description="Restores theme, scale and accessibility preferences."
            onClick={() =>
              setConfirmation(
                "reset-appearance",
              )
            }
          />

          <DangerAction
            icon={
              Trash2
            }
            title="Reset All Application Data"
            description="Removes local BreakVeil content while preserving backups and service authorisations."
            severe
            onClick={() =>
              setConfirmation(
                "reset-all",
              )
            }
          />
        </div>
      </section>

      <ConfirmDialog
        open={
          Boolean(
            confirmationDetails,
          )
        }
        title={
          confirmationDetails
            ?.title ||
          "Confirm Action"
        }
        message={
          confirmationDetails
            ?.message ||
          ""
        }
        confirmLabel={
          confirmationDetails
            ?.confirmLabel ||
          "Confirm"
        }
        cancelLabel="Cancel"
        danger
        onConfirm={
          confirmationDetails
            ?.onConfirm ||
          (() => {})
        }
        onCancel={() =>
          setConfirmation(
            "",
          )
        }
      />
    </>
  )
}

export function PrivacySettings({
  onMessage,
  onConnectionsChanged,
}) {
  const [
    gmailStatus,
    setGmailStatus,
  ] = useState(
    emptyGmailStatus,
  )

  const [
    sourceStatus,
    setSourceStatus,
  ] = useState(
    emptySourceStatus,
  )

  const [
    dataStatus,
    setDataStatus,
  ] = useState(
    emptyDataStatus,
  )

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    busyAction,
    setBusyAction,
  ] = useState("")

  const [
    confirmation,
    setConfirmation,
  ] = useState("")

  useEffect(() => {
    loadPrivacyStatus()
  }, [])

  async function loadPrivacyStatus() {
    setIsLoading(
      true,
    )

    try {
      const [
        gmailResult,
        sourceResult,
        dataResult,
      ] =
        await Promise.all([
          window.jobPilot
            ?.gmail
            ?.getStatus?.(),
          window.jobPilot
            ?.jobSources
            ?.getStatus?.(),
          window.jobPilot
            ?.dataManagement
            ?.getStatus?.(),
        ])

      setGmailStatus({
        ...emptyGmailStatus,
        ...(gmailResult?.ok
          ? gmailResult
          : {}),
      })

      const safeSourceStatus =
        sourceResult?.ok
          ? sourceResult.status ||
            sourceResult
          : emptySourceStatus

      setSourceStatus({
        ...emptySourceStatus,
        ...safeSourceStatus,

        sources:
          mergeJobSourceMap(
            safeSourceStatus.sources,
          ),
      })

      if (
        dataResult?.ok
      ) {
        setDataStatus({
          ...emptyDataStatus,
          ...(dataResult.status ||
            {}),
        })
      }
    } catch (error) {
      onMessage?.(
        error?.message ||
        "Connected-service status could not be loaded.",
      )
    } finally {
      setIsLoading(
        false,
      )
    }
  }

  function clearSearchHistory() {
    setConfirmation(
      "",
    )

    clearRecentSearches()

    onMessage?.(
      "Stored discovery search history was cleared. Your current discovery settings were preserved.",
    )
  }

  function clearDrafts() {
    setConfirmation(
      "",
    )

    clearAssistantDrafts()

    onMessage?.(
      "Assistant vacancy drafts, handoffs and the latest local analysis were cleared.",
    )
  }

  async function clearGmailLogs() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "clear-gmail-logs",
    )

    try {
      const result =
        await window.jobPilot
          ?.dataManagement
          ?.clearGmailLogs?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "Gmail sending logs could not be cleared.",
        )
      }

      window.dispatchEvent(
        new Event(
          "jobpilot:gmail-logs-updated",
        ),
      )

      onMessage?.(
        "Local Gmail sending logs were cleared. Gmail remains connected.",
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "Gmail sending logs could not be cleared.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function revokeAllAuthorisations() {
    setConfirmation(
      "",
    )

    setBusyAction(
      "revoke-all",
    )

    const failures =
      []

    try {
      const gmailResult =
        await window.jobPilot
          ?.gmail
          ?.disconnect?.()

      if (
        gmailResult &&
        !gmailResult.ok
      ) {
        failures.push(
          gmailResult.error ||
          "Gmail could not be disconnected.",
        )
      }

      for (
        const source
        of [
          "reed",
          "adzuna",
          "jooble",
        ]
      ) {
        if (
          !sourceStatus.sources
            ?.[source]
            ?.configured
        ) {
          continue
        }

        const sourceResult =
          await window.jobPilot
            ?.jobSources
            ?.removeSource?.(
              source,
            )

        if (
          sourceResult &&
          !sourceResult.ok
        ) {
          failures.push(
            sourceResult.error ||
            `${source} credentials could not be removed.`,
          )
        }
      }

      await loadPrivacyStatus()
      await onConnectionsChanged?.()

      if (
        failures.length >
        0
      ) {
        onMessage?.(
          `Some authorisations could not be removed: ${failures.join(" ")}`,
        )
      } else {
        onMessage?.(
          "Gmail authorisation and stored job-source credentials were removed.",
        )
      }
    } catch (error) {
      onMessage?.(
        error?.message ||
        "Stored authorisations could not be removed.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  const connectedServiceCount =
    [
      gmailStatus.connected,
      ...Object.values(
        sourceStatus.sources,
      ).map(
        (source) =>
          source.connectionMode !==
            "public" &&
          source.configured,
      ),
    ].filter(
      Boolean,
    ).length

  const confirmationDetails = {
    "clear-searches": {
      title:
        "Clear recent search history?",

      message:
        "Stored automatic-discovery search history and recent discovery events will be removed. Your configured discovery schedule and filters remain unchanged.",

      confirmLabel:
        "Clear Search History",

      onConfirm:
        clearSearchHistory,
    },

    "clear-assistant": {
      title:
        "Clear Assistant drafts?",

      message:
        "The current Assistant vacancy draft, latest analysis, imported handoff and unsaved tailoring draft will be removed. Saved jobs and application packages remain unchanged.",

      confirmLabel:
        "Clear Assistant Drafts",

      onConfirm:
        clearDrafts,
    },

    "clear-gmail-logs": {
      title:
        "Clear Gmail sending logs?",

      message:
        "Local records of manual and automatic Gmail delivery attempts will be deleted. Gmail drafts, sent emails and the Gmail connection are not affected.",

      confirmLabel:
        "Clear Gmail Logs",

      onConfirm:
        clearGmailLogs,
    },

    "revoke-all": {
      title:
        "Revoke all stored authorisations?",

      message:
        "BreakVeil will disconnect Gmail, revoke its OAuth token where possible and remove encrypted Reed, Adzuna and Jooble credentials from this computer. Jobs, documents and backups remain unchanged.",

      confirmLabel:
        "Revoke All Authorisations",

      onConfirm:
        revokeAllAuthorisations,
    },
  }[
    confirmation
  ] ||
  null

  return (
    <>
      <section id="privacy-overview" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            LockKeyhole
          }
          title="Local Privacy Overview"
          description="See what BreakVeil stores locally and when connected services receive information."
        >
          <button
            type="button"
            onClick={
              loadPrivacyStatus
            }
            disabled={
              isLoading
            }
            className={secondaryButtonClass}
          >
            <RefreshCw
              size={15}
              className={
                isLoading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </SectionHeader>

        <div className="grid gap-3 p-5 md:grid-cols-3 sm:p-6">
          <PrivacySummaryCard
            icon={
              HardDrive
            }
            title="Local Application Data"
            description="Jobs, profile details, application packages, Assistant drafts, discovery results, preferences and activity history stay inside BreakVeil's local application storage."
          />

          <PrivacySummaryCard
            icon={
              ShieldCheck
            }
            title="Local Documents"
            description={`Resume Library files remain on this computer inside ${dataStatus.userDataPath || "BreakVeil's local data folder"}.`}
          />

          <PrivacySummaryCard
            icon={
              CloudOff
            }
            title="No Analytics or Crash Reporting"
            description="This BreakVeil build does not send anonymous usage analytics, advertising identifiers or crash reports to a developer service."
          />
        </div>

        <div className="border-t border-zinc-800 px-5 py-4 text-xs leading-5 text-zinc-600 sm:px-6">
          Information leaves the computer only when you search an enabled job provider, connect Gmail, create a Gmail draft, send an approved draft or open an external website.
        </div>
      </section>

      <section id="privacy-permissions" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            KeyRound
          }
          title="Connected Services and Permissions"
          description={`${connectedServiceCount} connected service${connectedServiceCount === 1 ? "" : "s"} currently hold authorisation inside BreakVeil.`}
        />

        <div className="divide-y divide-zinc-800">
          <ServicePermissionRow
            icon={
              Mail
            }
            name="Gmail"
            connected={
              gmailStatus.connected
            }
            status={
              gmailStatus.connected
                ? gmailStatus.email ||
                  "Connected"
                : gmailStatus.configured
                  ? "Not Connected"
                  : "OAuth Client Not Configured"
            }
            permission="Uses Gmail's compose permission to create and send drafts you approve or explicitly queue. It does not request inbox-reading access."
            storage="An OAuth token is stored locally until Gmail is disconnected."
          />

          <ServicePermissionRow
            icon={
              BriefcaseBusiness
            }
            name="Reed"
            connected={
              Boolean(
                sourceStatus.sources
                  .reed
                  .configured,
              )
            }
            status={
              sourceStatus.sources
                .reed
                .configured
                ? "Connected"
                : "Not Connected"
            }
            permission="Searches Reed's official vacancy API and loads job details. It cannot submit applications."
            storage="The API key is encrypted with Windows protected storage."
          />

          <ServicePermissionRow
            icon={
              BriefcaseBusiness
            }
            name="Adzuna"
            connected={
              Boolean(
                sourceStatus.sources
                  .adzuna
                  .configured,
              )
            }
            status={
              sourceStatus.sources
                .adzuna
                .configured
                ? "Connected"
                : "Not Connected"
            }
            permission="Searches Adzuna's official vacancy API. It cannot submit applications or retrieve a full advert when the API supplies only a summary."
            storage="The Application ID and key are encrypted with Windows protected storage."
          />

          <ServicePermissionRow
            icon={
              BriefcaseBusiness
            }
            name="Jooble"
            connected={
              Boolean(
                sourceStatus.sources
                  .jooble
                  .configured,
              )
            }
            status={
              sourceStatus.sources
                .jooble
                .configured
                ? "Connected"
                : "Not Connected"
            }
            permission="Searches Jooble's official REST API. BreakVeil receives vacancy metadata and a description snippet, then opens the original listing for full details."
            storage="The Jooble API key is encrypted with Windows protected storage."
          />

          <ServicePermissionRow
            icon={
              BriefcaseBusiness
            }
            name="Arbeitnow (Germany)"
            connected={
              Boolean(
                sourceStatus.sources
                  .arbeitnow
                  .configured,
              )
            }
            status={
              sourceStatus.sources
                .arbeitnow
                .configured
                ? "Public Source Available"
                : "Unavailable"
            }
            permission="Searches Arbeitnow's public Germany-focused vacancy API. BreakVeil filters likely German-language listings and skips ordinary UK location searches. It can retrieve full descriptions and original listing links, but it cannot submit applications."
            storage="No API key or account credential is stored for this source."
          />
          <ServicePermissionRow
            icon={
              BriefcaseBusiness
            }
            name="Jobicy (Remote)"
            connected={
              Boolean(
                sourceStatus.sources
                  .jobicy
                  .configured,
              )
            }
            status={
              sourceStatus.sources
                .jobicy
                .configured
                ? "Public Source Available"
                : "Unavailable"
            }
            permission="Searches Jobicy's public remote-jobs API for broad remote regions. It can retrieve full descriptions, salary fields when supplied and original listing links, but it cannot submit applications."
            storage="No API key is stored. BreakVeil keeps a local shared feed cache for up to one hour to avoid excessive requests."
          />

          <ServicePermissionRow
            icon={
              BriefcaseBusiness
            }
            name="Remotive (Remote)"
            connected={
              Boolean(
                sourceStatus.sources
                  .remotive
                  .configured,
              )
            }
            status={
              sourceStatus.sources
                .remotive
                .configured
                ? "Public Source Available"
                : "Unavailable"
            }
            permission="Searches Remotive's public remote-jobs API. BreakVeil preserves the required Remotive attribution and original listing link; it cannot submit applications."
            storage="No API key is stored. The shared feed is cached for six hours because Remotive recommends only a few requests per day."
          />
        </div>
      </section>

      <section id="privacy-cleanup" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            Sparkles
          }
          title="Local History and Draft Cleanup"
          description="Remove selected local records without deleting saved jobs, documents or connected-service credentials."
        />

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3 sm:p-6">
          <DangerAction
            icon={
              SearchX
            }
            title="Clear Recent Searches"
            description="Removes stored discovery history while preserving the active discovery schedule."
            onClick={() =>
              setConfirmation(
                "clear-searches",
              )
            }
          />

          <DangerAction
            icon={
              Sparkles
            }
            title="Clear Assistant Drafts"
            description="Removes the current vacancy draft, latest analysis and unsaved tailoring content."
            onClick={() =>
              setConfirmation(
                "clear-assistant",
              )
            }
          />

          <DangerAction
            icon={
              BellOff
            }
            title="Clear Gmail Sending Logs"
            description="Removes local delivery history without disconnecting Gmail."
            loading={
              busyAction ===
              "clear-gmail-logs"
            }
            onClick={() =>
              setConfirmation(
                "clear-gmail-logs",
              )
            }
          />
        </div>
      </section>

      <section id="privacy-authorisations" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/[0.04] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SectionHeader
          icon={
            KeyRound
          }
          title="Authorisation Control"
          description="Disconnect external services and remove locally stored access credentials."
          danger
        />

        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="font-medium text-zinc-200">
              Revoke All Stored Authorisations
            </p>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Disconnects Gmail and removes encrypted Reed, Adzuna and Jooble credentials. Your BreakVeil data, Resume Library and backup files are not deleted.
            </p>
          </div>

          <button
            type="button"
            disabled={
              busyAction ===
              "revoke-all"
            }
            onClick={() =>
              setConfirmation(
                "revoke-all",
              )
            }
            className={dangerButtonClass}
          >
            {busyAction ===
            "revoke-all" ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <KeyRound
                size={16}
              />
            )}
            Revoke All
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={
          Boolean(
            confirmationDetails,
          )
        }
        title={
          confirmationDetails
            ?.title ||
          "Confirm Privacy Action"
        }
        message={
          confirmationDetails
            ?.message ||
          ""
        }
        confirmLabel={
          confirmationDetails
            ?.confirmLabel ||
          "Confirm"
        }
        cancelLabel="Cancel"
        danger
        onConfirm={
          confirmationDetails
            ?.onConfirm ||
          (() => {})
        }
        onCancel={() =>
          setConfirmation(
            "",
          )
        }
      />
    </>
  )
}

function SectionHeader({
  icon:
    Icon,
  title,
  description,
  children,
  danger =
    false,
}) {
  return (
    <header
      className={[
        "relative flex flex-col gap-4 overflow-hidden border-b px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6",

        danger
          ? "border-red-500/15 bg-red-500/[0.025]"
          : "border-zinc-800 bg-zinc-950/20",
      ].join(
        " ",
      )}
    >
      <div
        className={[
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",

          danger
            ? "via-red-500/35"
            : "via-sky-500/30",
        ].join(
          " ",
        )}
      />

      <div className="flex min-w-0 items-start gap-3">
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm",

            danger
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-300",
          ].join(
            " ",
          )}
        >
          <Icon
            size={19}
          />
        </div>

        <div className="min-w-0">
          <h2
            className={[
              "font-semibold",

              danger
                ? "text-red-100"
                : "text-zinc-100",
            ].join(
              " ",
            )}
          >
            {title}
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
            {description}
          </p>
        </div>
      </div>

      {children && (
        <div className="shrink-0">
          {children}
        </div>
      )}
    </header>
  )
}

function StatusCard({
  label,
  value,
  detail,
  compact =
    false,
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-sky-400" />

        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
          {label}
        </p>
      </div>

      <p
        className={[
          "mt-3 break-words font-semibold text-zinc-200",

          compact
            ? "text-sm leading-6"
            : "text-2xl",
        ].join(
          " ",
        )}
      >
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {detail}
      </p>
    </article>
  )
}

function ActionCard({
  icon:
    Icon,
  title,
  description,
  buttonLabel,
  loading =
    false,
  onClick,
}) {
  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/60">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
        <Icon
          size={17}
        />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-zinc-200">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-xs leading-5 text-zinc-600">
        {description}
      </p>

      <button
        type="button"
        disabled={
          loading
        }
        onClick={
          onClick
        }
        className={`${primaryButtonClass} mt-4 w-full`}
      >
        {loading ? (
          <LoaderCircle
            size={16}
            className="animate-spin"
          />
        ) : (
          <Icon
            size={16}
          />
        )}
        {buttonLabel}
      </button>
    </article>
  )
}

function ActionRow({
  icon:
    Icon,
  title,
  description,
  buttonLabel,
  loading =
    false,
  onClick,
}) {
  return (
    <article className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400">
          <Icon
            size={17}
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-200">
            {title}
          </h3>

          <p className="mt-1 break-words text-xs leading-5 text-zinc-600">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={
          loading
        }
        onClick={
          onClick
        }
        className={`${secondaryButtonClass} w-full shrink-0 sm:w-auto`}
      >
        {loading ? (
          <LoaderCircle
            size={16}
            className="animate-spin"
          />
        ) : (
          <ExternalLink
            size={16}
          />
        )}
        {buttonLabel}
      </button>
    </article>
  )
}

function DangerAction({
  icon:
    Icon,
  title,
  description,
  loading =
    false,
  severe =
    false,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={
        loading
      }
      onClick={
        onClick
      }
      className={[
        "group min-w-0 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50",

        severe
          ? "border-red-500/30 bg-red-500/10 hover:border-red-500/40 hover:bg-red-500/15"
          : "border-zinc-800 bg-zinc-900/40 hover:border-red-500/20 hover:bg-red-500/[0.05]",
      ].join(
        " ",
      )}
    >
      <div
        className={[
          "flex h-9 w-9 items-center justify-center rounded-xl border transition",

          severe
            ? "border-red-500/25 bg-red-500/10 text-red-300"
            : "border-zinc-700 bg-zinc-900 text-zinc-500 group-hover:border-red-500/20 group-hover:text-red-300",
        ].join(
          " ",
        )}
      >
        {loading ? (
          <LoaderCircle
            size={16}
            className="animate-spin"
          />
        ) : (
          <Icon
            size={16}
          />
        )}
      </div>

      <p className="mt-3 text-sm font-semibold text-zinc-200">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </button>
  )
}

function PrivacySummaryCard({
  icon:
    Icon,
  title,
  description,
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-emerald-500/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
        <Icon
          size={17}
        />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-zinc-200">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </article>
  )
}

function ServicePermissionRow({
  icon:
    Icon,
  name,
  connected,
  status,
  permission,
  storage,
}) {
  return (
    <article className="grid gap-4 px-5 py-5 transition hover:bg-zinc-950/20 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",

            connected
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-500",
          ].join(
            " ",
          )}
        >
          <Icon
            size={17}
          />
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-zinc-200">
            {name}
          </p>

          <span
            className={[
              "mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",

              connected
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-500",
            ].join(
              " ",
            )}
          >
            {connected && (
              <CheckCircle2
                size={12}
              />
            )}
            {status}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Permission
          </p>

          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {permission}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
            Local Storage
          </p>

          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {storage}
          </p>
        </div>
      </div>
    </article>
  )
}

const labelClass =
  "mb-2 block text-xs font-medium text-zinc-400"

const selectClass =
  "h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition hover:border-zinc-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"

const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:-translate-y-px hover:bg-zinc-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-zinc-700 disabled:text-zinc-400"

const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/30 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"

const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-500/40 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"

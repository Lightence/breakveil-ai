import {
  useEffect,
  useState,
} from "react"

import {
  AlertTriangle,
  Database,
  FileWarning,
  FolderOpen,
  LifeBuoy,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import {
  currentDataSchemaVersion,
  inspectBreakVeilData,
  runStartupDataMigration,
} from "../lib/dataSchema"

import {
  consumeSafeModeStartupRequest,
  enterSafeMode,
  exitSafeMode,
  getRecoveryStatus,
  isSafeModeActive,
  openRecoveryFolder,
  restoreLatestSafetySnapshot,
} from "../lib/dataRecovery"

const storageLabels = {
  "jobpilot.jobs":
    "Tracked Jobs",

  "jobpilot.application-queue":
    "Application Review Queue",

  "jobpilot.candidate-profile":
    "Candidate Profile",

  "jobpilot.application-tailoring":
    "Application Tailoring",

  "jobpilot.match-inbox-decisions":
    "Smart Match Decisions",

  "jobpilot.discovery-settings":
    "Automatic Job Discovery Settings",

  "jobpilot.discovery-results":
    "Smart Match Results",

  "jobpilot.discovery-history":
    "Automatic Job Discovery History",

  "jobpilot.ui-preferences":
    "Interface Preferences",
}

function friendlyIssueLabel(
  issue,
) {
  return (
    storageLabels[
      issue?.key
    ] ||
    issue?.key ||
    "Local BreakVeil Data"
  )
}

function friendlyIssueAction(
  issue,
) {
  if (
    issue?.type ===
    "invalid-json"
  ) {
    return "The stored value cannot be read as JSON. Safe Repair will quarantine the original value before replacing only the unreadable container."
  }

  if (
    issue?.type ===
    "unexpected-container"
  ) {
    return "The stored value has the wrong internal shape. Safe Repair will preserve the original value and convert the affected container to the structure BreakVeil expects."
  }

  if (
    issue?.type ===
    "missing-id"
  ) {
    return "A saved record is missing its internal identifier. Safe Repair will preserve the record and generate a stable identifier."
  }

  if (
    issue?.type ===
    "invalid-item"
  ) {
    return "A stored list contains an entry BreakVeil cannot safely interpret. The original list will be quarantined before incompatible entries are isolated."
  }

  return "BreakVeil will preserve the original data in Recovery Quarantine before attempting a safe repair."
}

export default function DataMigrationGate({
  children,
}) {
  const navigate =
    useNavigate()

  const [
    state,
    setState,
  ] = useState({
    status:
      "checking",

    result:
      null,
  })

  const [
    recoveryStatus,
    setRecoveryStatus,
  ] = useState(null)

  const [
    busyAction,
    setBusyAction,
  ] = useState("")

  async function loadRecoveryStatus() {
    try {
      const status =
        await getRecoveryStatus()

      setRecoveryStatus(
        status,
      )

      return status
    } catch {
      setRecoveryStatus(
        null,
      )

      return null
    }
  }

  async function runMigration() {
    setState({
      status:
        "checking",

      result:
        null,
    })

    setBusyAction(
      "",
    )

    try {
      const safeModeRequest =
        consumeSafeModeStartupRequest()

      if (
        safeModeRequest
          ?.requestedAt
      ) {
        const validation =
          inspectBreakVeilData()

        await enterSafeMode({
          issues:
            validation.issues,

          reason:
            safeModeRequest.reason ||
            "Renderer recovery was requested.",
        })
      }

      const result =
        await runStartupDataMigration()

      const currentRecoveryStatus =
        await loadRecoveryStatus()

      if (
        result.ok
      ) {
        if (
          isSafeModeActive() &&
          Number(
            result.validation
              ?.issueCount ||
            0,
          ) ===
            0
        ) {
          exitSafeMode()
        }

        setState({
          status:
            "ready",

          result: {
            ...result,

            documentIntegrity:
              currentRecoveryStatus
                ?.documentIntegrity ||
              null,
          },
        })

        return
      }

      setState({
        status:
          result.incompatible
            ? "incompatible"
            : result.recoveryRequired
              ? "recovery"
              : "failed",

        result,
      })
    } catch (error) {
      await loadRecoveryStatus()

      setState({
        status:
          "failed",

        result: {
          error:
            error?.message ||
            "BreakVeil could not prepare the local data.",
        },
      })
    }
  }

  useEffect(() => {
    runMigration()
  }, [])

  async function restoreSnapshot() {
    setBusyAction(
      "restore",
    )

    try {
      await restoreLatestSafetySnapshot()

      window.location.reload()
    } catch (error) {
      setState((current) => ({
        ...current,

        result: {
          ...(current.result ||
            {}),

          error:
            error?.message ||
            "The latest safety snapshot could not be restored.",
        },
      }))

      setBusyAction(
        "",
      )
    }
  }

  async function startSafeMode() {
    setBusyAction(
      "safe-mode",
    )

    try {
      await enterSafeMode({
        issues:
          state.result
            ?.validation
            ?.issues ||
          [],

        reason:
          state.result
            ?.error ||
          "BreakVeil entered safe mode after a startup data check.",
      })

      window.location.reload()
    } catch (error) {
      setState((current) => ({
        ...current,

        result: {
          ...(current.result ||
            {}),

          error:
            error?.message ||
            "BreakVeil could not start safe mode.",
        },
      }))

      setBusyAction(
        "",
      )
    }
  }

  async function openFolder() {
    try {
      await openRecoveryFolder()
    } catch (error) {
      setState((current) => ({
        ...current,

        result: {
          ...(current.result ||
            {}),

          error:
            error?.message ||
            "The recovery folder could not be opened.",
        },
      }))
    }
  }

  if (
    state.status ===
    "ready"
  ) {
    const documentIssues =
      Number(
        state.result
          ?.documentIntegrity
          ?.issueCount ||
        0,
      )

    const showRecoveryBanner =
      isSafeModeActive() ||
      documentIssues >
        0

    return (
      <>
        {children}

        {showRecoveryBanner && (
          <button
            type="button"
            onClick={() =>
              navigate(
                "/settings?category=data&section=data-recovery-centre",
              )
            }
            className="fixed right-5 top-20 z-[75] flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-2xl border border-amber-500/25 bg-[#151515] px-4 py-3 text-left shadow-[0_20px_55px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-amber-400/45"
          >
            <span className="jp-tone-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              {isSafeModeActive() ? (
                <ShieldAlert
                  size={17}
                />
              ) : (
                <FileWarning
                  size={17}
                />
              )}
            </span>

            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-100">
                {isSafeModeActive()
                  ? "Safe Mode Active"
                  : "Resume Library Needs Attention"}
              </span>

              <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                {isSafeModeActive()
                  ? "Original records are preserved in Recovery Quarantine."
                  : `${documentIssues} document issue${documentIssues === 1 ? "" : "s"} detected.`}
              </span>
            </span>
          </button>
        )}
      </>
    )
  }

  const checking =
    state.status ===
    "checking"

  const incompatible =
    state.status ===
    "incompatible"

  const recoveryRequired =
    state.status ===
    "recovery"

  const latestSnapshot =
    recoveryStatus
      ?.latestSnapshot

  const issueCount =
    Number(
      state.result
        ?.validation
        ?.issueCount ||
      0,
    )

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101010] p-5 text-white">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-2xl">
        <header className="border-b border-zinc-800 p-6">
          <div
            className={[
              "flex h-12 w-12 items-center justify-center rounded-2xl border",

              checking
                ? "jp-tone-document"
                : recoveryRequired
                  ? "jp-tone-warning"
                  : "jp-tone-danger",
            ].join(
              " ",
            )}
          >
            {checking ? (
              <Database
                size={20}
              />
            ) : recoveryRequired ? (
              <LifeBuoy
                size={20}
              />
            ) : (
              <AlertTriangle
                size={20}
              />
            )}
          </div>

          <h1 className="mt-4 text-xl font-semibold">
            {checking
              ? "Preparing Local BreakVeil Data"
              : incompatible
                ? "Newer Local Data Detected"
                : recoveryRequired
                  ? "BreakVeil Found Recoverable Data Issues"
                  : "Local Data Check Could Not Finish"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {checking
              ? "BreakVeil is checking the local data version before loading jobs, documents and application records."
              : state.result
                  ?.error ||
                "BreakVeil could not verify the local data safely."}
          </p>
        </header>

        <div className="p-6">
          {checking ? (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4">
              <LoaderCircle
                size={18}
                className="animate-spin text-indigo-300"
              />

              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Checking Data Schema v{currentDataSchemaVersion}
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  BreakVeil will not load pages until critical local records have been checked.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />

                  <div>
                    <p className="text-sm font-medium text-amber-100">
                      Your original records have not been silently deleted.
                    </p>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {incompatible
                        ? "Install the newer BreakVeil build that created this data before continuing."
                        : recoveryRequired
                          ? "The safest first choice is Repair Safely and Continue. BreakVeil will save the original affected values to Recovery Quarantine before changing anything."
                          : "Retry the check first. Recovery files remain available locally."}
                    </p>
                  </div>
                </div>
              </div>

              {issueCount >
                0 && (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    Detected Issues
                  </p>

                  <div className="mt-3 space-y-2">
                    {state.result
                      ?.validation
                      ?.issues
                      ?.slice(
                        0,
                        5,
                      )
                      .map(
                        (
                          issue,
                          index,
                        ) => (
                          <div
                            key={`${issue.key}-${issue.type}-${index}`}
                            className="flex items-start gap-2 text-xs leading-5 text-zinc-500"
                          >
                            <AlertTriangle
                              size={14}
                              className="mt-0.5 shrink-0 text-amber-300"
                            />

                            <span>
                              <span className="block font-medium text-zinc-300">
                                {friendlyIssueLabel(
                                  issue,
                                )}
                              </span>

                              <span className="mt-0.5 block">
                                {
                                  issue.message
                                }
                              </span>

                              <span className="mt-1 block text-zinc-600">
                                {friendlyIssueAction(
                                  issue,
                                )}
                              </span>
                            </span>
                          </div>
                        ),
                      )}
                  </div>
                </div>
              )}

              {latestSnapshot && (
                <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
                  <p className="text-sm font-medium text-indigo-200">
                    Latest Migration Safety Snapshot
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Created {new Date(
                      latestSnapshot.createdAt,
                    ).toLocaleString()} with {latestSnapshot.storageKeyCount} local storage key{latestSnapshot.storageKeyCount === 1 ? "" : "s"}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!checking && (
          <footer className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-4">
            {!incompatible && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={
                    restoreSnapshot
                  }
                  disabled={
                    !latestSnapshot ||
                    Boolean(
                      busyAction,
                    )
                  }
                  className="jp-button-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {busyAction ===
                  "restore" ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCw
                      size={16}
                    />
                  )}
                  Restore Latest Snapshot
                </button>

                <button
                  type="button"
                  onClick={
                    startSafeMode
                  }
                  disabled={
                    Boolean(
                      busyAction,
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction ===
                  "safe-mode" ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Wrench
                      size={16}
                    />
                  )}
                  Repair Safely and Continue
                </button>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  openFolder
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                <FolderOpen
                  size={16}
                />
                Open Recovery Folder
              </button>

              {!incompatible && (
                <button
                  type="button"
                  onClick={
                    runMigration
                  }
                  disabled={
                    Boolean(
                      busyAction,
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                  />
                  Retry Check
                </button>
              )}
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}

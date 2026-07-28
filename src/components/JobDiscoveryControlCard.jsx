import {
  useEffect,
  useMemo,
  useState,
} from "react"

import { useNavigate } from "react-router-dom"

import {
  AlertTriangle,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LoaderCircle,
  History,
  MapPin,
  Pause,
  Play,
  Radar,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"

import {
  defaultDiscoverySettings,
  getProfileDiscoveryDefaults,
  loadDiscoveryResults,
  loadDiscoveryRunHistory,
  loadDiscoverySettings,
  runJobDiscovery,
  saveDiscoverySettings,
} from "../lib/jobDiscovery"

import {
  createEmptyJobSourceMap,
  defaultDiscoverySourceIds,
  mergeJobSourceMap,
} from "../lib/jobProviders"

import {
  formatPreferenceDateTime,
  formatPreferenceDistance,
} from "../lib/uiPreferences"

const emptySourceStatus = {
  loading: true,
  error: "",
  sources:
    createEmptyJobSourceMap(),
}

function formatDateTime(
  value,
) {
  if (!value) {
    return "Not Run Yet"
  }

  return (
    formatPreferenceDateTime(
      value,
    ) ||
    "Not Available"
  )
}

function normaliseDraft(settings) {
  return {
    ...defaultDiscoverySettings,
    ...settings,
    sources: Array.isArray(settings?.sources)
      ? settings.sources
      : [
          ...defaultDiscoverySourceIds,
        ],
  }
}

function formatDuration(value) {
  const seconds = Math.max(0, Math.round(Number(value || 0) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

function runStatusLabel(status) {
  return status === "success"
    ? "Completed"
    : status === "partial"
      ? "Partly completed"
      : status === "cached"
        ? "Used recent results"
        : "Failed"
}

export default function JobDiscoveryControlCard() {
  const navigate = useNavigate()

  const [draft, setDraft] = useState(() =>
    normaliseDraft(loadDiscoverySettings()),
  )

  const [sourceStatus, setSourceStatus] = useState(
    emptySourceStatus,
  )

  const [newMatchCount, setNewMatchCount] = useState(
    () => loadDiscoveryResults().length,
  )

  const [runHistory, setRunHistory] = useState(
    () => loadDiscoveryRunHistory(),
  )

  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [showSettings, setShowSettings] = useState(false)

  const connectedSources = useMemo(
    () =>
      Object.entries(sourceStatus.sources)
        .filter(
          ([, details]) =>
            details?.configured &&
            (
              !(
                details?.custom ||
                details?.directEmployer
              ) ||
              details?.autoDiscoveryEnabled
            ),
        )
        .map(([source]) => source),
    [sourceStatus],
  )

  useEffect(() => {
    loadSourceStatus()

    function refreshSettings() {
      setDraft(normaliseDraft(loadDiscoverySettings()))
    }

    function refreshResults() {
      setNewMatchCount(loadDiscoveryResults().length)
      refreshSettings()
    }

    function refreshRunHistory() {
      setRunHistory(loadDiscoveryRunHistory())
    }

    window.addEventListener(
      "jobpilot:discovery-settings-updated",
      refreshSettings,
    )

    window.addEventListener(
      "jobpilot:discovery-updated",
      refreshResults,
    )

    window.addEventListener("focus", refreshResults)
    window.addEventListener(
      "jobpilot:discovery-run-history-updated",
      refreshRunHistory,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:discovery-settings-updated",
        refreshSettings,
      )

      window.removeEventListener(
        "jobpilot:discovery-updated",
        refreshResults,
      )

      window.removeEventListener("focus", refreshResults)
      window.removeEventListener(
        "jobpilot:discovery-run-history-updated",
        refreshRunHistory,
      )
    }
  }, [])

  async function loadSourceStatus() {
    setSourceStatus((current) => ({
      ...current,
      loading: true,
      error: "",
    }))

    try {
      if (!window.jobPilot?.jobSources?.getStatus) {
        throw new Error(
          "Job-search services are unavailable. Fully restart BreakVeil.",
        )
      }

      const result = await window.jobPilot.jobSources.getStatus()

      if (!result?.ok) {
        throw new Error(
          result?.error || "BreakVeil could not check job sources.",
        )
      }

      const nextSources =
        mergeJobSourceMap(
          result?.sources,
        )

      setSourceStatus({
        loading: false,
        error: "",
        sources: nextSources,
      })

      setDraft((current) => {
        const retainedSources =
          current.sources.filter(
            (source) =>
              nextSources[source]
                ?.configured &&
              (
                !(
                  nextSources[source]
                    ?.custom ||
                  nextSources[source]
                    ?.directEmployer
                ) ||
                nextSources[source]
                  ?.autoDiscoveryEnabled
              ),
          )

        const preferredDefaults =
          defaultDiscoverySourceIds.filter(
            (source) =>
              nextSources[source]
                ?.configured,
          )

        const availableSources =
          Object.entries(
            nextSources,
          )
            .filter(
              ([, details]) =>
                details.configured &&
                (
                  !(
                    details.custom ||
                    details.directEmployer
                  ) ||
                  details.autoDiscoveryEnabled
                ),
            )
            .map(
              ([source]) =>
                source,
            )

        return {
          ...current,
          sources:
            retainedSources.length >
            0
              ? retainedSources
              : preferredDefaults.length >
                  0
                ? preferredDefaults
                : availableSources,
        }
      })
    } catch (error) {
      setSourceStatus({
        ...emptySourceStatus,
        loading: false,
        error:
          error?.message || "BreakVeil could not check job sources.",
      })
    }
  }

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
    setMessage("")
  }

  function toggleSource(source) {
    const details =
      sourceStatus.sources[source]

    if (
      !details?.configured ||
      (
        (
          details.custom ||
          details.directEmployer
        ) &&
        !details.autoDiscoveryEnabled
      )
    ) {
      return
    }

    setDraft((current) => {
      const selected = current.sources.includes(source)

      return {
        ...current,
        sources: selected
          ? current.sources.filter((item) => item !== source)
          : [...current.sources, source],
      }
    })
  }

  function applyProfileDefaults() {
    const defaults = getProfileDiscoveryDefaults()

    setDraft((current) => ({
      ...current,
      keywords: defaults.keywords || current.keywords,
      locations: defaults.locations || current.locations,
      minimumSalary:
        defaults.minimumSalary || current.minimumSalary,
    }))

    setMessage(
      "Target roles, preferred locations and minimum salary were copied from Candidate Profile.",
    )
  }

  function persistDraft(changes = {}) {
    return saveDiscoverySettings({
      ...draft,
      ...changes,
    })
  }

  async function saveSettings() {
    setIsSaving(true)

    try {
      const saved = persistDraft()
      setDraft(normaliseDraft(saved))
      setMessage("Background job-discovery settings saved.")
    } finally {
      setIsSaving(false)
    }
  }

  async function startDiscovery() {
    if (draft.sources.length === 0) {
      setMessage("Select at least one connected job source.")
      return
    }

    const saved = persistDraft({
      enabled: true,
      nextRunAt: new Date().toISOString(),
    })

    setDraft(normaliseDraft(saved))
    setMessage("Background job discovery is active.")

    await runNow({
      settingsOverride: saved,
      trigger: "manual",
    })
  }

  function pauseDiscovery() {
    const saved = persistDraft({
      enabled: false,
    })

    setDraft(normaliseDraft(saved))
    setMessage("Background job discovery has been paused.")
  }

  async function runNow({
    settingsOverride = null,
    trigger = "manual",
    retryOf = "",
  } = {}) {
    const activeSettings = settingsOverride || draft

    if (activeSettings.sources.length === 0) {
      setMessage("Select at least one connected job source.")
      return
    }

    saveDiscoverySettings(activeSettings)
    setIsRunning(true)
    setMessage("Searching connected job sources and ranking vacancies...")

    try {
      const result = await runJobDiscovery({
        forceRefresh: true,
        trigger,
        retryOf,
      })

      setNewMatchCount(result.totalCount)
      setDraft(normaliseDraft(result.settings))

      if (
        result.mode ===
        "offline-cache"
      ) {
        setMessage(
          result.newCount >
            0
            ? `${result.newCount} unseen match${result.newCount === 1 ? "" : "es"} found from retained cached searches while providers were unavailable.`
            : "Providers were unavailable. BreakVeil checked retained cached searches and kept existing matches unchanged.",
        )
      } else if (
        result.mode ===
        "partial"
      ) {
        setMessage(
          result.newCount >
            0
            ? `${result.newCount} new profile match${result.newCount === 1 ? "" : "es"} found from the providers that responded.`
            : "Partial search complete. Existing matches were kept and unavailable providers can retry later.",
        )
      } else {
        setMessage(
          result.newCount >
            0
            ? `${result.newCount} new profile match${result.newCount === 1 ? "" : "es"} found.`
            : "Search complete. No unseen vacancies met the current match threshold.",
        )
      }
    } catch (error) {
      setDraft(normaliseDraft(loadDiscoverySettings()))
      setMessage(
        error?.message || "Background job discovery could not complete.",
      )
    } finally {
      setIsRunning(false)
    }
  }

  async function retryRun(entry) {
    setMessage("Running the discovery search again with your current settings...")
    await runNow({
      trigger: "retry",
      retryOf: entry.id,
    })
  }

  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <header className="flex flex-col gap-5 border-b border-zinc-800 px-4 py-5 sm:px-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="jp-tone-automation flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12">
            <Radar size={21} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                Automatic Job Discovery
              </h2>

              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                  draft.enabled
                    ? "jp-tone-automation"
                    : "jp-tone-neutral",
                ].join(" ")}
              >
                {draft.enabled ? (
                  <Play size={12} />
                ) : (
                  <Pause size={12} />
                )}

                {draft.enabled
                  ? "Running"
                  : "Paused"}
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              Searches connected job sources while BreakVeil is open, ranks unseen vacancies against Candidate Profile and sends suitable matches to Discover Jobs. It never applies or sends email automatically.
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap xl:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate(
                "/jobs",
              )
            }
            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-200 transition hover:bg-sky-500/20 sm:px-4"
          >
            <BriefcaseBusiness
              size={16}
              className="shrink-0"
            />

            <span className="truncate">
              View {newMatchCount} Match{newMatchCount === 1 ? "" : "es"}
            </span>
          </button>

          <button
            type="button"
            disabled={
              isRunning ||
              connectedSources.length ===
                0
            }
            onClick={() =>
              runNow()
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          >
            {isRunning ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <RefreshCw
                size={16}
              />
            )}

            {isRunning
              ? "Searching"
              : "Run Now"}
          </button>
        </div>
      </header>

      {message && (
        <div className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-6 text-zinc-300 sm:px-6">
          {message}
        </div>
      )}

      {sourceStatus.error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300 sm:px-6">
          {sourceStatus.error}
        </div>
      )}

      <div className="p-4 sm:p-6">
        <div className="jp-grid-compact grid gap-3">
          <StatCard
            icon={BellRing}
            label="Unseen Matches"
            value={newMatchCount}
          />

          <StatCard
            icon={Clock3}
            label="Last Search"
            value={
              formatDateTime(
                draft.lastRunAt,
              )
            }
            compact
          />

          <StatCard
            icon={Radar}
            label="Next Search"
            value={
              draft.enabled
                ? formatDateTime(
                    draft.nextRunAt,
                  )
                : "Paused"
            }
            compact
          />

          <StatCard
            icon={ShieldCheck}
            label="Last Search Mode"
            value={
              draft.lastRunMode ===
                "offline-cache"
                ? "Offline Cache"
                : draft.lastRunMode ===
                    "partial"
                  ? "Partial"
                  : draft.lastRunMode ===
                      "failed" ||
                    draft.lastRunMode ===
                      "offline"
                    ? "Failed"
                    : draft.lastRunMode ===
                        "live"
                      ? "Live"
                      : "Not Run Yet"
            }
            compact
          />
        </div>

        <button
          type="button"
          onClick={() =>
            setShowSettings((current) => !current)
          }
          aria-expanded={showSettings}
          aria-controls="automatic-discovery-settings"
          className="mt-5 flex w-full items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/70"
        >
          <span>
            {showSettings
              ? "Hide discovery settings"
              : "Show discovery settings"}
          </span>

          <ChevronDown
            size={17}
            aria-hidden="true"
            className={[
              "shrink-0 transition-transform",
              showSettings ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {showSettings && (
        <div
          id="automatic-discovery-settings"
          role="region"
          aria-label="Automatic discovery settings"
        >
        <div className="jp-grid-panels mt-4 gap-4">
          <div className="min-w-0 space-y-4">
            <DiscoveryModule
              icon={Search}
              title="Search Profile"
              description="Set custom search terms or copy the latest values from Candidate Profile."
              action={
                <button
                  type="button"
                  onClick={
                    applyProfileDefaults
                  }
                  className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 sm:w-auto"
                >
                  Use Profile Defaults
                </button>
              }
            >
              <div className="grid gap-4">
                <label className="block">
                  <span className={labelClass}>
                    Target Roles or Keywords
                  </span>

                  <textarea
                    rows="4"
                    value={
                      draft.keywords
                    }
                    onChange={(event) =>
                      updateDraft(
                        "keywords",
                        event.target.value,
                      )
                    }
                    placeholder="Administrator, Accounts Assistant, IT Support"
                    className={textareaClass}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>
                    Preferred Locations
                  </span>

                  <input
                    value={
                      draft.locations
                    }
                    onChange={(event) =>
                      updateDraft(
                        "locations",
                        event.target.value,
                      )
                    }
                    placeholder="Preston, Blackpool, Remote"
                    className={inputClass}
                  />
                </label>
              </div>
            </DiscoveryModule>

            <DiscoveryModule
              icon={ShieldCheck}
              title="Connected Sources"
              description="Only configured providers can be selected for scheduled searches."
            >
              <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                {Object.entries(
                  sourceStatus.sources,
                ).map(
                  ([
                    source,
                    details,
                  ]) => {
                    const selected =
                      draft.sources.includes(
                        source,
                      )

                    return (
                      <button
                        key={
                          source
                        }
                        type="button"
                        aria-pressed={
                          selected
                        }
                        disabled={
                          !details.configured ||
                          (
                            (
                              details.custom ||
                              details.directEmployer
                            ) &&
                            !details.autoDiscoveryEnabled
                          ) ||
                          sourceStatus.loading
                        }
                        onClick={() =>
                          toggleSource(
                            source,
                          )
                        }
                        className={[
                          "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
                          selected &&
                          details.configured
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                            : "border-zinc-700 text-zinc-500 hover:bg-zinc-800",
                        ].join(" ")}
                      >
                        {selected &&
                          details.configured && (
                            <CheckCircle2
                              size={14}
                              className="shrink-0"
                            />
                          )}

                        <span className="truncate">
                          {details.name ||
                            source}
                        </span>
                      </button>
                    )
                  },
                )}
              </div>

              {draft.sources.includes(
                "arbeitnow",
              ) && (
                <p className="mt-3 rounded-lg border border-sky-500/15 bg-sky-500/[0.05] px-3 py-2 text-xs leading-5 text-sky-200/80">
                  Arbeitnow is Germany-focused. Automatic Discovery only uses it when a preferred location is blank or refers to Germany, Europe or International searches, and likely German-language listings are hidden.
                </p>
              )}

              {(draft.sources.includes("jobicy") ||
                draft.sources.includes("remotive")) && (
                <p className="mt-3 rounded-lg border border-violet-500/15 bg-violet-500/[0.05] px-3 py-2 text-xs leading-5 text-violet-200/80">
                  Jobicy and Remotive are remote-only. Add Remote, UK, Europe, EMEA or Worldwide to Preferred Locations so scheduled searches can use them; they remain disabled by default.
                </p>
              )}

              <p className="mt-3 text-xs leading-5 text-zinc-600">
                {connectedSources.length > 0
                  ? `${connectedSources.length} connected source${connectedSources.length === 1 ? "" : "s"} available.`
                  : "Enable at least one available job source before starting discovery."}
              </p>
            </DiscoveryModule>
          </div>

          <div className="min-w-0 space-y-4">
            <DiscoveryModule
              icon={SlidersHorizontal}
              title="Schedule and Matching"
              description="Control how often discovery runs and how closely a vacancy must match."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>
                    Search Frequency
                  </span>

                  <select
                    value={
                      draft.intervalMinutes
                    }
                    onChange={(event) =>
                      updateDraft(
                        "intervalMinutes",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="60">
                      Every Hour
                    </option>
                    <option value="180">
                      Every 3 Hours
                    </option>
                    <option value="360">
                      Every 6 Hours
                    </option>
                    <option value="720">
                      Every 12 Hours
                    </option>
                    <option value="1440">
                      Once Per Day
                    </option>
                  </select>
                </label>

                <label>
                  <span className={labelClass}>
                    Minimum Profile Match
                  </span>

                  <select
                    value={
                      draft.minimumMatch
                    }
                    onChange={(event) =>
                      updateDraft(
                        "minimumMatch",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="50">
                      50% — Possible
                    </option>
                    <option value="60">
                      60%
                    </option>
                    <option value="70">
                      70% — Good
                    </option>
                    <option value="80">
                      80%
                    </option>
                    <option value="85">
                      85% — Strong
                    </option>
                    <option value="90">
                      90%
                    </option>
                  </select>
                </label>

                <label>
                  <span className={labelClass}>
                    Distance
                  </span>

                  <select
                    value={
                      draft.distance
                    }
                    onChange={(event) =>
                      updateDraft(
                        "distance",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    {[5, 10, 15, 20, 30, 50].map(
                      (distance) => (
                        <option
                          key={
                            distance
                          }
                          value={
                            distance
                          }
                        >
                          {formatPreferenceDistance(
                            distance,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>
                    Date Posted
                  </span>

                  <select
                    value={
                      draft.postedWithinDays
                    }
                    onChange={(event) =>
                      updateDraft(
                        "postedWithinDays",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="1">
                      Past 24 Hours
                    </option>
                    <option value="3">
                      Past 3 Days
                    </option>
                    <option value="7">
                      Past Week
                    </option>
                    <option value="14">
                      Past 2 Weeks
                    </option>
                    <option value="30">
                      Past Month
                    </option>
                    <option value="0">
                      Any Time
                    </option>
                  </select>
                </label>
              </div>
            </DiscoveryModule>

            <DiscoveryModule
              icon={MapPin}
              title="Salary and Job Types"
              description="Narrow the results without changing the Candidate Profile itself."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>
                    Minimum Salary
                  </span>

                  <input
                    inputMode="numeric"
                    value={
                      draft.minimumSalary
                    }
                    onChange={(event) =>
                      updateDraft(
                        "minimumSalary",
                        event.target.value,
                      )
                    }
                    placeholder="26000"
                    className={inputClass}
                  />
                </label>

                <label>
                  <span className={labelClass}>
                    Maximum Salary
                  </span>

                  <input
                    inputMode="numeric"
                    value={
                      draft.maximumSalary
                    }
                    onChange={(event) =>
                      updateDraft(
                        "maximumSalary",
                        event.target.value,
                      )
                    }
                    placeholder="Leave Blank"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-5">
                <span className={labelClass}>
                  Job Types
                </span>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                  {[
                    [
                      "permanent",
                      "Permanent",
                    ],
                    [
                      "contract",
                      "Contract",
                    ],
                    [
                      "temporary",
                      "Temporary",
                    ],
                    [
                      "fullTime",
                      "Full-Time",
                    ],
                    [
                      "partTime",
                      "Part-Time",
                    ],
                  ].map(
                    ([
                      field,
                      label,
                    ]) => (
                      <label
                        key={
                          field
                        }
                        className="flex min-w-0 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 text-sm text-zinc-400"
                      >
                        <input
                          type="checkbox"
                          checked={
                            Boolean(
                              draft[
                                field
                              ],
                            )
                          }
                          onChange={(event) =>
                            updateDraft(
                              field,
                              event.target.checked,
                            )
                          }
                          className="shrink-0"
                        />

                        <span className="truncate">
                          {label}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>
            </DiscoveryModule>

            <label className="flex min-w-0 items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <input
                type="checkbox"
                checked={
                  draft.notificationsEnabled
                }
                onChange={(event) =>
                  updateDraft(
                    "notificationsEnabled",
                    event.target.checked,
                  )
                }
                className="mt-1 shrink-0"
              />

              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-300">
                  Windows Notifications for New Matches
                </span>

                <span className="mt-1 block text-xs leading-5 text-zinc-600">
                  The tray alerts you only when unseen vacancies pass the selected profile-match threshold.
                </span>
              </span>
            </label>
          </div>
        </div>

        {draft.lastError && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
            Last Discovery Error: {draft.lastError}
          </div>
        )}

        <div className="mt-5">
          <DiscoveryModule
            icon={History}
            title="Discovery Run History"
            description="A local record of scheduled and manual searches. It stores results counts and safe error summaries, not API keys or job documents."
            action={
              <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-500">
                {runHistory.length} recorded
              </span>
            }
          >
            {runHistory.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-600">
                No discovery runs have been recorded yet. Press Run Now to create the first entry.
              </p>
            ) : (
              <div className="space-y-2">
                {runHistory.slice(0, 10).map((entry) => {
                  const successful = entry.status === "success"
                  const warning = entry.status === "partial" || entry.status === "cached"
                  return (
                    <article
                      key={entry.id}
                      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {successful ? (
                            <CheckCircle2 size={15} className="text-emerald-300" />
                          ) : (
                            <AlertTriangle size={15} className={warning ? "text-amber-300" : "text-red-300"} />
                          )}
                          <span className="text-sm font-medium text-zinc-300">
                            {runStatusLabel(entry.status)}
                          </span>
                          <span className="text-xs capitalize text-zinc-600">
                            {entry.trigger} run
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-zinc-600">
                          {formatDateTime(entry.startedAt)} · {formatDuration(entry.durationMs)} · {entry.rawCount} checked · {entry.newCount} new
                        </p>

                        {entry.error && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-red-300/75">
                            {entry.error}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isRunning || connectedSources.length === 0}
                        onClick={() => retryRun(entry)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RotateCcw size={14} />
                        Run again
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </DiscoveryModule>
        </div>

        <footer className="mt-6 flex flex-col gap-4 border-t border-zinc-800 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 text-xs leading-5 text-zinc-600">
            <ShieldCheck
              size={16}
              className="mt-0.5 shrink-0"
            />

            <span>
              Seen, saved and dismissed jobs are remembered locally and excluded from future discovery alerts.
            </span>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap lg:justify-end">
            <button
              type="button"
              disabled={
                isSaving
              }
              onClick={
                saveSettings
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSaving ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={16}
                />
              )}

              Save Settings
            </button>

            {draft.enabled ? (
              <button
                type="button"
                onClick={
                  pauseDiscovery
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
              >
                <Pause size={16} />
                Pause Discovery
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  connectedSources.length ===
                    0 ||
                  isRunning
                }
                onClick={
                  startDiscovery
                }
                className="jp-button-automation inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
              >
                <Play size={16} />
                Start Discovery
              </button>
            )}
          </div>
        </footer>
        </div>
        )}
      </div>
    </section>
  )
}

function DiscoveryModule({
  icon:
    Icon,
  title,
  description,
  action,
  children,
}) {
  return (
    <section className="h-fit min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/60 text-sky-300">
            <Icon size={16} />
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-200">
              {title}
            </h3>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {description}
            </p>
          </div>
        </div>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </header>

      <div className="mt-5">
        {children}
      </div>
    </section>
  )
}

function StatCard({
  icon:
    Icon,
  label,
  value,
  compact = false,
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        <Icon
          size={13}
          className="shrink-0"
        />

        <span className="truncate">
          {label}
        </span>
      </p>

      <p
        className={[
          "mt-2 truncate font-semibold text-zinc-200",
          compact
            ? "text-sm"
            : "text-2xl",
        ].join(" ")}
        title={
          String(
            value,
          )
        }
      >
        {value}
      </p>
    </div>
  )
}

const labelClass =
  "mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"

const textareaClass =
  "w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"

import {
  useEffect,
  useState,
} from "react"

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleOff,
  ExternalLink,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react"

import ConfirmDialog from "./ConfirmDialog"

const emptyForm = {
  name: "",
  careersUrl: "",
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-cyan-500/50"

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function formatPlatform(platformName) {
  return platformName || "Employer feed"
}

export default function DirectEmployerSourcesPanel({
  onSourcesChanged,
}) {
  const [employers, setEmployers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [collapsed, setCollapsed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState("")
  const [message, setMessage] = useState("")
  const [employerToRemove, setEmployerToRemove] = useState(null)

  useEffect(() => {
    loadEmployers()
  }, [])

  async function loadEmployers() {
    setLoading(true)

    try {
      if (!window.jobPilot?.directEmployerSources?.list) {
        throw new Error(
          "Direct-employer controls are unavailable. Fully restart BreakVeil.",
        )
      }

      const result =
        await window.jobPilot.directEmployerSources.list()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
            "BreakVeil could not load the direct-employer watchlist.",
        )
      }

      setEmployers(
        Array.isArray(result.employers)
          ? result.employers
          : [],
      )
    } catch (error) {
      setMessage(
        error?.message ||
          "BreakVeil could not load the direct-employer watchlist.",
      )
    } finally {
      setLoading(false)
    }
  }

  function updateEmployers(result) {
    if (Array.isArray(result?.employers)) {
      setEmployers(result.employers)
    }

    onSourcesChanged?.()
  }

  async function addEmployer(event) {
    event.preventDefault()
    setBusyAction("add")
    setMessage(
      "Checking the careers-board address and reading its published vacancies...",
    )

    try {
      const result =
        await window.jobPilot.directEmployerSources.addAndTest(
          form,
        )

      updateEmployers(result)

      if (!result?.ok) {
        throw new Error(
          result?.error ||
            "The direct-employer feed could not be added.",
        )
      }

      setForm(emptyForm)
      setShowForm(false)
      setMessage(
        `${result.employer?.name || "Employer"} was added to the watchlist. Automatic Discovery remains off until you enable it.`,
      )
    } catch (error) {
      setMessage(
        error?.message ||
          "The direct-employer feed could not be added.",
      )
    } finally {
      setBusyAction("")
    }
  }

  async function runEmployerAction(
    action,
    employer,
    worker,
    successMessage,
  ) {
    setBusyAction(`${employer.id}:${action}`)
    setMessage("")

    try {
      const result = await worker()
      updateEmployers(result)

      if (!result?.ok) {
        throw new Error(
          result?.error ||
            `${employer.name} could not be updated.`,
        )
      }

      setMessage(successMessage)
    } catch (error) {
      setMessage(
        error?.message ||
          `${employer.name} could not be updated.`,
      )
    } finally {
      setBusyAction("")
    }
  }

  async function removeEmployer() {
    const employer = employerToRemove

    if (!employer) {
      return
    }

    setEmployerToRemove(null)

    await runEmployerAction(
      "remove",
      employer,
      () =>
        window.jobPilot.directEmployerSources.remove(
          employer.id,
        ),
      `${employer.name} was removed from the watchlist. Saved jobs were left alone.`,
    )
  }

  return (
    <section
      id="settings-direct-employer-sources"
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <div className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <Building2 size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-100">
                Direct Employer Feeds
              </h2>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                <SearchCheck size={12} />
                Company watchlist
              </span>
            </div>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Follow published vacancies directly from supported Greenhouse, Lever and SmartRecruiters careers boards. Each employer remains an independent source and Automatic Discovery is off by default.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!collapsed && (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              disabled={loading || employers.length >= 30}
              className={primaryButtonClass}
            >
              <Plus size={16} />
              Add Employer
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className={secondaryButtonClass}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronUp size={16} />
            )}
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="grid gap-3 border-b border-zinc-800 p-5 md:grid-cols-3 sm:p-6">
            {[
              [
                "Greenhouse",
                "Paste a public boards.greenhouse.io or job-boards.greenhouse.io company link.",
              ],
              [
                "Lever",
                "Paste a public jobs.lever.co or jobs.eu.lever.co company link.",
              ],
              [
                "SmartRecruiters",
                "Paste a public careers.smartrecruiters.com company link.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-4"
              >
                <ShieldCheck size={16} className="text-cyan-300" />
                <p className="mt-3 text-sm font-medium text-zinc-300">
                  {title}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                  {description}
                </p>
              </div>
            ))}
          </div>

          {message && (
            <div className="mx-5 mt-5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm leading-6 text-zinc-400 sm:mx-6">
              {message}
            </div>
          )}

          {showForm && (
            <form
              onSubmit={addEmployer}
              className="m-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.035] p-5 sm:m-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Add a company careers board
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                    BreakVeil recognises the platform from the link, performs one small read-only test and stores only the company name and public board identifier.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setForm(emptyForm)
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-medium text-zinc-500">
                    Company name
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Example Company"
                    className={inputClass}
                    maxLength={80}
                    required
                  />
                </label>

                <label>
                  <span className="mb-2 block text-xs font-medium text-zinc-500">
                    Public careers-board link
                  </span>
                  <input
                    value={form.careersUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        careersUrl: event.target.value,
                      }))
                    }
                    placeholder="https://boards.greenhouse.io/example"
                    className={inputClass}
                    spellCheck={false}
                    required
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
                <p className="max-w-2xl text-xs leading-5 text-zinc-600">
                  Only supported public ATS hosts are accepted. BreakVeil never submits applications or requests candidate data through these feeds.
                </p>

                <button
                  type="submit"
                  disabled={
                    busyAction !== "" ||
                    !form.name.trim() ||
                    !form.careersUrl.trim()
                  }
                  className={primaryButtonClass}
                >
                  {busyAction === "add" ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <SearchCheck size={16} />
                  )}
                  Test & Add Employer
                </button>
              </div>
            </form>
          )}

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-300">
                  Employer watchlist
                </h3>
                <p className="mt-1 text-xs text-zinc-600">
                  {employers.length} of 30 employer slots used
                </p>
              </div>

              <button
                type="button"
                onClick={loadEmployers}
                disabled={loading || busyAction !== ""}
                className={secondaryButtonClass}
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
                <LoaderCircle size={16} className="animate-spin" />
                Checking direct employer feeds
              </div>
            ) : employers.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center">
                <Building2 size={22} className="mx-auto text-zinc-600" />
                <p className="mt-3 text-sm font-medium text-zinc-400">
                  No employers on the watchlist yet
                </p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                  Add a supported company careers link to search its published vacancies directly.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {employers.map((employer) => {
                  const busy = busyAction.startsWith(`${employer.id}:`)
                  const testPassed = employer.lastTest?.ok === true

                  return (
                    <article
                      key={employer.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="break-words text-sm font-semibold text-zinc-200">
                              {employer.name}
                            </h4>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                              {formatPlatform(employer.platformName)}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                                employer.enabled && testPassed
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                  : "border-zinc-700 bg-zinc-800 text-zinc-400"
                              }`}
                            >
                              {employer.enabled && testPassed ? (
                                <CheckCircle2 size={12} />
                              ) : (
                                <CircleOff size={12} />
                              )}
                              {employer.enabled && testPassed
                                ? "Active"
                                : "Disabled"}
                            </span>
                          </div>

                          <p className="mt-2 break-all text-xs text-zinc-600">
                            {employer.careersUrl}
                          </p>
                        </div>

                        <a
                          href={employer.careersUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={secondaryButtonClass}
                        >
                          <ExternalLink size={14} />
                          Careers Page
                        </a>
                      </div>

                      {employer.lastTest && (
                        <div
                          className={`mt-4 rounded-xl border p-4 ${
                            testPassed
                              ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                              : "border-red-500/20 bg-red-500/[0.05]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {testPassed ? (
                              <CheckCircle2
                                size={16}
                                className="mt-0.5 shrink-0 text-emerald-300"
                              />
                            ) : (
                              <XCircle
                                size={16}
                                className="mt-0.5 shrink-0 text-red-300"
                              />
                            )}
                            <p className="text-sm leading-6 text-zinc-400">
                              {employer.lastTest.message ||
                                employer.lastTest.error}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/45 p-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-300">
                              Manual searches
                            </p>
                            <p className="mt-1 text-xs leading-5 text-zinc-600">
                              Show this employer in Live Job Search.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={employer.enabled}
                            disabled={busy || !testPassed}
                            onChange={(event) =>
                              runEmployerAction(
                                "permissions",
                                employer,
                                () =>
                                  window.jobPilot.directEmployerSources.setPermissions(
                                    employer.id,
                                    {
                                      enabled: event.target.checked,
                                    },
                                  ),
                                `${employer.name} manual searching was ${
                                  event.target.checked ? "enabled" : "disabled"
                                }.`,
                              )
                            }
                            className="mt-1 h-4 w-4 accent-cyan-500"
                          />
                        </label>

                        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/45 p-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-300">
                              Automatic Discovery
                            </p>
                            <p className="mt-1 text-xs leading-5 text-zinc-600">
                              Separate permission, off by default.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={employer.autoDiscoveryEnabled}
                            disabled={busy || !employer.enabled || !testPassed}
                            onChange={(event) =>
                              runEmployerAction(
                                "permissions",
                                employer,
                                () =>
                                  window.jobPilot.directEmployerSources.setPermissions(
                                    employer.id,
                                    {
                                      autoDiscoveryEnabled:
                                        event.target.checked,
                                    },
                                  ),
                                `${employer.name} Automatic Discovery was ${
                                  event.target.checked ? "enabled" : "disabled"
                                }.`,
                              )
                            }
                            className="mt-1 h-4 w-4 accent-cyan-500"
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runEmployerAction(
                              "retest",
                              employer,
                              () =>
                                window.jobPilot.directEmployerSources.retest(
                                  employer.id,
                                ),
                              `${employer.name} was retested successfully.`,
                            )
                          }
                          className={secondaryButtonClass}
                        >
                          {busyAction === `${employer.id}:retest` ? (
                            <LoaderCircle size={15} className="animate-spin" />
                          ) : (
                            <RefreshCw size={15} />
                          )}
                          Retest
                        </button>

                        <button
                          type="button"
                          disabled={busy || !testPassed}
                          onClick={() =>
                            runEmployerAction(
                              "permissions",
                              employer,
                              () =>
                                window.jobPilot.directEmployerSources.setPermissions(
                                  employer.id,
                                  {
                                    enabled: !employer.enabled,
                                  },
                                ),
                              `${employer.name} was ${
                                employer.enabled ? "disabled" : "enabled"
                              }.`,
                            )
                          }
                          className={secondaryButtonClass}
                        >
                          {employer.enabled ? (
                            <PowerOff size={15} />
                          ) : (
                            <Power size={15} />
                          )}
                          {employer.enabled ? "Disable" : "Enable"}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEmployerToRemove(employer)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/25 px-3 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          Remove
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(employerToRemove)}
        title={`Remove ${employerToRemove?.name || "employer"}?`}
        message="The employer feed and its permissions will be removed. Jobs already saved in BreakVeil will not be deleted."
        confirmLabel="Remove Employer"
        cancelLabel="Keep It"
        danger
        onConfirm={removeEmployer}
        onCancel={() => setEmployerToRemove(null)}
      />
    </section>
  )
}

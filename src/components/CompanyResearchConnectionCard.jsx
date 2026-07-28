import {
  useEffect,
  useState,
} from "react"

import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react"

import ConfirmDialog from "./ConfirmDialog"

import {
  formatPreferenceDateTime,
} from "../lib/uiPreferences"

const emptyStatus = {
  encryptionAvailable: false,

  companiesHouse: {
    configured: false,
    savedAt: "",
    lastTest: null,
  },
}

export default function CompanyResearchConnectionCard({
  onMessage,
}) {
  const [
    status,
    setStatus,
  ] = useState(emptyStatus)

  const [
    apiKey,
    setApiKey,
  ] = useState("")

  const [
    visible,
    setVisible,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    busyAction,
    setBusyAction,
  ] = useState("")

  const [
    confirmRemove,
    setConfirmRemove,
  ] = useState(false)

  async function loadStatus() {
    setLoading(true)

    try {
      const result =
        await window.jobPilot
          ?.companyResearch
          ?.getStatus?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "Company-research status could not be loaded.",
        )
      }

      setStatus({
        ...emptyStatus,
        ...(result.status || {}),
        companiesHouse: {
          ...emptyStatus.companiesHouse,
          ...(result.status
            ?.companiesHouse || {}),
        },
      })
    } catch (error) {
      onMessage?.(
        error?.message ||
        "Company-research status could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function saveKey() {
    setBusyAction("save")

    try {
      const result =
        await window.jobPilot
          ?.companyResearch
          ?.saveCompaniesHouse?.({
            apiKey,
          })

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The Companies House API key could not be saved.",
        )
      }

      setApiKey("")
      setStatus({
        ...emptyStatus,
        ...(result.status || {}),
      })

      onMessage?.(
        result.test?.message ||
        "Companies House connected successfully.",
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The Companies House API key could not be saved.",
      )
    } finally {
      setBusyAction("")
    }
  }

  async function testConnection() {
    setBusyAction("test")

    try {
      const result =
        await window.jobPilot
          ?.companyResearch
          ?.testCompaniesHouse?.()

      setStatus({
        ...emptyStatus,
        ...(result?.status || {}),
      })

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The Companies House connection test failed.",
        )
      }

      onMessage?.(
        result.test?.message ||
        "Companies House connection successful.",
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "The Companies House connection test failed.",
      )
    } finally {
      setBusyAction("")
    }
  }

  async function removeConnection() {
    setConfirmRemove(false)
    setBusyAction("remove")

    try {
      const result =
        await window.jobPilot
          ?.companyResearch
          ?.removeCompaniesHouse?.()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "Companies House could not be disconnected.",
        )
      }

      setStatus({
        ...emptyStatus,
        ...(result.status || {}),
      })

      setApiKey("")

      onMessage?.(
        "Companies House was disconnected. Saved research snapshots remain with their jobs.",
      )
    } catch (error) {
      onMessage?.(
        error?.message ||
        "Companies House could not be disconnected.",
      )
    } finally {
      setBusyAction("")
    }
  }

  const connection =
    status.companiesHouse

  const lastTest =
    connection.lastTest

  return (
    <section
      id="settings-companies-house"
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <header className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="jp-tone-document flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
            <Building2 size={19} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">
                Companies House
              </h2>

              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",

                  connection.configured
                    ? lastTest?.ok
                      ? "jp-tone-success"
                      : "jp-tone-warning"
                    : "jp-tone-neutral",
                ].join(" ")}
              >
                {connection.configured ? (
                  lastTest?.ok ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <RefreshCw size={13} />
                  )
                ) : (
                  <KeyRound size={13} />
                )}

                {connection.configured
                  ? lastTest?.ok
                    ? "Connected"
                    : "Test Required"
                  : "Not Configured"}
              </span>
            </div>

            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Uses the official UK public register for company status, incorporation, officers, persons with significant control and filing history.
            </p>
          </div>
        </div>

        <a
          href="https://developer.company-information.service.gov.uk/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
        >
          <ExternalLink size={14} />
          Developer Hub
        </a>
      </header>

      <div className="p-5 sm:p-6">
        {!status.encryptionAvailable &&
          !loading && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
            <p className="text-sm font-medium text-red-200">
              Secure credential encryption is unavailable.
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-500">
              BreakVeil will not save a Companies House API key without operating-system encryption.
            </p>
          </div>
        )}

        {lastTest && (
          <div
            className={[
              "mb-5 rounded-xl border p-4",

              lastTest.ok
                ? "jp-tone-success"
                : "jp-tone-danger",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              {lastTest.ok ? (
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <XCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                />
              )}

              <div>
                <p className="text-sm font-medium">
                  {lastTest.ok
                    ? "Connection Successful"
                    : "Connection Failed"}
                </p>

                <p className="mt-1 text-xs leading-5 opacity-80">
                  {lastTest.message ||
                    lastTest.error}
                </p>

                <p className="mt-2 text-[11px] opacity-60">
                  {formatPreferenceDateTime(
                    lastTest.testedAt,
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-zinc-400">
            Companies House API Key
          </span>

          <div className="relative">
            <input
              type={visible ? "text" : "password"}
              value={apiKey}
              onChange={(event) =>
                setApiKey(event.target.value)
              }
              placeholder={
                connection.configured
                  ? "Enter a replacement API key"
                  : "Paste your API key"
              }
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-500/60"
            />

            <button
              type="button"
              onClick={() =>
                setVisible(
                  (current) => !current,
                )
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
              title={
                visible
                  ? "Hide API key"
                  : "Show API key"
              }
            >
              {visible ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
        </label>

        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={saveKey}
            disabled={
              loading ||
              busyAction !== "" ||
              !status.encryptionAvailable ||
              (
                !apiKey.trim() &&
                !connection.configured
              )
            }
            className="jp-button-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {busyAction === "save" ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <Save size={16} />
            )}

            Save and Test
          </button>

          {connection.configured && (
            <>
              <button
                type="button"
                onClick={testConnection}
                disabled={busyAction !== ""}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {busyAction === "test" ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <ShieldCheck size={16} />
                )}

                Test Connection
              </button>

              <button
                type="button"
                onClick={() =>
                  setConfirmRemove(true)
                }
                disabled={busyAction !== ""}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Disconnect
              </button>
            </>
          )}
        </div>

        <details className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/35 p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">
            Beginner setup steps
          </summary>

          <ol className="mt-4 space-y-2 text-xs leading-5 text-zinc-500">
            <li>
              1. Open the Companies House Developer Hub.
            </li>

            <li>
              2. Sign in or create a developer account, then create an application.
            </li>

            <li>
              3. Add an API Key client to the application and copy the generated key.
            </li>

            <li>
              4. Paste the key above, then select Save and Test.
            </li>
          </ol>

          <p className="mt-3 text-xs leading-5 text-zinc-600">
            BreakVeil encrypts the key locally. Research snapshots contain public company facts and citations, not the API key.
          </p>
        </details>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Disconnect Companies House?"
        message="The encrypted API key will be removed. Existing company-research snapshots and citations remain saved with their jobs."
        confirmLabel="Disconnect"
        cancelLabel="Keep Connected"
        danger
        onConfirm={removeConnection}
        onCancel={() =>
          setConfirmRemove(false)
        }
      />
    </section>
  )
}

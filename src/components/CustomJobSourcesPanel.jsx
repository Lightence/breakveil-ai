import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Edit3,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react"

import ConfirmDialog from "./ConfirmDialog"

const emptyMapping = {
  id: "",
  title: "",
  company: "",
  location: "",
  description: "",
  url: "",
  postedAt: "",
  salaryText: "",
  remote: "",
  contractType: "",
}

const emptyForm = {
  id: "",
  name: "",
  searchUrl: "",
  documentationUrl: "",
  method: "GET",
  authType: "none",
  authName: "X-API-Key",
  secret: "",
  keywordParameter: "",
  locationParameter: "",
  pageParameter: "",
  limitParameter: "",
  resultsPath: "",
  mapping: {
    ...emptyMapping,
  },
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-sky-500/50"

const selectClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition focus:border-sky-500/50"

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function getStatusAppearance(connector) {
  if (connector.active) {
    return {
      label: "Approved & Active",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      Icon: CheckCircle2,
    }
  }

  if (
    connector.securityState === "review" &&
    connector.lastTest?.ok
  ) {
    return {
      label: "Awaiting Approval",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
      Icon: ShieldCheck,
    }
  }

  if (connector.lastTest && !connector.lastTest.ok) {
    return {
      label: "Quarantined",
      className:
        "border-red-500/20 bg-red-500/10 text-red-300",
      Icon: XCircle,
    }
  }

  return {
    label: "Quarantined",
    className:
      "border-zinc-700 bg-zinc-800 text-zinc-400",
    Icon: LockKeyhole,
  }
}

function capabilityLabel(key) {
  const labels = {
    search: "Job search",
    company: "Company",
    locationFiltering: "Location",
    fullDescription: "Full description",
    salary: "Salary",
    remote: "Remote status",
    applicationUrl: "Application URL",
    postedDate: "Posted date",
  }

  return labels[key] || key
}

function fieldLabel(key) {
  const labels = {
    id: "Job ID",
    title: "Title",
    company: "Company",
    location: "Location",
    description: "Description",
    url: "Application URL",
    postedAt: "Posted date",
    salaryText: "Salary text",
    remote: "Remote flag",
    contractType: "Contract type",
  }

  return labels[key] || key
}

export default function CustomJobSourcesPanel({
  encryptionAvailable,
  onSourcesChanged,
}) {
  const [connectors, setConnectors] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDocumentation, setShowDocumentation] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState("")
  const [message, setMessage] = useState("")
  const [connectorToRemove, setConnectorToRemove] = useState(null)

  const editingConnector = useMemo(
    () =>
      form.id
        ? connectors.find(
            (connector) => connector.id === form.id,
          ) || null
        : null,
    [connectors, form.id],
  )

  useEffect(() => {
    loadConnectors()
  }, [])

  useEffect(() => {
    if (!showDocumentation) {
      return undefined
    }

    function closeDocumentationOnEscape(event) {
      if (event.key === "Escape") {
        setShowDocumentation(false)
      }
    }

    window.addEventListener("keydown", closeDocumentationOnEscape)

    return () => {
      window.removeEventListener("keydown", closeDocumentationOnEscape)
    }
  }, [showDocumentation])

  async function loadConnectors() {
    setLoading(true)

    try {
      if (!window.jobPilot?.customJobSources?.list) {
        throw new Error(
          "Custom-source controls are unavailable. Fully restart BreakVeil.",
        )
      }

      const result = await window.jobPilot.customJobSources.list()

      if (!result?.ok) {
        throw new Error(
          result?.error ||
            "BreakVeil could not load custom job sources.",
        )
      }

      setConnectors(
        Array.isArray(result.connectors)
          ? result.connectors
          : [],
      )
    } catch (error) {
      setMessage(
        error?.message ||
          "BreakVeil could not load custom job sources.",
      )
    } finally {
      setLoading(false)
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setMessage("")
  }

  function updateMapping(field, value) {
    setForm((current) => ({
      ...current,
      mapping: {
        ...current.mapping,
        [field]: value,
      },
    }))
    setMessage("")
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      mapping: {
        ...emptyMapping,
      },
    })
    setShowAdvanced(false)
    setShowSecret(false)
  }

  function startNewConnector() {
    resetForm()
    setShowForm(true)
    setMessage("")
  }

  function editConnector(connector) {
    setForm({
      id: connector.id,
      name: connector.name || "",
      searchUrl: connector.searchUrl || "",
      documentationUrl: connector.documentationUrl || "",
      method: connector.method || "GET",
      authType: connector.authentication?.type || "none",
      authName:
        connector.authentication?.name ||
        (connector.authentication?.type === "query"
          ? "api_key"
          : "X-API-Key"),
      secret: "",
      keywordParameter:
        connector.searchParameters?.keywords || "",
      locationParameter:
        connector.searchParameters?.location || "",
      pageParameter:
        connector.searchParameters?.page || "",
      limitParameter:
        connector.searchParameters?.limit || "",
      resultsPath: connector.resultsPath || "",
      mapping: {
        ...emptyMapping,
        ...(connector.mapping || {}),
      },
    })
    setShowForm(true)
    setShowAdvanced(true)
    setMessage(
      "Editing safely. Leave the secret blank to keep the encrypted value already stored.",
    )
  }

  async function saveAndTest(event) {
    event.preventDefault()
    setBusyAction("save")
    setMessage(
      "Locking the connector in quarantine, checking its destination and inspecting a tiny JSON sample...",
    )

    try {
      const result =
        await window.jobPilot.customJobSources.saveAndTest({
          ...form,
          mapping: {
            ...form.mapping,
          },
        })

      setConnectors(
        Array.isArray(result?.connectors)
          ? result.connectors
          : connectors,
      )

      if (!result?.ok) {
        setMessage(
          `Connection blocked or incomplete: ${result?.error || "The security test did not pass."}`,
        )
        return
      }

      const detectedConnector = result.connector

      if (detectedConnector) {
        editConnector(detectedConnector)
      }

      setMessage(
        result.test?.readyForActivation
          ? "Bank-vault checks passed. Review the detected fields, then approve the connector when you are happy."
          : "The destination passed its network checks, but BreakVeil needs the Title and Application URL mappings before approval.",
      )

      onSourcesChanged?.()
    } catch (error) {
      setMessage(
        error?.message ||
          "The custom connector could not be tested.",
      )
    } finally {
      setBusyAction("")
    }
  }

  async function runConnectorAction(
    action,
    connector,
    operation,
    successMessage,
  ) {
    setBusyAction(`${connector.id}:${action}`)
    setMessage("")

    try {
      const result = await operation()

      if (Array.isArray(result?.connectors)) {
        setConnectors(result.connectors)
      }

      if (!result?.ok) {
        setMessage(
          result?.error ||
            "The connector action could not be completed.",
        )
        return
      }

      setMessage(successMessage)
      onSourcesChanged?.()
    } catch (error) {
      setMessage(
        error?.message ||
          "The connector action could not be completed.",
      )
    } finally {
      setBusyAction("")
    }
  }

  async function removeConnector() {
    const connector = connectorToRemove
    setConnectorToRemove(null)

    if (!connector) {
      return
    }

    await runConnectorAction(
      "remove",
      connector,
      () =>
        window.jobPilot.customJobSources.remove(
          connector.id,
        ),
      `${connector.name} was removed. Saved jobs from it were left alone.`,
    )

    if (form.id === connector.id) {
      resetForm()
      setShowForm(false)
    }
  }

  const authNeedsSecret = form.authType !== "none"
  const authNameLabel =
    form.authType === "query"
      ? "API-key query parameter"
      : "API-key header name"

  return (
    <section
      id="settings-custom-job-sources"
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-violet-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <div className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <LockKeyhole size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-100">
                Secure Custom Job Sources
              </h2>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                <ShieldCheck size={12} />
                Quarantine first
              </span>
            </div>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Add an unsupported JSON job API without giving it free access to BreakVeil. New connectors stay locked away until their address, response and detected fields pass review.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!collapsed && (
            <button
              type="button"
              onClick={startNewConnector}
              disabled={loading || connectors.length >= 10}
              className={primaryButtonClass}
            >
              <Plus size={16} />
              Add Custom Source
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
      <div className="grid gap-3 border-b border-zinc-800 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
        {[
          [
            ShieldCheck,
            "HTTPS + DNS gate",
            "Blocks local, private and reserved network destinations.",
          ],
          [
            KeyRound,
            "Encrypted secrets",
            "Keys use operating-system encryption and never return to the page.",
          ],
          [
            Database,
            "Tiny JSON inspection",
            "15-second timeout, 5 MB response cap and one request per test.",
          ],
          [
            LockKeyhole,
            "No executable access",
            "Responses become sanitised text and cannot run code or read files.",
          ],
        ].map(([Icon, title, description]) => (
          <div
            key={title}
            className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-4"
          >
            <Icon size={16} className="text-violet-300" />
            <p className="mt-3 text-sm font-medium text-zinc-300">
              {title}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-zinc-400">
              {description}
            </p>
          </div>
        ))}
      </div>

      {!encryptionAvailable && (
        <div className="m-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] p-4 sm:m-6">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0 text-red-300"
          />
          <div>
            <p className="text-sm font-medium text-red-200">
              Secure storage is unavailable
            </p>
            <p className="mt-1 text-sm leading-6 text-red-200/65">
              BreakVeil will not save custom API keys until operating-system encryption is available.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className="mx-5 mt-5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm leading-6 text-zinc-400 sm:mx-6">
          {message}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={saveAndTest}
          className="m-5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.035] p-5 sm:m-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">
                {editingConnector
                  ? `Edit ${editingConnector.name}`
                  : "New quarantined connector"}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                The API receives only the search words, location, page and result limit you configure below.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Source name">
              <input
                value={form.name}
                onChange={(event) =>
                  updateForm("name", event.target.value)
                }
                placeholder="Example Jobs API"
                className={inputClass}
                maxLength={60}
                required
              />
            </Field>

            <Field label="Request method">
              <select
                value={form.method}
                onChange={(event) =>
                  updateForm("method", event.target.value)
                }
                className={selectClass}
              >
                <option value="GET">GET — query parameters</option>
                <option value="POST">POST — restricted JSON body</option>
              </select>
            </Field>

            <Field label="Search API URL" wide>
              <input
                value={form.searchUrl}
                onChange={(event) =>
                  updateForm("searchUrl", event.target.value)
                }
                placeholder="https://api.example.com/jobs"
                className={inputClass}
                required
                spellCheck={false}
              />
            </Field>

            <Field label="Documentation URL (optional)" wide>
              <input
                value={form.documentationUrl}
                onChange={(event) =>
                  updateForm("documentationUrl", event.target.value)
                }
                placeholder="https://docs.example.com/jobs-api"
                className={inputClass}
                spellCheck={false}
              />
            </Field>

            <Field label="Authentication">
              <select
                value={form.authType}
                onChange={(event) => {
                  const authType = event.target.value
                  setForm((current) => ({
                    ...current,
                    authType,
                    authName:
                      authType === "query"
                        ? "api_key"
                        : authType === "header"
                          ? "X-API-Key"
                          : "",
                    secret:
                      authType === "none"
                        ? ""
                        : current.secret,
                  }))
                }}
                className={selectClass}
              >
                <option value="none">No API key</option>
                <option value="bearer">Bearer token</option>
                <option value="header">API key in a safe header</option>
                <option value="query">API key in a query parameter</option>
              </select>
            </Field>

            {(form.authType === "header" ||
              form.authType === "query") && (
              <Field label={authNameLabel}>
                <input
                  value={form.authName}
                  onChange={(event) =>
                    updateForm("authName", event.target.value)
                  }
                  placeholder={
                    form.authType === "query"
                      ? "api_key"
                      : "X-API-Key"
                  }
                  className={inputClass}
                  required
                  spellCheck={false}
                />
              </Field>
            )}

            {authNeedsSecret && (
              <Field
                label={
                  editingConnector?.authentication?.hasSecret
                    ? "Replacement key or token (optional)"
                    : "API key or token"
                }
                wide={form.authType === "bearer"}
              >
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={form.secret}
                    onChange={(event) =>
                      updateForm("secret", event.target.value)
                    }
                    placeholder={
                      editingConnector?.authentication?.hasSecret
                        ? "Leave blank to keep the encrypted value"
                        : "Paste the secret value"
                    }
                    className={`${inputClass} pr-11`}
                    autoComplete="off"
                    spellCheck={false}
                    required={!editingConnector?.authentication?.hasSecret}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                    title={showSecret ? "Hide value" : "Show value"}
                  >
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Advanced request and field mapping
            </button>

            <button
              type="button"
              onClick={() => setShowDocumentation(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/[0.07] text-violet-300 transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-violet-200"
              aria-label="Open Custom API Connector Guide"
              title="Custom API Connector Guide"
            >
              <Info size={16} />
            </button>
          </div>

          {showAdvanced && (
            <div className="mt-4 space-y-5 rounded-xl border border-zinc-800 bg-zinc-950/45 p-4">
              <div>
                <h4 className="text-sm font-medium text-zinc-300">
                  Search parameter names
                </h4>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                  Clear a field when the API does not support that parameter. BreakVeil supplies the values; custom scripts and raw request bodies are not allowed.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["keywordParameter", "Keywords"],
                    ["locationParameter", "Location"],
                    ["pageParameter", "Page"],
                    ["limitParameter", "Result limit"],
                  ].map(([field, label]) => (
                    <Field key={field} label={label}>
                      <input
                        value={form[field]}
                        onChange={(event) =>
                          updateForm(field, event.target.value)
                        }
                        className={inputClass}
                        spellCheck={false}
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-300">
                  JSON response mapping
                </h4>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                  Leave these blank for automatic detection. Dotted paths such as company.name are supported; executable expressions are not.
                </p>

                <div className="mt-3">
                  <Field label="Results array path">
                    <input
                      value={form.resultsPath}
                      onChange={(event) =>
                        updateForm("resultsPath", event.target.value)
                      }
                      placeholder="data.jobs"
                      className={inputClass}
                      spellCheck={false}
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Object.keys(emptyMapping).map((field) => (
                    <Field key={field} label={fieldLabel(field)}>
                      <input
                        value={form.mapping[field]}
                        onChange={(event) =>
                          updateMapping(field, event.target.value)
                        }
                        placeholder={
                          field === "title"
                            ? "title"
                            : field === "url"
                              ? "apply_url"
                              : "Auto-detect"
                        }
                        className={inputClass}
                        spellCheck={false}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
            <p className="max-w-2xl text-xs leading-5 text-zinc-600">
              Testing performs one restricted request. Activation remains locked until the destination and required mappings pass review.
            </p>

            <button
              type="submit"
              disabled={
                busyAction !== "" ||
                !form.name.trim() ||
                !form.searchUrl.trim() ||
                (authNeedsSecret &&
                  !form.secret.trim() &&
                  !editingConnector?.authentication?.hasSecret) ||
                (authNeedsSecret && !encryptionAvailable)
              }
              className={primaryButtonClass}
            >
              {busyAction === "save" ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              Save, Test & Detect
            </button>
          </div>
        </form>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300">
              Custom connector vault
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              {connectors.length} of 10 connector slots used
            </p>
          </div>

          <button
            type="button"
            onClick={loadConnectors}
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
            Checking the connector vault
          </div>
        ) : connectors.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center">
            <LockKeyhole size={22} className="mx-auto text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-400">
              No custom connectors yet
            </p>
            <p className="mt-1.5 text-sm leading-6 text-zinc-400">
              Built-in Reed, Adzuna, Jooble, Arbeitnow, Jobicy and Remotive connections are not affected.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {connectors.map((connector) => {
              const appearance = getStatusAppearance(connector)
              const StatusIcon = appearance.Icon
              const busy = busyAction.startsWith(`${connector.id}:`)
              const capabilities = Object.entries(
                connector.capabilities || {},
              ).filter(([key]) =>
                [
                  "search",
                  "company",
                  "locationFiltering",
                  "fullDescription",
                  "salary",
                  "remote",
                  "applicationUrl",
                  "postedDate",
                ].includes(key),
              )

              return (
                <article
                  key={connector.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-sm font-semibold text-zinc-200">
                          {connector.name}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${appearance.className}`}
                        >
                          <StatusIcon size={12} />
                          {appearance.label}
                        </span>
                      </div>

                      <p className="mt-2 break-all text-xs text-zinc-600">
                        {connector.approvedHostname}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => editConnector(connector)}
                      disabled={busy}
                      className={secondaryButtonClass}
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                  </div>

                  {connector.lastTest && (
                    <div
                      className={`mt-4 rounded-xl border p-4 ${
                        connector.lastTest.ok
                          ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                          : "border-red-500/20 bg-red-500/[0.05]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {connector.lastTest.ok ? (
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
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-300">
                            {connector.lastTest.message ||
                              connector.lastTest.error}
                          </p>
                          {connector.lastTest.ok && (
                            <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                              Inspected {connector.lastTest.resultCount || 0} sample jobs · {connector.lastTest.responseBytes || 0} bytes · same-host redirects only
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {capabilities.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {capabilities.map(([key, available]) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs"
                        >
                          {available ? (
                            <Check size={13} className="text-emerald-300" />
                          ) : (
                            <span className="h-px w-3 bg-zinc-700" />
                          )}
                          <span
                            className={
                              available
                                ? "text-zinc-400"
                                : "text-zinc-700"
                            }
                          >
                            {capabilityLabel(key)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {connector.active && (
                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/45 p-4">
                      <label className="flex cursor-pointer items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-zinc-300">
                            Automatic Discovery permission
                          </p>
                          <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                            Separate permission. Manual searches remain available when this is off.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={connector.autoDiscoveryEnabled}
                          disabled={busy}
                          onChange={(event) =>
                            runConnectorAction(
                              "permissions",
                              connector,
                              () =>
                                window.jobPilot.customJobSources.setPermissions(
                                  connector.id,
                                  {
                                    autoDiscoveryEnabled:
                                      event.target.checked,
                                  },
                                ),
                              event.target.checked
                                ? `${connector.name} may now be selected for Automatic Discovery.`
                                : `${connector.name} is restricted to manual searches.`,
                            )
                          }
                          className="mt-1 h-4 w-4 accent-sky-500"
                        />
                      </label>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                    {!connector.active &&
                      connector.lastTest?.ok &&
                      connector.lastTest?.readyForActivation && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runConnectorAction(
                              "activate",
                              connector,
                              () =>
                                window.jobPilot.customJobSources.activate(
                                  connector.id,
                                ),
                              `${connector.name} passed review and is available for manual job searches.`,
                            )
                          }
                          className={primaryButtonClass}
                        >
                          <Power size={15} />
                          Approve & Activate
                        </button>
                      )}

                    {connector.active && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runConnectorAction(
                            "disable",
                            connector,
                            () =>
                              window.jobPilot.customJobSources.setPermissions(
                                connector.id,
                                {
                                  active: false,
                                },
                              ),
                            `${connector.name} was disabled and returned to its locked state.`,
                          )
                        }
                        className={secondaryButtonClass}
                      >
                        <PowerOff size={15} />
                        Disable
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runConnectorAction(
                          "retest",
                          connector,
                          () =>
                            window.jobPilot.customJobSources.retest(
                              connector.id,
                            ),
                          `${connector.name} was retested and returned to review before reactivation.`,
                        )
                      }
                      className={secondaryButtonClass}
                    >
                      {busyAction === `${connector.id}:retest` ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <RefreshCw size={15} />
                      )}
                      Retest
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConnectorToRemove(connector)}
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

      {showDocumentation && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowDocumentation(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-connector-guide-title"
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-violet-500/25 bg-[#151515] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                  <Info size={20} />
                </div>
                <div>
                  <h3
                    id="custom-connector-guide-title"
                    className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl"
                  >
                    Custom API Connector Guide
                  </h3>
                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-zinc-400">
                    Configuration reference for API requests, authentication, search parameters, response mapping, testing, approval and connector security.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDocumentation(false)}
                className="rounded-lg border border-zinc-700 p-2.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Close Custom API Connector Guide"
                title="Close guide"
              >
                <XCircle size={19} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
                <p className="text-base font-semibold text-sky-200">
                  Configure a custom job API safely
                </p>
                <p className="mt-2 text-sm leading-6 text-sky-100/75">
                  Use the provider&apos;s official API documentation as your reference. Enter parameter and field names exactly as documented, leave unsupported settings blank, then select Save, Test &amp; Detect. BreakVeil inspects a small sample while the connector remains quarantined and unavailable to live searches.
                </p>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <GuideCard title="Request methods">
                  <GuideItem label="GET">
                    Requests job data by adding supported search parameters to the API URL. This is the usual method for read-only search endpoints. Choose GET when the provider&apos;s examples show parameters after a question mark in the URL.
                  </GuideItem>
                  <GuideItem label="POST">
                    Requests job data by sending supported search parameters in a restricted JSON body. Use POST only when the provider&apos;s documentation specifically requires it. BreakVeil does not accept arbitrary request bodies, scripts or executable content.
                  </GuideItem>
                </GuideCard>

                <GuideCard title="Authentication methods">
                  <GuideItem label="No API key">
                    Select this for a public endpoint that does not require a secret or account credential.
                  </GuideItem>
                  <GuideItem label="Bearer token">
                    Sends the secret in the standard Authorization header using the bearer-token format requested by many APIs.
                  </GuideItem>
                  <GuideItem label="API key header">
                    Select this when the provider names a dedicated header such as X-API-Key. Enter the header name exactly as shown in the documentation. Unsafe header names remain blocked.
                  </GuideItem>
                  <GuideItem label="API key query parameter">
                    Select this only when the provider requires the key inside the URL, using a parameter such as api_key. Header-based authentication is preferable when the provider supports both options.
                  </GuideItem>
                </GuideCard>

                <GuideCard title="Search parameter configuration">
                  <p className="text-sm leading-6 text-zinc-400">
                    These fields contain the parameter names expected by the API, not the job title or location you want to search. For example, a provider may name its keyword parameter <CodeText>q</CodeText>, location parameter <CodeText>geo</CodeText> and result-limit parameter <CodeText>count</CodeText>. BreakVeil supplies the user&apos;s search values when a search runs.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Leave a parameter blank when the API does not support it. Check whether each filter accepts normal text or a fixed list of values. A free-text location field may accept <CodeText>London</CodeText>, while a region-only field may require a documented value such as <CodeText>uk</CodeText> instead.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Add a page parameter only when the API supports pagination. Some providers return a single result set and will reject any page value.
                  </p>
                </GuideCard>

                <GuideCard title="Response and field mapping">
                  <GuideItem label="Results array path">
                    Enter the path to the array containing the job records, such as jobs, data.jobs or results. Leave it blank when you want BreakVeil to detect the array automatically.
                  </GuideItem>
                  <GuideItem label="Job field paths">
                    Map Title, Company, Location, Description and the remaining BreakVeil fields to names inside one job record. Nested values can use dotted paths such as company.name.
                  </GuideItem>
                  <GuideItem label="Minimum usable mapping">
                    A connector needs a job title and a valid application URL before it can produce useful results. Optional fields may remain unavailable when the provider does not include them.
                  </GuideItem>
                  <GuideItem label="Full descriptions">
                    BreakVeil reports whether the sampled response appears to contain complete vacancy descriptions or only short summaries. This result may be reviewed before activation.
                  </GuideItem>
                </GuideCard>

                <GuideCard title="Testing, approval and maintenance">
                  <GuideItem label="Save, Test &amp; Detect">
                    Encrypts the saved secret using operating-system protection, keeps the connector quarantined and inspects only a limited JSON sample.
                  </GuideItem>
                  <GuideItem label="Awaiting Approval">
                    Review the detected capabilities, destination and mappings before selecting Approve &amp; Activate. A successful test never enables live searches automatically.
                  </GuideItem>
                  <GuideItem label="Retest">
                    Retest after changing the endpoint, authentication, parameters or mappings. Retesting returns the connector to review before it can be activated again.
                  </GuideItem>
                  <GuideItem label="Automatic Discovery">
                    Permission for scheduled discovery is separate from manual search approval and remains disabled until it is deliberately enabled.
                  </GuideItem>
                </GuideCard>

                <GuideCard title="Connector security controls">
                  <GuideItem label="Destination protection">
                    HTTPS is required. Local devices, private networks, restricted ports and redirects that could send credentials to another host are blocked.
                  </GuideItem>
                  <GuideItem label="Credential protection">
                    API keys and tokens are encrypted locally, remain masked after saving and are removed from errors, logs and ordinary data exports.
                  </GuideItem>
                  <GuideItem label="Request limits">
                    Requests use strict timeouts, redirect limits, response-size limits and controlled methods. Custom scripts, file access and unrestricted headers are not permitted.
                  </GuideItem>
                  <GuideItem label="Response protection">
                    API responses are treated as untrusted data. HTML is converted to safe text, dangerous object keys are rejected and downloaded code is never executed.
                  </GuideItem>
                </GuideCard>
              </div>

              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/45 p-5">
                <p className="text-base font-semibold text-zinc-300">
                  Configuration example
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  For a response shaped like <CodeText>{`{ results: [{ title, company: { name }, location: "London", applyUrl }] }`}</CodeText>, use <CodeText>results</CodeText> as the results array path, <CodeText>title</CodeText> as Title, <CodeText>company.name</CodeText> as Company, <CodeText>location</CodeText> as Location and <CodeText>applyUrl</CodeText> as Application URL.
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-zinc-800 px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => setShowDocumentation(false)}
                className={primaryButtonClass}
              >
                Close guide
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(connectorToRemove)}
        title={`Remove ${connectorToRemove?.name || "custom connector"}?`}
        message="Its encrypted secret and connector settings will be removed. Jobs already saved in BreakVeil will not be deleted."
        confirmLabel="Remove Connector"
        cancelLabel="Keep It"
        danger
        onConfirm={removeConnector}
        onCancel={() => setConnectorToRemove(null)}
      />
    </section>
  )
}

function GuideCard({
  title,
  children,
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-5">
      <h4 className="text-base font-semibold text-zinc-200">
        {title}
      </h4>
      <div className="mt-3 space-y-3">
        {children}
      </div>
    </section>
  )
}

function GuideItem({
  label,
  children,
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-300">
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-zinc-400">
        {children}
      </p>
    </div>
  )
}

function CodeText({
  children,
}) {
  return (
    <code className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-violet-200">
      {children}
    </code>
  )
}

function Field({
  label,
  wide = false,
  children,
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-xs font-medium text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  )
}

import {
  useEffect,
  useState,
} from "react"

import {
  AlertTriangle,
  Archive,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  FileClock,
  FileSearch,
  Globe2,
  History,
  Landmark,
  Link2,
  LoaderCircle,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import {
  buildCompaniesHouseSignals,
  buildCompanyResearchQuickBrief,
  buildCompanyResearchRoleRelevance,
  formatResearchDate,
  getFriendlyFilingDescription,
  getResearchSourceNumbers,
} from "../lib/companyResearch"

function formatDate(value) {
  if (!value) {
    return "Not provided"
  }

  const parsed =
    new Date(value)

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
    },
  ).format(parsed)
}

function getSourceTrustLabel(
  source,
) {
  if (
    source?.trust ===
    "official"
  ) {
    return {
      label:
        "Official Register",

      className:
        "jp-tone-success",
    }
  }

  if (
    source?.trust ===
    "official-site"
  ) {
    return {
      label:
        "Official Website",

      className:
        "jp-tone-document",
    }
  }

  if (
    source?.trust ===
    "news"
  ) {
    return {
      label:
        "News",

      className:
        "jp-tone-automation",
    }
  }

  return {
    label:
      "Community",

    className:
      "jp-tone-warning",
  }
}

function normaliseCompanyName(
  value,
) {
  return String(
    value ||
    "",
  )
    .toLowerCase()
    .replace(
      /&/g,
      " and ",
    )
    .replace(
      /\b(limited|ltd|plc|llp)\b/g,
      " ",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
}

function getSignalToneClass(
  tone,
) {
  if (
    tone ===
    "success"
  ) {
    return "jp-tone-success"
  }

  if (
    tone ===
    "warning"
  ) {
    return "jp-tone-warning"
  }

  if (
    tone ===
    "danger"
  ) {
    return "jp-tone-danger"
  }

  if (
    tone ===
    "document"
  ) {
    return "jp-tone-document"
  }

  return "jp-tone-neutral"
}

function getPanelStorageKey(jobId) {
  return `jobpilot.company-research-expanded:${jobId || "workspace"}`
}

function readPanelExpanded(jobId, report) {
  try {
    const stored =
      localStorage.getItem(
        getPanelStorageKey(jobId),
      )

    if (stored === "true") {
      return true
    }

    if (stored === "false") {
      return false
    }
  } catch {
    // Use the sensible default when localStorage is unavailable.
  }

  return !report
}

function focusResearchSource(sourceId) {
  if (!sourceId) {
    return
  }

  const target =
    document.getElementById(
      `company-research-source-${sourceId}`,
    )

  if (!target) {
    return
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
  })

  target.classList.remove(
    "jp-research-source-highlight",
  )

  window.requestAnimationFrame(() => {
    target.classList.add(
      "jp-research-source-highlight",
    )

    window.setTimeout(() => {
      target.classList.remove(
        "jp-research-source-highlight",
      )
    }, 1800)
  })
}

export default function CompanyResearchPanel({
  job,
  report,
  history = [],
  onSave,
}) {
  const navigate =
    useNavigate()

  const [
    showResearchModal,
    setShowResearchModal,
  ] = useState(false)

  const [
    viewedReport,
    setViewedReport,
  ] = useState(report || null)

  const [
    expanded,
    setExpanded,
  ] = useState(() =>
    readPanelExpanded(
      job?.id,
      report,
    ),
  )

  useEffect(() => {
    setViewedReport(report || null)
  }, [report])

  function setPanelExpanded(nextExpanded) {
    setExpanded(nextExpanded)

    try {
      localStorage.setItem(
        getPanelStorageKey(job?.id),
        String(nextExpanded),
      )
    } catch {
      // The panel still works for this session.
    }
  }

  function toggleExpanded() {
    setPanelExpanded(!expanded)
  }

  function saveReport(nextReport) {
    onSave?.(nextReport)
    setViewedReport(nextReport)
    setPanelExpanded(true)
    setShowResearchModal(false)
  }

  function openConnections() {
    setShowResearchModal(false)

    navigate(
      "/settings?category=connections&section=settings-companies-house",
    )
  }

  const researchedCompanyKey =
    normaliseCompanyName(
      viewedReport
        ?.researchedCompanyName,
    )

  const trackedCompanyKey =
    normaliseCompanyName(
      job.company,
    )

  const companyMismatch =
    Boolean(
      researchedCompanyKey &&
      trackedCompanyKey &&
      researchedCompanyKey !==
        trackedCompanyKey,
    )

  const roleRelevance =
    viewedReport
      ? buildCompanyResearchRoleRelevance({
          report:
            viewedReport,

          job,
        })
      : []

  const quickBrief =
    viewedReport
      ? buildCompanyResearchQuickBrief({
          report:
            viewedReport,

          job,
        })
      : []

  const companiesHouseSignals =
    viewedReport
      ? buildCompaniesHouseSignals({
          report:
            viewedReport,
        })
      : []

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-indigo-500/20 bg-[#151515]">
        <header
          className={[
            "flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-start sm:px-6",
            expanded
              ? "border-b border-zinc-800"
              : "",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            className="group flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <div className="jp-tone-document flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
              <Landmark size={19} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-zinc-100">
                  Company Research
                </h2>

                {viewedReport ? (
                  <>
                    <span className="jp-tone-document rounded-full border px-2.5 py-1 text-xs font-medium">
                      {viewedReport.sources?.length || 0} Source
                      {viewedReport.sources?.length === 1 ? "" : "s"}
                    </span>

                    {viewedReport.cached && (
                      <span className="jp-tone-warning rounded-full border px-2.5 py-1 text-xs font-medium">
                        Cached
                      </span>
                    )}
                  </>
                ) : (
                  <span className="jp-tone-neutral rounded-full border px-2.5 py-1 text-xs font-medium">
                    Not researched
                  </span>
                )}
              </div>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                {viewedReport
                  ? `Researched ${viewedReport.researchedCompanyName || job.company} • Updated ${formatResearchDate(
                      viewedReport.refreshedAt ||
                        viewedReport.createdAt,
                    ) || "Not available"}`
                  : "Official company records and source links, kept separate from interview preparation."}
              </p>

              {!expanded &&
                quickBrief.length > 0 && (
                <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-5 text-zinc-600">
                  {quickBrief
                    .map(
                      (item) =>
                        item.text,
                    )
                    .join(" • ")}
                </p>
              )}
            </div>

            <ChevronDown
              size={18}
              className={[
                "mt-2 shrink-0 text-zinc-600 transition duration-200 group-hover:text-zinc-300",
                expanded
                  ? "rotate-180"
                  : "",
              ].join(" ")}
            />
          </button>

          <div className="flex shrink-0 flex-wrap gap-2 sm:pl-4">
            <button
              type="button"
              onClick={() =>
                setShowResearchModal(true)
              }
              className={[
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                viewedReport
                  ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  : "jp-button-primary font-semibold",
              ].join(" ")}
            >
              {viewedReport ? (
                <RefreshCw size={15} />
              ) : (
                <FileSearch size={15} />
              )}

              {viewedReport
                ? "Refresh Sources"
                : "Research Company"}
            </button>
          </div>
        </header>

        {expanded && !viewedReport && (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <EmptyFeature
              icon={ShieldCheck}
              title="Official Registry"
              description="UK company profile, status, officers, control and filings."
            />

            <EmptyFeature
              icon={Globe2}
              title="Public Overview"
              description="Optional Wikipedia background, clearly marked as community-edited."
            />

            <EmptyFeature
              icon={Newspaper}
              title="Recent News"
              description="Choose relevant third-party coverage from the last 30 days."
            />

            <EmptyFeature
              icon={Archive}
              title="Saved Snapshots"
              description="Research stays with this job and older snapshots are preserved."
            />
          </div>
        )}

        {expanded && viewedReport && (
          <>
            {viewedReport.warnings?.length > 0 && (
              <div className="border-b border-zinc-800 px-5 py-4 sm:px-6">
                <div className="space-y-2">
                  {viewedReport.warnings.map(
                    (warning, index) => (
                      <p
                        key={`${warning}-${index}`}
                        className="flex items-start gap-2 text-xs leading-5 text-zinc-500"
                      >
                        <AlertTriangle
                          size={13}
                          className="mt-0.5 shrink-0 text-amber-300"
                        />
                        {warning}
                      </p>
                    ),
                  )}
                </div>
              </div>
            )}

            <div className="space-y-5 p-5 sm:p-6">
              {viewedReport.facts?.length > 0 && (
                <ResearchModule
                  icon={Building2}
                  title="Verified Company Details"
                  subtitle="Structured facts from the selected Companies House record."
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {viewedReport.facts.map(
                      (fact) => (
                        <FactCard
                          key={fact.id}
                          fact={fact}
                          report={viewedReport}
                        />
                      ),
                    )}
                  </div>
                </ResearchModule>
              )}

              {companiesHouseSignals.length > 0 && (
                <ResearchModule
                  icon={ShieldCheck}
                  title="Official Register Signals"
                  subtitle="Quick status indicators from Companies House. These are register facts and filing signals, not a credit score or financial-health rating."
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {companiesHouseSignals.map(
                      (signal) => (
                        <article
                          key={signal.id}
                          className={[
                            "rounded-xl border p-4",
                            getSignalToneClass(
                              signal.tone,
                            ),
                          ].join(" ")}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-65">
                            {signal.label}
                          </p>

                          <p className="mt-2 text-sm font-semibold">
                            {signal.value}
                            <InlineCitations
                              report={viewedReport}
                              sourceIds={
                                signal.sourceIds
                              }
                            />
                          </p>

                          <p className="mt-2 text-xs leading-5 opacity-70">
                            {signal.detail}
                          </p>
                        </article>
                      ),
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-600">
                    BreakVeil does not infer revenue, profitability, solvency or employer quality from these fields.
                  </p>
                </ResearchModule>
              )}

              {viewedReport.wikipedia?.summary && (
                <ResearchModule
                  icon={Globe2}
                  title="Public Overview"
                  subtitle="Community-edited background. Verify important claims against official sources."
                >
                  <p className="text-sm leading-7 text-zinc-400">
                    {viewedReport.wikipedia.summary}
                    <InlineCitations
                      report={viewedReport}
                      sourceIds={["wikipedia-overview"]}
                    />
                  </p>
                </ResearchModule>
              )}

              {viewedReport.officialWebsite?.url && (
                <ResearchModule
                  icon={Link2}
                  title="Official Website Note"
                  subtitle="A source and note confirmed by you."
                >
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.055] p-4">
                    <a
                      href={viewedReport.officialWebsite.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-indigo-200 transition hover:text-white"
                    >
                      <ExternalLink size={14} />
                      {viewedReport.officialWebsite.title ||
                        "Open official company website"}
                    </a>

                    {viewedReport.officialWebsite.note && (
                      <p className="mt-3 text-sm leading-6 text-zinc-400">
                        {viewedReport.officialWebsite.note}
                        <InlineCitations
                          report={viewedReport}
                          sourceIds={["official-company-website"]}
                        />
                      </p>
                    )}
                  </div>
                </ResearchModule>
              )}

              {viewedReport.companiesHouse?.activeOfficers?.length > 0 && (
                <ResearchModule
                  icon={UserRound}
                  title="Current Officers"
                  subtitle="Current appointments returned by Companies House at the time of this snapshot."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {viewedReport.companiesHouse.activeOfficers.map(
                      (officer, index) => (
                        <PersonCard
                          key={`${officer.name}-${index}`}
                          name={officer.name}
                          detail={[
                            officer.role,
                            officer.occupation,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                          meta={
                            officer.appointedOn
                              ? `Appointed ${formatDate(officer.appointedOn)}`
                              : ""
                          }
                          report={viewedReport}
                          sourceIds={["companies-house-officers"]}
                        />
                      ),
                    )}
                  </div>
                </ResearchModule>
              )}

              {viewedReport.companiesHouse?.significantControl?.length > 0 && (
                <ResearchModule
                  icon={UsersRound}
                  title="Persons with Significant Control"
                  subtitle="Public control notifications returned by Companies House."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {viewedReport.companiesHouse.significantControl.map(
                      (person, index) => (
                        <PersonCard
                          key={`${person.name}-${index}`}
                          name={person.name}
                          detail={
                            person.natureOfControl?.join(", ") ||
                            person.kind
                          }
                          meta={
                            person.notifiedOn
                              ? `Notified ${formatDate(person.notifiedOn)}`
                              : ""
                          }
                          report={viewedReport}
                          sourceIds={["companies-house-psc"]}
                        />
                      ),
                    )}
                  </div>
                </ResearchModule>
              )}

              {viewedReport.companiesHouse?.recentFilings?.length > 0 && (
                <ResearchModule
                  icon={FileClock}
                  title="Recent Filing History"
                  subtitle={`Showing ${viewedReport.companiesHouse.recentFilings.length} recent entr${viewedReport.companiesHouse.recentFilings.length === 1 ? "y" : "ies"}${viewedReport.companiesHouse.filingHistoryTotalCount ? ` from ${viewedReport.companiesHouse.filingHistoryTotalCount.toLocaleString("en-GB")} total filing${viewedReport.companiesHouse.filingHistoryTotalCount === 1 ? "" : "s"}` : ""}. Filing records are context, not financial interpretation.`}
                >
                  <div className="space-y-2">
                    {viewedReport.companiesHouse.recentFilings.map(
                      (filing, index) => (
                        <article
                          key={
                            filing.transactionId ||
                            `${filing.date}-${filing.type}-${index}`
                          }
                          className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium leading-6 text-zinc-300">
                                  {getFriendlyFilingDescription(
                                    filing,
                                  )}
                                </p>

                                {filing.type && (
                                  <span className="jp-tone-document rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                                    {filing.type}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-xs leading-5 text-zinc-600">
                                {filing.category || "Filing"}
                                {filing.subcategory
                                  ? ` • ${filing.subcategory}`
                                  : ""}
                                {filing.pages > 0
                                  ? ` • ${filing.pages} page${filing.pages === 1 ? "" : "s"}`
                                  : ""}
                                {filing.paperFiled
                                  ? " • Paper filed"
                                  : ""}
                                {filing.documentAvailable
                                  ? " • Document available"
                                  : ""}
                              </p>
                            </div>

                            <p className="shrink-0 text-xs text-zinc-500">
                              {formatDate(filing.date)}
                              <InlineCitations
                                report={viewedReport}
                                sourceIds={["companies-house-filings"]}
                              />
                            </p>
                          </div>
                        </article>
                      ),
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-zinc-600">
                      Open the official filing-history source to inspect the full list and any available filing documents.
                    </p>

                    <a
                      href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(
                        viewedReport.companiesHouse.companyNumber,
                      )}/filing-history`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <ExternalLink size={13} />
                      Open Filing History
                    </a>
                  </div>
                </ResearchModule>
              )}

              {viewedReport.news?.articles?.length > 0 && (
                <ResearchModule
                  icon={Newspaper}
                  title="Recent Company News"
                  subtitle="Articles you selected from the last 30 days of GDELT-discovered coverage. These are third-party sources."
                >
                  <div className="space-y-3">
                    {viewedReport.news.articles.map(
                      (article) => (
                        <article
                          key={article.sourceId || article.url}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-6 text-zinc-300">
                                {article.title}
                                <InlineCitations
                                  report={viewedReport}
                                  sourceIds={[
                                    article.sourceId,
                                  ]}
                                />
                              </p>

                              <p className="mt-1 text-xs leading-5 text-zinc-600">
                                {article.domain || "News publication"}
                                {article.publishedAt
                                  ? ` • Published ${formatDate(
                                      article.publishedAt,
                                    )}`
                                  : ""}
                              </p>
                            </div>

                            <a
                              href={article.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                            >
                              <ExternalLink size={13} />
                              Read Article
                            </a>
                          </div>
                        </article>
                      ),
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-600">
                    News coverage can be useful interview context, but BreakVeil does not treat third-party reporting as an official company statement.
                  </p>
                </ResearchModule>
              )}

              {roleRelevance.length > 0 && (
                <ResearchModule
                  icon={Target}
                  title="Role-Relevant Research"
                  subtitle="BreakVeil interpretation based on the vacancy and cited research. This section is guidance, not a new factual source."
                >
                  <div className="grid gap-3 lg:grid-cols-2">
                    {roleRelevance.map(
                      (item, index) => (
                        <article
                          key={`${item.title}-${index}`}
                          className="rounded-xl border border-violet-500/20 bg-violet-500/[0.045] p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-300">
                            {item.title}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            {item.text}
                            <InlineCitations
                              report={viewedReport}
                              sourceIds={
                                item.sourceIds
                              }
                            />
                          </p>
                        </article>
                      ),
                    )}
                  </div>
                </ResearchModule>
              )}

              <ResearchModule
                icon={Link2}
                title="Sources"
                subtitle="Select a citation number anywhere above to jump to the matching source here."
              >
                <div className="space-y-2">
                  {viewedReport.sources?.map(
                    (source) => (
                      <a
                        key={source.id}
                        id={`company-research-source-${source.id}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="jp-research-source-card scroll-mt-28 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/35 p-4 transition hover:border-indigo-500/30 hover:bg-indigo-500/[0.045]"
                      >
                        <span className="jp-tone-document flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold">
                          {source.number}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zinc-300">
                              {source.title}
                            </span>

                            {(() => {
                              const trust =
                                getSourceTrustLabel(
                                  source,
                                )

                              return (
                                <span
                                  className={[
                                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                    trust.className,
                                  ].join(" ")}
                                >
                                  {trust.label}
                                </span>
                              )
                            })()}
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-zinc-600">
                            {source.publisher}
                            {" • "}
                            {source.sourceType}
                            {source.publishedAt
                              ? ` • Published ${formatDate(
                                  source.publishedAt,
                                )}`
                              : ""}
                            {" • Retrieved "}
                            {formatResearchDate(source.retrievedAt)}
                          </span>
                        </span>

                        <ExternalLink
                          size={14}
                          className="mt-1 shrink-0 text-zinc-600"
                        />
                      </a>
                    ),
                  )}
                </div>
              </ResearchModule>

              {(history.length > 0 ||
                viewedReport !== report ||
                companyMismatch) && (
                <ResearchModule
                  icon={History}
                  title="Research Snapshots"
                  subtitle="Older snapshots remain saved with this job when sources are refreshed."
                >
                  {companyMismatch && (
                    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.045] p-3">
                      <p className="flex items-start gap-2 text-xs leading-5 text-zinc-500">
                        <AlertTriangle
                          size={13}
                          className="mt-0.5 shrink-0 text-amber-300"
                        />

                        <span>
                          This research snapshot is linked to <span className="font-medium text-zinc-300">{viewedReport.researchedCompanyName}</span>, while the tracked job is currently named <span className="font-medium text-zinc-300">{job.company}</span>. This only appears when the names are meaningfully different.
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {report && viewedReport !== report && (
                      <button
                        type="button"
                        onClick={() => setViewedReport(report)}
                        className="jp-tone-document inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium"
                      >
                        <Check size={13} />
                        Current Snapshot
                      </button>
                    )}

                    {history.map(
                      (historicalReport, index) => (
                        <button
                          key={historicalReport.researchId || index}
                          type="button"
                          onClick={() =>
                            setViewedReport(historicalReport)
                          }
                          className={[
                            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition",
                            viewedReport?.researchId === historicalReport?.researchId
                              ? "jp-tone-document"
                              : "border-zinc-700 text-zinc-400 hover:bg-zinc-800",
                          ].join(" ")}
                        >
                          <History size={13} />
                          {formatResearchDate(historicalReport.createdAt) ||
                            `Snapshot ${index + 1}`}
                        </button>
                      ),
                    )}
                  </div>
                </ResearchModule>
              )}
            </div>
          </>
        )}
      </section>

      {showResearchModal && (
        <ResearchModal
          job={job}
          existingReport={report}
          onClose={() => setShowResearchModal(false)}
          onSave={saveReport}
          onOpenConnections={openConnections}
        />
      )}
    </>
  )
}

function EmptyFeature({
  icon: Icon,
  title,
  description,
}) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4">
      <div className="jp-tone-document flex h-9 w-9 items-center justify-center rounded-lg border">
        <Icon size={16} />
      </div>

      <p className="mt-3 text-sm font-medium text-zinc-300">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </article>
  )
}

function ResearchModule({
  icon: Icon,
  title,
  subtitle,
  children,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/20">
      <header className="flex items-start gap-3 border-b border-zinc-800 px-4 py-4">
        <div className="jp-tone-document flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
          <Icon size={16} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            {subtitle}
          </p>
        </div>
      </header>

      <div className="p-4">
        {children}
      </div>
    </section>
  )
}

function FactCard({
  fact,
  report,
}) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        {fact.label}
      </p>

      <p className="mt-2 break-words text-sm leading-6 text-zinc-300">
        {fact.value}
        <InlineCitations
          report={report}
          sourceIds={fact.sourceIds}
        />
      </p>
    </article>
  )
}

function PersonCard({
  name,
  detail,
  meta,
  report,
  sourceIds,
}) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-4">
      <p className="text-sm font-medium text-zinc-300">
        {name}
        <InlineCitations
          report={report}
          sourceIds={sourceIds}
        />
      </p>

      {detail && (
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {detail}
        </p>
      )}

      {meta && (
        <p className="mt-2 text-[11px] text-zinc-700">
          {meta}
        </p>
      )}
    </article>
  )
}

function InlineCitations({
  report,
  sourceIds,
}) {
  const numbers =
    getResearchSourceNumbers(
      report,
      sourceIds,
    )

  if (numbers.length === 0) {
    return null
  }

  return (
    <span className="ml-1 inline-flex gap-1 align-super text-[10px] font-semibold text-indigo-300">
      {numbers.map((number) => {
        const source =
          report?.sources?.find(
            (item) =>
              item.number === number,
          )

        return (
          <button
            key={number}
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              focusResearchSource(source?.id)
            }}
            title={
              source
                ? `Jump to source ${number}: ${source.publisher}`
                : `Jump to source ${number}`
            }
            className="rounded px-0.5 text-indigo-300 underline decoration-indigo-400/40 underline-offset-2 transition hover:bg-indigo-500/10 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            [{number}]
          </button>
        )
      })}
    </span>
  )
}

function ResearchModal({
  job,
  existingReport,
  onClose,
  onSave,
  onOpenConnections,
}) {
  const [
    companyName,
    setCompanyName,
  ] = useState(job.company || "")

  const [
    status,
    setStatus,
  ] = useState(null)

  const [
    companyResults,
    setCompanyResults,
  ] = useState([])

  const [
    wikipediaResults,
    setWikipediaResults,
  ] = useState([])

  const [
    newsResults,
    setNewsResults,
  ] = useState(
    Array.isArray(
      existingReport
        ?.news
        ?.articles,
    )
      ? existingReport.news.articles
      : [],
  )

  const [
    selectedCompanyNumber,
    setSelectedCompanyNumber,
  ] = useState(
    existingReport
      ?.selectedSources
      ?.companyNumber || "",
  )

  const [
    selectedWikipediaTitle,
    setSelectedWikipediaTitle,
  ] = useState(
    existingReport
      ?.selectedSources
      ?.wikipediaTitle || "",
  )

  const [
    selectedNewsUrls,
    setSelectedNewsUrls,
  ] = useState(
    Array.isArray(
      existingReport
        ?.news
        ?.articles,
    )
      ? existingReport.news.articles
          .map(
            (article) =>
              article?.url,
          )
          .filter(
            Boolean,
          )
          .slice(
            0,
            5,
          )
      : [],
  )

  const [
    officialWebsite,
    setOfficialWebsite,
  ] = useState(
    existingReport
      ?.officialWebsite
      ?.url || "",
  )

  const [
    officialWebsiteTitle,
    setOfficialWebsiteTitle,
  ] = useState(
    existingReport
      ?.officialWebsite
      ?.title || "",
  )

  const [
    officialWebsiteNote,
    setOfficialWebsiteNote,
  ] = useState(
    existingReport
      ?.officialWebsite
      ?.note || "",
  )

  const [
    loadingSources,
    setLoadingSources,
  ] = useState(false)

  const [
    buildingReport,
    setBuildingReport,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState("")

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const result =
        await window.jobPilot
          ?.companyResearch
          ?.getStatus?.()

      setStatus(
        result?.ok
          ? result.status
          : null,
      )
    } catch {
      setStatus(null)
    }
  }

  async function findSources() {
    if (!companyName.trim()) {
      setError(
        "Enter a company name before finding sources.",
      )
      return
    }

    setLoadingSources(true)
    setError("")

    try {
      const [
        companyResponse,
        wikipediaResponse,
        newsResponse,
      ] =
        await Promise.all([
          status
            ?.companiesHouse
            ?.configured
            ? window.jobPilot
                .companyResearch
                .searchCompaniesHouse(
                  companyName,
                )
            : Promise.resolve({
                ok: true,
                results: [],
              }),

          window.jobPilot
            .companyResearch
            .searchWikipedia(
              companyName,
            ),

          window.jobPilot
            .companyResearch
            .searchNews(
              companyName,
            ),
        ])

      setCompanyResults(
        companyResponse?.ok
          ? companyResponse.results || []
          : [],
      )

      setWikipediaResults(
        wikipediaResponse?.ok
          ? wikipediaResponse.results || []
          : [],
      )

      setNewsResults(
        newsResponse?.ok
          ? newsResponse.results || []
          : [],
      )

      const errors = [
        companyResponse?.ok === false
          ? companyResponse.error
          : "",
        wikipediaResponse?.ok === false
          ? wikipediaResponse.error
          : "",

        newsResponse?.ok === false
          ? newsResponse.error
          : "",
      ].filter(Boolean)

      if (errors.length > 0) {
        setError(errors.join(" "))
      }
    } catch (searchError) {
      setError(
        searchError?.message ||
        "Company sources could not be searched.",
      )
    } finally {
      setLoadingSources(false)
    }
  }

  function toggleNewsArticle(
    article,
  ) {
    const url =
      article?.url

    if (!url) {
      return
    }

    setSelectedNewsUrls(
      (current) => {
        if (
          current.includes(
            url,
          )
        ) {
          return current.filter(
            (item) =>
              item !==
              url,
          )
        }

        if (
          current.length >=
          5
        ) {
          setError(
            "Choose up to five recent news articles for one research snapshot.",
          )

          return current
        }

        setError(
          "",
        )

        return [
          ...current,
          url,
        ]
      },
    )
  }

  async function buildReport() {
    if (
      !selectedCompanyNumber &&
      !selectedWikipediaTitle &&
      !officialWebsite.trim() &&
      selectedNewsUrls.length ===
        0
    ) {
      setError(
        "Select at least one source or add an official website.",
      )
      return
    }

    setBuildingReport(true)
    setError("")

    try {
      const result =
        await window.jobPilot
          ?.companyResearch
          ?.buildReport?.({
            companyName,
            companyNumber:
              selectedCompanyNumber,
            wikipediaTitle:
              selectedWikipediaTitle,
            officialWebsite: {
              url: officialWebsite,
              title:
                officialWebsiteTitle,
              note:
                officialWebsiteNote,
            },

            selectedNews:
              newsResults.filter(
                (article) =>
                  selectedNewsUrls.includes(
                    article.url,
                  ),
              ),

            forceRefresh:
              Boolean(
                existingReport,
              ),
          })

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          "The company research report could not be created.",
        )
      }

      onSave?.(result.report)
    } catch (buildError) {
      setError(
        buildError?.message ||
        "The company research report could not be created.",
      )
    } finally {
      setBuildingReport(false)
    }
  }

  const companiesHouseConnected =
    Boolean(
      status
        ?.companiesHouse
        ?.configured,
    )

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="jp-tone-document flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
              <FileSearch size={19} />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                Cited Research Setup
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Research{" "}
                {job.company || "Company"}
              </h2>

              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Select the exact records you trust. BreakVeil does not silently assume the first result is correct.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </header>

        <div className="jp-scroll-surface min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label>
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                Company Name
              </span>

              <input
                value={companyName}
                onChange={(event) =>
                  setCompanyName(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-500/60"
                placeholder="Company name"
              />
            </label>

            <button
              type="button"
              onClick={findSources}
              disabled={
                loadingSources ||
                !companyName.trim()
              }
              className="jp-button-primary mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50"
            >
              {loadingSources ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Search size={16} />
              )}

              Find Sources
            </button>
          </div>

          {!companiesHouseConnected && (
            <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.055] p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-amber-100">
                  Companies House Is Not Connected
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Wikipedia and a manual official website can still be used, but verified UK registry facts require a Companies House API key.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenConnections}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/25 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-500/10"
              >
                <Landmark size={14} />
                Connect Companies House
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.055] p-4 text-sm leading-6 text-red-200">
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <SourceSelectionPanel
              icon={Landmark}
              title="Companies House Record"
              description="Official UK public register. Select the exact legal entity."
              connected={
                companiesHouseConnected
              }
              emptyMessage={
                loadingSources
                  ? "Searching Companies House..."
                  : companyResults.length > 0
                    ? ""
                    : "Find sources to see matching UK companies."
              }
            >
              {companyResults.map(
                (company) => (
                  <SourceOption
                    key={company.companyNumber}
                    selected={
                      selectedCompanyNumber ===
                      company.companyNumber
                    }
                    onSelect={() =>
                      setSelectedCompanyNumber(
                        selectedCompanyNumber ===
                          company.companyNumber
                          ? ""
                          : company.companyNumber,
                      )
                    }
                    title={
                      company.companyName
                    }
                    badge={
                      company.status
                    }
                    detail={[
                      company.companyNumber,
                      company.companyType,
                      company.address,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                    url={company.url}
                  />
                ),
              )}
            </SourceSelectionPanel>

            <SourceSelectionPanel
              icon={Globe2}
              title="Wikipedia Overview"
              description="Community-edited context. Useful for background, not as the only source for important claims."
              connected
              emptyMessage={
                loadingSources
                  ? "Searching Wikipedia..."
                  : wikipediaResults.length > 0
                    ? ""
                    : "Find sources to see matching public overview pages."
              }
            >
              {wikipediaResults.map(
                (page) => (
                  <SourceOption
                    key={page.pageId}
                    selected={
                      selectedWikipediaTitle ===
                      page.title
                    }
                    onSelect={() =>
                      setSelectedWikipediaTitle(
                        selectedWikipediaTitle ===
                          page.title
                          ? ""
                          : page.title,
                      )
                    }
                    title={page.title}
                    badge="Community"
                    detail={
                      page.snippet ||
                      `${page.wordCount.toLocaleString(
                        "en-GB",
                      )} words`
                    }
                    url={page.url}
                    warning
                  />
                ),
              )}
            </SourceSelectionPanel>
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.025]">
            <header className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="jp-tone-automation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                  <Newspaper size={17} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Recent Company News
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Recent English-language coverage discovered through GDELT. Select up to five articles you consider relevant.
                  </p>
                </div>
              </div>

              <span className="jp-tone-automation inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium">
                {selectedNewsUrls.length}/5 selected
              </span>
            </header>

            <div className="jp-scroll-surface max-h-96 space-y-2 overflow-y-auto p-3">
              {newsResults.map(
                (article) => (
                  <SourceOption
                    key={article.url}
                    selected={
                      selectedNewsUrls.includes(
                        article.url,
                      )
                    }
                    onSelect={() =>
                      toggleNewsArticle(
                        article,
                      )
                    }
                    title={
                      article.title
                    }
                    badge={
                      article.domain ||
                      "News"
                    }
                    detail={[
                      article.publishedAt
                        ? `Published ${formatDate(
                            article.publishedAt,
                          )}`
                        : "",
                      article.sourceCountry,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                    url={
                      article.url
                    }
                    warning
                  />
                ),
              )}

              {!loadingSources &&
                newsResults.length ===
                  0 && (
                <div className="flex min-h-32 flex-col items-center justify-center px-4 text-center">
                  <Newspaper
                    size={20}
                    className="text-zinc-700"
                  />

                  <p className="mt-3 text-xs leading-5 text-zinc-600">
                    Find Sources to search the last 30 days of company coverage.
                  </p>
                </div>
              )}

              {loadingSources && (
                <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-zinc-600">
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                  />
                  Searching recent coverage...
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 px-4 py-3">
              <p className="text-xs leading-5 text-zinc-600">
                News is not treated as an official company statement. Open the original article and verify important details before using them in an application or interview.
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.035] p-5">
            <div className="flex items-start gap-3">
              <div className="jp-tone-document flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                <Link2 size={17} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Official Company Website
                </h3>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Add a website only when you have confirmed it belongs to the employer. BreakVeil saves the link and your note without scraping the site.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label>
                <span className="mb-2 block text-xs font-medium text-zinc-400">
                  Website URL
                </span>

                <input
                  value={officialWebsite}
                  onChange={(event) =>
                    setOfficialWebsite(
                      event.target.value,
                    )
                  }
                  placeholder="https://company.example"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-500/60"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-medium text-zinc-400">
                  Source Title
                </span>

                <input
                  value={
                    officialWebsiteTitle
                  }
                  onChange={(event) =>
                    setOfficialWebsiteTitle(
                      event.target.value,
                    )
                  }
                  placeholder="About Us, Careers, Company Website..."
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-500/60"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                Research Note
              </span>

              <textarea
                rows="4"
                value={
                  officialWebsiteNote
                }
                onChange={(event) =>
                  setOfficialWebsiteNote(
                    event.target.value,
                  )
                }
                placeholder="Add a concise fact or observation from the official site."
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-500/60"
              />
            </label>
          </section>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-zinc-600">
            Current research is kept as a previous snapshot when this report is refreshed.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={buildReport}
              disabled={
                buildingReport ||
                (
                  !selectedCompanyNumber &&
                  !selectedWikipediaTitle &&
                  !officialWebsite.trim() &&
                  selectedNewsUrls.length ===
                    0
                )
              }
              className="jp-button-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
            >
              {buildingReport ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <FileSearch size={16} />
              )}

              Build Cited Research
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function SourceSelectionPanel({
  icon: Icon,
  title,
  description,
  connected,
  emptyMessage,
  children,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/20">
      <header className="flex items-start gap-3 border-b border-zinc-800 p-4">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",

            connected
              ? "jp-tone-document"
              : "jp-tone-neutral",
          ].join(" ")}
        >
          <Icon size={17} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            {description}
          </p>
        </div>
      </header>

      <div className="jp-scroll-surface max-h-80 space-y-2 overflow-y-auto p-3">
        {children}

        {emptyMessage && (
          <div className="flex min-h-32 flex-col items-center justify-center px-4 text-center">
            <Search
              size={20}
              className="text-zinc-700"
            />

            <p className="mt-3 text-xs leading-5 text-zinc-600">
              {emptyMessage}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function SourceOption({
  selected,
  onSelect,
  title,
  badge,
  detail,
  url,
  warning = false,
}) {
  return (
    <article
      className={[
        "rounded-xl border p-4 transition",

        selected
          ? warning
            ? "border-amber-500/30 bg-amber-500/[0.07]"
            : "border-indigo-500/35 bg-indigo-500/[0.07]"
          : "border-zinc-800 bg-zinc-900/35 hover:border-zinc-700",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          className={[
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",

            selected
              ? warning
                ? "border-amber-400 bg-amber-400 text-black"
                : "border-indigo-400 bg-indigo-400 text-black"
              : "border-zinc-700 text-transparent hover:border-zinc-500",
          ].join(" ")}
        >
          <Check size={13} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-zinc-300">
              {title}
            </p>

            {badge && (
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",

                  warning
                    ? "jp-tone-warning"
                    : "jp-tone-success",
                ].join(" ")}
              >
                {badge}
              </span>
            )}
          </div>

          {detail && (
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-600">
              {detail}
            </p>
          )}
        </div>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </article>
  )
}

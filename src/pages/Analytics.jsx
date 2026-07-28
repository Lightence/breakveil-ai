import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  Layers3,
  MessageSquareReply,
  Search,
  Target,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
} from "lucide-react"

import {
  Link,
} from "react-router-dom"

import {
  formatPreferenceDate,
} from "../lib/uiPreferences"

import {
  getJobStatusClass,
} from "../lib/semanticUi"

const jobsStorageKey =
  "jobpilot.jobs"

const queueStorageKey =
  "jobpilot.application-queue"

const rangeOptions = [
  {
    value:
      "30",
    label:
      "Past 30 Days",
  },
  {
    value:
      "90",
    label:
      "Past 90 Days",
  },
  {
    value:
      "365",
    label:
      "Past Year",
  },
  {
    value:
      "all",
    label:
      "All Time",
  },
]

const pipelineStatuses = [
  {
    name:
      "Saved",
    description:
      "Opportunities not yet applied for",
  },
  {
    name:
      "Applied",
    description:
      "Applications awaiting a response",
  },
  {
    name:
      "Interview",
    description:
      "Active interview processes",
  },
  {
    name:
      "Offer",
    description:
      "Offers currently recorded",
  },
  {
    name:
      "Rejected",
    description:
      "Applications that did not progress",
  },
]

const applicationStatuses = [
  "Draft",
  "Ready for Review",
  "Approved",
  "Sent",
]

function loadStoredArray(
  storageKey,
) {
  try {
    const storedValue =
      localStorage.getItem(
        storageKey,
      )

    const parsedValue =
      storedValue
        ? JSON.parse(
            storedValue,
          )
        : []

    return Array.isArray(
      parsedValue,
    )
      ? parsedValue
      : []
  } catch {
    return []
  }
}

function getSafeDate(
  value,
) {
  if (!value) {
    return null
  }

  const date =
    new Date(
      value,
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date
}

function getSafeTime(
  value,
) {
  return (
    getSafeDate(
      value,
    )?.getTime() ||
    0
  )
}

function formatDate(
  value,
) {
  return formatPreferenceDate(
    value,
  )
}

function formatPercent(
  value,
) {
  return `${Math.round(
    Number(
      value ||
      0,
    ),
  )}%`
}

function safeRate(
  numerator,
  denominator,
) {
  if (
    !denominator
  ) {
    return 0
  }

  return (
    numerator /
    denominator
  ) * 100
}

function getPackageDate(
  applicationPackage,
) {
  return (
    applicationPackage?.sentAt ||
    applicationPackage?.gmailSentAt ||
    applicationPackage?.gmailDraftCreatedAt ||
    applicationPackage?.updatedAt ||
    applicationPackage?.createdAt ||
    ""
  )
}

function getApplicationDate(
  job,
  applicationPackage,
) {
  return (
    job?.dateApplied ||
    applicationPackage?.sentAt ||
    applicationPackage?.gmailSentAt ||
    (
      hasApplied(
        job,
        applicationPackage,
      )
        ? job?.updatedAt ||
          job?.createdAt ||
          getPackageDate(
            applicationPackage,
          )
        : ""
    )
  )
}

function getOutcomeDate(
  job,
) {
  if (
    job?.status ===
    "Interview"
  ) {
    return (
      job.interviewDate ||
      job.updatedAt ||
      ""
    )
  }

  if (
    job?.status ===
    "Offer"
  ) {
    return (
      job.offerDate ||
      job.updatedAt ||
      ""
    )
  }

  if (
    job?.status ===
    "Rejected"
  ) {
    return (
      job.rejectedAt ||
      job.updatedAt ||
      ""
    )
  }

  return (
    job?.updatedAt ||
    ""
  )
}

function hasApplied(
  job,
  applicationPackage,
) {
  return Boolean(
    job?.dateApplied ||
    [
      "Applied",
      "Interview",
      "Offer",
      "Rejected",
    ].includes(
      job?.status,
    ) ||
    applicationPackage?.status ===
      "Sent" ||
    applicationPackage?.sentAt,
  )
}

function hasResponse(
  job,
) {
  return Boolean(
    [
      "Interview",
      "Offer",
      "Rejected",
    ].includes(
      job?.status,
    ) ||
    job?.responseDate ||
    job?.interviewDate ||
    job?.offerDate ||
    job?.rejectedAt,
  )
}

function hasInterview(
  job,
) {
  return Boolean(
    [
      "Interview",
      "Offer",
    ].includes(
      job?.status,
    ) ||
    job?.interviewDate,
  )
}

function hasOffer(
  job,
) {
  return Boolean(
    job?.status ===
      "Offer" ||
    job?.offerDate,
  )
}

function getRangeStart(
  range,
) {
  if (
    range ===
    "all"
  ) {
    return null
  }

  const days =
    Number(
      range,
    )

  if (
    !Number.isFinite(
      days,
    )
  ) {
    return null
  }

  const start =
    new Date()

  start.setHours(
    0,
    0,
    0,
    0,
  )

  start.setDate(
    start.getDate() -
    days,
  )

  return start
}

function dateWithinRange(
  value,
  range,
) {
  if (
    range ===
    "all"
  ) {
    return true
  }

  const date =
    getSafeDate(
      value,
    )

  if (!date) {
    return false
  }

  const rangeStart =
    getRangeStart(
      range,
    )

  return (
    !rangeStart ||
    date.getTime() >=
      rangeStart.getTime()
  )
}

function getJobSources(
  job,
) {
  const explicitSources =
    Array.isArray(
      job?.sourceNames,
    )
      ? job.sourceNames
      : []

  const values = [
    ...explicitSources,
    job?.sourceName,
    job?.source,
  ]
    .map(
      (value) =>
        String(
          value ||
          "",
        ).trim(),
    )
    .filter(Boolean)

  const uniqueValues = [
    ...new Set(
      values,
    ),
  ]

  return uniqueValues.length >
    0
    ? uniqueValues
    : [
        job?.importedFromLiveSearch
          ? "Imported Search"
          : "Manual Entry",
      ]
}

function normaliseGroupKey(
  value,
) {
  return String(
    value ||
      "Unknown",
  )
    .trim()
    .toLowerCase()
}

function buildTrendData(
  applications,
  range,
) {
  const now =
    new Date()

  if (
    range === "30" ||
    range === "90"
  ) {
    const bucketDays =
      range === "30"
        ? 7
        : 15

    const buckets =
      Array.from(
        {
          length:
            6,
        },
        (
          _,
          index,
        ) => {
          const bucketEnd =
            new Date(
              now,
            )

          bucketEnd.setHours(
            23,
            59,
            59,
            999,
          )

          bucketEnd.setDate(
            now.getDate() -
            (
              (
                5 -
                index
              ) *
              bucketDays
            ),
          )

          const bucketStart =
            new Date(
              bucketEnd,
            )

          bucketStart.setHours(
            0,
            0,
            0,
            0,
          )

          bucketStart.setDate(
            bucketEnd.getDate() -
            (
              bucketDays -
              1
            ),
          )

          return {
            label:
              `${bucketStart.toLocaleDateString(
                "en-GB",
                {
                  day:
                    "numeric",

                  month:
                    "short",
                },
              )}`,

            start:
              bucketStart,

            end:
              bucketEnd,

            count:
              0,
          }
        },
      )

    for (
      const application
      of applications
    ) {
      const date =
        getSafeDate(
          application.analyticsDate,
        )

      if (!date) {
        continue
      }

      const bucket =
        buckets.find(
          (item) =>
            date.getTime() >=
              item.start.getTime() &&
            date.getTime() <=
              item.end.getTime(),
        )

      if (bucket) {
        bucket.count +=
          1
      }
    }

    return buckets
  }

  const buckets =
    Array.from(
      {
        length:
          6,
      },
      (
        _,
        index,
      ) => {
        const date =
          new Date(
            now.getFullYear(),
            now.getMonth() -
              (
                5 -
                index
              ),
            1,
          )

        return {
          label:
            date.toLocaleDateString(
              "en-GB",
              {
                month:
                  "short",

                year:
                  "2-digit",
              },
            ),

          year:
            date.getFullYear(),

          month:
            date.getMonth(),

          count:
            0,
        }
      },
    )

  for (
    const application
    of applications
  ) {
    const date =
      getSafeDate(
        application.analyticsDate,
      )

    if (!date) {
      continue
    }

    const bucket =
      buckets.find(
        (item) =>
          item.year ===
            date.getFullYear() &&
          item.month ===
            date.getMonth(),
      )

    if (bucket) {
      bucket.count +=
        1
    }
  }

  return buckets
}

function statusClass(
  status,
) {
  return getJobStatusClass(
    status,
  )
}

export default function Analytics() {
  const [
    jobs,
    setJobs,
  ] = useState(
    () =>
      loadStoredArray(
        jobsStorageKey,
      ),
  )

  const [
    queue,
    setQueue,
  ] = useState(
    () =>
      loadStoredArray(
        queueStorageKey,
      ),
  )

  const [
    range,
    setRange,
  ] = useState(
    "90",
  )

  useEffect(() => {
    function refreshJobs() {
      setJobs(
        loadStoredArray(
          jobsStorageKey,
        ),
      )
    }

    function refreshQueue() {
      setQueue(
        loadStoredArray(
          queueStorageKey,
        ),
      )
    }

    function refreshEverything() {
      refreshJobs()
      refreshQueue()
    }

    window.addEventListener(
      "focus",
      refreshEverything,
    )

    window.addEventListener(
      "storage",
      refreshEverything,
    )

    window.addEventListener(
      "jobpilot:jobs-updated",
      refreshJobs,
    )

    window.addEventListener(
      "jobpilot:queue-updated",
      refreshQueue,
    )

    return () => {
      window.removeEventListener(
        "focus",
        refreshEverything,
      )

      window.removeEventListener(
        "storage",
        refreshEverything,
      )

      window.removeEventListener(
        "jobpilot:jobs-updated",
        refreshJobs,
      )

      window.removeEventListener(
        "jobpilot:queue-updated",
        refreshQueue,
      )
    }
  }, [])

  const analytics =
    useMemo(
      () => {
        const packageByJobId =
          new Map()

        for (
          const applicationPackage
          of queue
        ) {
          if (
            applicationPackage
              ?.jobId
          ) {
            packageByJobId.set(
              applicationPackage.jobId,
              applicationPackage,
            )
          }
        }

        const allApplications =
          jobs
            .filter(
              (job) =>
                hasApplied(
                  job,
                  packageByJobId.get(
                    job.id,
                  ),
                ),
            )
            .map(
              (job) => {
                const applicationPackage =
                  packageByJobId.get(
                    job.id,
                  )

                return {
                  ...job,

                  applicationPackage,

                  analyticsDate:
                    getApplicationDate(
                      job,
                      applicationPackage,
                    ),
                }
              },
            )

        const applications =
          allApplications.filter(
            (job) =>
              dateWithinRange(
                job.analyticsDate,
                range,
              ),
          )

        const responses =
          applications.filter(
            hasResponse,
          )

        const interviews =
          applications.filter(
            hasInterview,
          )

        const offers =
          applications.filter(
            hasOffer,
          )

        const rejected =
          applications.filter(
            (job) =>
              job.status ===
              "Rejected",
          )

        const pending =
          applications.filter(
            (job) =>
              job.status ===
              "Applied",
          )

        const scores =
          applications
            .map(
              (job) =>
                Number(
                  job.matchScore ||
                  job.assistantAnalysis
                    ?.score ||
                  0,
                ),
            )
            .filter(
              (score) =>
                Number.isFinite(
                  score,
                ) &&
                score >
                0,
            )

        const averageMatch =
          scores.length >
          0
            ? scores.reduce(
                (
                  total,
                  score,
                ) =>
                  total +
                  score,
                0,
              ) /
              scores.length
            : 0

        const currentPipeline =
          Object.fromEntries(
            pipelineStatuses.map(
              (status) => [
                status.name,
                jobs.filter(
                  (job) =>
                    (
                      job.status ||
                      "Saved"
                    ) ===
                    status.name,
                ).length,
              ],
            ),
          )

        const queueCounts =
          Object.fromEntries(
            applicationStatuses.map(
              (status) => [
                status,
                queue.filter(
                  (
                    applicationPackage,
                  ) =>
                    applicationPackage.status ===
                    status,
                ).length,
              ],
            ),
          )

        const roleGroups =
          new Map()

        for (
          const job
          of applications
        ) {
          const label =
            String(
              job.role ||
              "Untitled Job",
            ).trim()

          const key =
            normaliseGroupKey(
              label,
            )

          const existing =
            roleGroups.get(
              key,
            ) || {
              label,
              applications:
                0,
              responses:
                0,
              interviews:
                0,
              offers:
                0,
              scoreTotal:
                0,
              scoreCount:
                0,
            }

          existing.applications +=
            1

          if (
            hasResponse(
              job,
            )
          ) {
            existing.responses +=
              1
          }

          if (
            hasInterview(
              job,
            )
          ) {
            existing.interviews +=
              1
          }

          if (
            hasOffer(
              job,
            )
          ) {
            existing.offers +=
              1
          }

          const score =
            Number(
              job.matchScore ||
              job.assistantAnalysis
                ?.score ||
              0,
            )

          if (
            Number.isFinite(
              score,
            ) &&
            score >
            0
          ) {
            existing.scoreTotal +=
              score

            existing.scoreCount +=
              1
          }

          roleGroups.set(
            key,
            existing,
          )
        }

        const rolePerformance = [
          ...roleGroups.values(),
        ]
          .map(
            (group) => ({
              ...group,

              averageMatch:
                group.scoreCount >
                0
                  ? group.scoreTotal /
                    group.scoreCount
                  : 0,
            }),
          )
          .sort(
            (
              first,
              second,
            ) =>
              second.applications -
                first.applications ||
              second.responses -
                first.responses ||
              second.averageMatch -
                first.averageMatch,
          )
          .slice(
            0,
            6,
          )

        const sourceGroups =
          new Map()

        for (
          const job
          of applications
        ) {
          for (
            const source
            of getJobSources(
              job,
            )
          ) {
            const key =
              normaliseGroupKey(
                source,
              )

            const existing =
              sourceGroups.get(
                key,
              ) || {
                label:
                  source,

                applications:
                  0,

                responses:
                  0,

                interviews:
                  0,

                offers:
                  0,
              }

            existing.applications +=
              1

            if (
              hasResponse(
                job,
              )
            ) {
              existing.responses +=
                1
            }

            if (
              hasInterview(
                job,
              )
            ) {
              existing.interviews +=
                1
            }

            if (
              hasOffer(
                job,
              )
            ) {
              existing.offers +=
                1
            }

            sourceGroups.set(
              key,
              existing,
            )
          }
        }

        const sourcePerformance = [
          ...sourceGroups.values(),
        ]
          .sort(
            (
              first,
              second,
            ) =>
              second.applications -
                first.applications ||
              second.responses -
                first.responses,
          )
          .slice(
            0,
            6,
          )

        const recentOutcomes =
          jobs
            .filter(
              (job) =>
                [
                  "Interview",
                  "Offer",
                  "Rejected",
                ].includes(
                  job.status,
                ),
            )
            .sort(
              (
                first,
                second,
              ) =>
                getSafeTime(
                  getOutcomeDate(
                    second,
                  ),
                ) -
                getSafeTime(
                  getOutcomeDate(
                    first,
                  ),
                ),
            )
            .slice(
              0,
              6,
            )

        return {
          applications,
          allApplications,
          responses,
          interviews,
          offers,
          rejected,
          pending,
          averageMatch,
          currentPipeline,
          queueCounts,
          rolePerformance,
          sourcePerformance,
          recentOutcomes,
          trend:
            buildTrendData(
              applications,
              range,
            ),
          responseRate:
            safeRate(
              responses.length,
              applications.length,
            ),
          interviewRate:
            safeRate(
              interviews.length,
              applications.length,
            ),
          offerRate:
            safeRate(
              offers.length,
              applications.length,
            ),
        }
      },
      [
        jobs,
        queue,
        range,
      ],
    )

  const selectedRange =
    rangeOptions.find(
      (option) =>
        option.value ===
        range,
    )?.label ||
    "Selected Period"

  if (
    jobs.length ===
    0
  ) {
    return (
      <EmptyAnalytics />
    )
  }

  const headlineStats = [
    {
      label:
        "Applications",
      value:
        analytics.applications
          .length,
      detail:
        `${analytics.pending.length} awaiting response`,
      icon:
        Briefcase,
    },
    {
      label:
        "Response Rate",
      value:
        formatPercent(
          analytics.responseRate,
        ),
      detail:
        `${analytics.responses.length} recorded responses`,
      icon:
        MessageSquareReply,
    },
    {
      label:
        "Interview Rate",
      value:
        formatPercent(
          analytics.interviewRate,
        ),
      detail:
        `${analytics.interviews.length} interview process${analytics.interviews.length === 1 ? "" : "es"}`,
      icon:
        Users,
    },
    {
      label:
        "Offer Rate",
      value:
        formatPercent(
          analytics.offerRate,
        ),
      detail:
        `${analytics.offers.length} recorded offer${analytics.offers.length === 1 ? "" : "s"}`,
      icon:
        Trophy,
    },
    {
      label:
        "Average Match",
      value:
        analytics.averageMatch >
        0
          ? formatPercent(
              analytics.averageMatch,
            )
          : "—",
      detail:
        analytics.averageMatch >
        0
          ? "Across scored applications"
          : "No scored applications yet",
      icon:
        Gauge,
    },
  ]

  return (
    <div className="min-w-0 pb-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Job-Search Performance
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Analytics
          </h1>

          <p className="mt-2 max-w-3xl text-zinc-400">
            Review application activity, conversion rates and the roles and sources producing the strongest progress.
          </p>
        </div>

        <label className="block w-full lg:w-48">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-600">
            Performance Period
          </span>

          <select
            value={
              range
            }
            onChange={(event) =>
              setRange(
                event.target.value,
              )
            }
            className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-zinc-500"
          >
            {rangeOptions.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              ),
            )}
          </select>
        </label>
      </header>

      <div className="jp-grid-compact mt-8 gap-4">
        {headlineStats.map(
          (stat) => (
            <MetricCard
              key={
                stat.label
              }
              {...stat}
            />
          ),
        )}
      </div>

      <div className="jp-grid-panels jp-grid-equal mt-6 gap-6">
        <ApplicationTrend
          data={
            analytics.trend
          }
          period={
            selectedRange
          }
        />

        <ConversionPanel
          applications={
            analytics.applications.length
          }
          responses={
            analytics.responses.length
          }
          interviews={
            analytics.interviews.length
          }
          offers={
            analytics.offers.length
          }
          rejected={
            analytics.rejected.length
          }
        />
      </div>

      <div className="jp-grid-panels jp-grid-equal mt-6 gap-6">
        <CurrentPipeline
          counts={
            analytics.currentPipeline
          }
          total={
            jobs.length
          }
        />

        <ApplicationPreparation
          counts={
            analytics.queueCounts
          }
          total={
            queue.length
          }
        />
      </div>

      <div className="jp-grid-panels jp-grid-equal mt-6 gap-6">
        <PerformanceTable
          title="Role Performance"
          description={`Application progress by job title during ${selectedRange.toLowerCase()}.`}
          icon={
            Target
          }
          rows={
            analytics.rolePerformance
          }
          emptyMessage="Apply to more roles to compare performance by job title."
          showMatch
        />

        <PerformanceTable
          title="Source Performance"
          description={`Application progress by vacancy source during ${selectedRange.toLowerCase()}.`}
          icon={
            Search
          }
          rows={
            analytics.sourcePerformance
          }
          emptyMessage="Source information will appear after imported vacancies are applied for."
        />
      </div>

      <div className="jp-grid-sidebar jp-grid-equal mt-6 gap-6">
        <RecentOutcomes
          jobs={
            analytics.recentOutcomes
          }
        />

        <AnalyticsNotes
          range={
            range
          }
          applications={
            analytics.applications.length
          }
          allApplications={
            analytics.allApplications.length
          }
        />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon:
    Icon,
}) {
  return (
    <article className="min-w-0 rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-400">
            {label}
          </p>

          <p className="mt-2 truncate text-3xl font-bold tracking-tight">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300">
          <Icon
            size={18}
          />
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-zinc-600">
        {detail}
      </p>
    </article>
  )
}

function ApplicationTrend({
  data,
  period,
}) {
  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          item.count,
      ),
      1,
    )

  const total =
    data.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        item.count,
      0,
    )

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <PanelHeader
        icon={
          TrendingUp
        }
        title="Application Activity"
        description={`Applications recorded across ${period.toLowerCase()}.`}
      >
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
          {total} Total
        </span>
      </PanelHeader>

      <div className="p-5 sm:p-6">
        <div className="flex h-56 items-end gap-3 sm:gap-4">
          {data.map(
            (item) => {
              const height =
                item.count >
                0
                  ? Math.max(
                      12,
                      (
                        item.count /
                        maximum
                      ) *
                        100,
                    )
                  : 3

              return (
                <div
                  key={
                    item.label
                  }
                  className="flex min-w-0 flex-1 flex-col items-center"
                >
                  <span className="mb-2 text-xs font-semibold text-zinc-400">
                    {
                      item.count
                    }
                  </span>

                  <div className="flex h-40 w-full items-end overflow-hidden rounded-lg bg-zinc-900/70">
                    <div
                      className={[
                        "w-full rounded-t-lg transition-all",

                        item.count >
                        0
                          ? "bg-sky-400/70"
                          : "bg-zinc-800",
                      ].join(
                        " ",
                      )}
                      style={{
                        height:
                          `${height}%`,
                      }}
                    />
                  </div>

                  <span
                    className="mt-3 w-full truncate text-center text-[11px] text-zinc-600"
                    title={
                      item.label
                    }
                  >
                    {
                      item.label
                    }
                  </span>
                </div>
              )
            },
          )}
        </div>

        {total ===
          0 && (
          <p className="mt-4 text-center text-sm text-zinc-600">
            No applications have a recorded date inside this period.
          </p>
        )}
      </div>
    </section>
  )
}

function ConversionPanel({
  applications,
  responses,
  interviews,
  offers,
  rejected,
}) {
  const rows = [
    {
      label:
        "Applications",
      value:
        applications,
      percent:
        applications >
        0
          ? 100
          : 0,
    },
    {
      label:
        "Responses",
      value:
        responses,
      percent:
        safeRate(
          responses,
          applications,
        ),
    },
    {
      label:
        "Interviews",
      value:
        interviews,
      percent:
        safeRate(
          interviews,
          applications,
        ),
    },
    {
      label:
        "Offers",
      value:
        offers,
      percent:
        safeRate(
          offers,
          applications,
        ),
    },
  ]

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <PanelHeader
        icon={
          Layers3
        }
        title="Application Conversion"
        description="How far recorded applications progressed."
      />

      <div className="space-y-5 p-5 sm:p-6">
        {rows.map(
          (row) => (
            <div
              key={
                row.label
              }
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-zinc-400">
                  {
                    row.label
                  }
                </p>

                <p className="text-sm font-semibold text-zinc-200">
                  {row.value}{" "}
                  <span className="font-normal text-zinc-600">
                    ({formatPercent(row.percent)})
                  </span>
                </p>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-violet-400/75 transition-all"
                  style={{
                    width:
                      `${Math.min(
                        100,
                        row.percent,
                      )}%`,
                  }}
                />
              </div>
            </div>
          ),
        )}

        <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <XCircle
            size={16}
            className="mt-0.5 shrink-0 text-zinc-500"
          />

          <p className="text-xs leading-5 text-zinc-600">
            {rejected} application{rejected === 1 ? "" : "s"} in this period currently show a Rejected outcome.
          </p>
        </div>
      </div>
    </section>
  )
}

function CurrentPipeline({
  counts,
  total,
}) {
  const maximum =
    Math.max(
      ...Object.values(
        counts,
      ),
      1,
    )

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <PanelHeader
        icon={
          BarChart3
        }
        title="Current Pipeline"
        description="The present status of every tracked opportunity."
      >
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
          {total} Tracked
        </span>
      </PanelHeader>

      <div className="space-y-4 p-5 sm:p-6">
        {pipelineStatuses.map(
          (status) => {
            const count =
              counts[
                status.name
              ] ||
              0

            return (
              <div
                key={
                  status.name
                }
                className="grid gap-3 sm:grid-cols-[115px_minmax(0,1fr)_42px] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    {
                      status.name
                    }
                  </p>

                  <p className="mt-1 text-[11px] leading-4 text-zinc-600 sm:hidden">
                    {
                      status.description
                    }
                  </p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-sky-400/70 transition-all"
                    style={{
                      width:
                        `${(
                          count /
                          maximum
                        ) *
                        100}%`,
                    }}
                  />
                </div>

                <p className="text-right text-sm font-semibold text-zinc-300">
                  {count}
                </p>
              </div>
            )
          },
        )}
      </div>
    </section>
  )
}

function ApplicationPreparation({
  counts,
  total,
}) {
  const cards = [
    {
      status:
        "Draft",
      icon:
        FileCheck2,
    },
    {
      status:
        "Ready for Review",
      icon:
        Clock3,
    },
    {
      status:
        "Approved",
      icon:
        CheckCircle2,
    },
    {
      status:
        "Sent",
      icon:
        Briefcase,
    },
  ]

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <PanelHeader
        icon={
          FileCheck2
        }
        title="Application Preparation"
        description="The current state of prepared application packages."
      >
        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
          {total} Package{total === 1 ? "" : "s"}
        </span>
      </PanelHeader>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {cards.map(
          (card) => {
            const Icon =
              card.icon

            return (
              <div
                key={
                  card.status
                }
                className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400">
                  <Icon
                    size={16}
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-300">
                    {
                      card.status
                    }
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {counts[card.status] || 0}
                  </p>
                </div>
              </div>
            )
          },
        )}
      </div>
    </section>
  )
}

function PerformanceTable({
  title,
  description,
  icon,
  rows,
  emptyMessage,
  showMatch = false,
}) {
  const Icon =
    icon

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <PanelHeader
        icon={
          Icon
        }
        title={
          title
        }
        description={
          description
        }
      />

      {rows.length ===
      0 ? (
        <div className="flex min-h-52 items-center justify-center px-6 text-center">
          <p className="max-w-md text-sm leading-6 text-zinc-600">
            {
              emptyMessage
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[610px]">
            <div className="grid grid-cols-[minmax(190px,1fr)_82px_82px_82px_82px] border-b border-zinc-800 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <span>
                {
                  title ===
                  "Role Performance"
                    ? "Job Title"
                    : "Source"
                }
              </span>

              <span className="text-right">
                Applied
              </span>

              <span className="text-right">
                Responses
              </span>

              <span className="text-right">
                Interviews
              </span>

              <span className="text-right">
                {showMatch
                  ? "Avg Match"
                  : "Offers"}
              </span>
            </div>

            <div className="divide-y divide-zinc-800">
              {rows.map(
                (row) => (
                  <div
                    key={
                      row.label
                    }
                    className="grid grid-cols-[minmax(190px,1fr)_82px_82px_82px_82px] items-center px-5 py-4 text-sm"
                  >
                    <span
                      className="truncate font-medium text-zinc-300"
                      title={
                        row.label
                      }
                    >
                      {
                        row.label
                      }
                    </span>

                    <span className="text-right text-zinc-400">
                      {
                        row.applications
                      }
                    </span>

                    <span className="text-right text-zinc-400">
                      {
                        row.responses
                      }
                    </span>

                    <span className="text-right text-zinc-400">
                      {
                        row.interviews
                      }
                    </span>

                    <span className="text-right font-medium text-zinc-300">
                      {showMatch
                        ? row.averageMatch >
                          0
                          ? formatPercent(
                              row.averageMatch,
                            )
                          : "—"
                        : row.offers}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function RecentOutcomes({
  jobs,
}) {
  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <PanelHeader
        icon={
          CalendarDays
        }
        title="Recent Outcomes"
        description="The most recently updated interviews, offers and rejections."
      >
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 transition hover:text-white"
        >
          View My Jobs
          <ArrowRight
            size={14}
          />
        </Link>
      </PanelHeader>

      {jobs.length ===
      0 ? (
        <div className="flex min-h-48 items-center justify-center px-6 text-center">
          <p className="max-w-md text-sm leading-6 text-zinc-600">
            Interview, offer and rejection outcomes will appear here as your tracked jobs progress.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {jobs.map(
            (job) => (
              <Link
                key={
                  job.id
                }
                to={`/jobs/${job.id}`}
                className="group flex flex-col justify-between gap-3 px-5 py-4 transition hover:bg-zinc-800/35 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-200">
                    {
                      job.role ||
                      "Untitled Job"
                    }
                  </p>

                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {
                      job.company ||
                      "Company Not Set"
                    }
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-xs font-medium",

                      statusClass(
                        job.status,
                      ),
                    ].join(
                      " ",
                    )}
                  >
                    {
                      job.status
                    }
                  </span>

                  <span className="text-xs text-zinc-600">
                    {formatDate(
                      getOutcomeDate(
                        job,
                      ),
                    ) ||
                      "Date Not Recorded"}
                  </span>

                  <ArrowRight
                    size={14}
                    className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-300"
                  />
                </div>
              </Link>
            ),
          )}
        </div>
      )}
    </section>
  )
}

function AnalyticsNotes({
  range,
  applications,
  allApplications,
}) {
  const missingFromRange =
    Math.max(
      0,
      allApplications -
      applications,
    )

  return (
    <aside className="h-fit rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-400">
          <Target
            size={17}
          />
        </div>

        <div>
          <h2 className="font-semibold">
            How Analytics Works
          </h2>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Figures are calculated from the jobs and application packages saved locally in BreakVeil.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-600">
        <p>
          Current Pipeline always includes every tracked job, regardless of the selected performance period.
        </p>

        <p>
          Response, interview and offer rates use the current saved status and any available application or interview dates.
        </p>

        {range !==
          "all" &&
          missingFromRange >
            0 && (
            <p>
              {missingFromRange} older application{missingFromRange === 1 ? "" : "s"} sit outside the selected period.
            </p>
          )}

        <p>
          Older jobs without a recorded application date may appear only under All Time.
        </p>
      </div>
    </aside>
  )
}

function PanelHeader({
  icon:
    Icon,
  title,
  description,
  children,
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300">
          <Icon
            size={17}
          />
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {
              description
            }
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

function EmptyAnalytics() {
  return (
    <div className="min-w-0 pb-8">
      <header>
        <p className="text-sm font-medium text-zinc-500">
          Job-Search Performance
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Analytics
        </h1>

        <p className="mt-2 max-w-3xl text-zinc-400">
          Review application activity, conversion rates and the roles and sources producing the strongest progress.
        </p>
      </header>

      <section className="mt-8 flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-[#131313] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
          <BarChart3
            size={24}
          />
        </div>

        <h2 className="mt-5 text-xl font-semibold">
          No Job Data Yet
        </h2>

        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">
          Track opportunities and update their progress to build useful application, response, interview and offer analytics.
        </p>

        <Link
          to="/jobs"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Briefcase
            size={16}
          />
          Open Jobs
        </Link>
      </section>
    </div>
  )
}

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react"

import {
  Link,
} from "react-router-dom"

import {
  formatPreferenceDate,
} from "../lib/uiPreferences"

import {
  getJobStatusClass,
  getPipelineBarClass,
} from "../lib/semanticUi"

const jobsStorageKey =
  "jobpilot.jobs"

const profileStorageKey =
  "jobpilot.candidate-profile"

const discoveryResultsStorageKey =
  "jobpilot.discovery-results"

const jobsViewStorageKey =
  "jobpilot.jobs-view"

const pipelineStatuses = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
]

function loadStoredArray(
  storageKey,
) {
  try {
    const savedValue =
      localStorage.getItem(
        storageKey,
      )

    const parsedValue =
      savedValue
        ? JSON.parse(
            savedValue,
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

function loadProfile() {
  try {
    const savedProfile =
      localStorage.getItem(
        profileStorageKey,
      )

    const parsedProfile =
      savedProfile
        ? JSON.parse(
            savedProfile,
          )
        : {}

    return parsedProfile &&
      typeof parsedProfile ===
        "object" &&
      !Array.isArray(
        parsedProfile,
      )
      ? parsedProfile
      : {}
  } catch {
    return {}
  }
}

function getDisplayName(
  profile,
) {
  const preferredName =
    String(
      profile?.preferredName ||
        "",
    ).trim()

  if (preferredName) {
    return preferredName
  }

  const fullName =
    String(
      profile?.fullName ||
        "",
    ).trim()

  return fullName
    ? fullName.split(
        /\s+/,
      )[0]
    : ""
}

function getSafeTime(
  value,
) {
  if (!value) {
    return 0
  }

  const time =
    new Date(
      value,
    ).getTime()

  return Number.isNaN(
    time,
  )
    ? 0
    : time
}

function formatDate(
  value,
) {
  return formatPreferenceDate(
    value,
  )
}

function formatCompactDateTime(
  value,
) {
  if (!value) {
    return ""
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ""
  }

  const today =
    new Date()

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`
  }

  return formatPreferenceDate(
    date,
  )
}

function getActionDate(
  job,
) {
  if (
    job?.nextActionDate
  ) {
    return job.nextActionDate
  }

  if (
    job?.followUpDate
  ) {
    return job.followUpDate
  }

  if (
    job?.status ===
      "Interview" &&
    job?.interviewDate
  ) {
    return job.interviewDate
  }

  return ""
}

function getNextAction(
  job,
) {
  const savedAction =
    String(
      job?.nextAction ||
        "",
    ).trim()

  if (
    savedAction &&
    savedAction.toLowerCase() !==
      "none"
  ) {
    return savedAction
  }

  const defaults = {
    Saved:
      "Review job",
    Applied:
      "Wait for response",
    Interview:
      "Prepare for interview",
    Offer:
      "Review offer",
    Rejected:
      "No action needed",
  }

  return (
    defaults[
      job?.status
    ] ||
    "Review job"
  )
}

function jobNeedsAttention(
  job,
) {
  if (
    ["Rejected"].includes(
      job?.status,
    )
  ) {
    return false
  }

  const action =
    getNextAction(
      job,
    )

  return (
    action !==
      "Wait for response" &&
    action !==
      "No action needed"
  )
}

function isActionOverdue(
  job,
) {
  const actionDate =
    getActionDate(
      job,
    )

  if (!actionDate) {
    return false
  }

  const due =
    new Date(
      `${actionDate}T23:59:59`,
    )

  if (
    Number.isNaN(
      due.getTime(),
    )
  ) {
    return false
  }

  return (
    due.getTime() <
    Date.now()
  )
}

function sortPriorityJobs(
  first,
  second,
) {
  const firstOverdue =
    isActionOverdue(
      first,
    )
      ? 1
      : 0

  const secondOverdue =
    isActionOverdue(
      second,
    )
      ? 1
      : 0

  if (
    firstOverdue !==
    secondOverdue
  ) {
    return (
      secondOverdue -
      firstOverdue
    )
  }

  const firstDate =
    getSafeTime(
      getActionDate(
        first,
      ),
    )

  const secondDate =
    getSafeTime(
      getActionDate(
        second,
      ),
    )

  if (
    firstDate &&
    secondDate &&
    firstDate !==
      secondDate
  ) {
    return (
      firstDate -
      secondDate
    )
  }

  if (
    firstDate !==
    secondDate
  ) {
    return firstDate
      ? -1
      : 1
  }

  return (
    getSafeTime(
      second.updatedAt ||
        second.createdAt,
    ) -
    getSafeTime(
      first.updatedAt ||
        first.createdAt,
    )
  )
}

export default function Dashboard() {
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
    profile,
    setProfile,
  ] = useState(
    loadProfile,
  )

  const [
    discoveryResults,
    setDiscoveryResults,
  ] = useState(
    () =>
      loadStoredArray(
        discoveryResultsStorageKey,
      ),
  )

  useEffect(() => {
    function refreshJobs() {
      setJobs(
        loadStoredArray(
          jobsStorageKey,
        ),
      )
    }

    function refreshProfile() {
      setProfile(
        loadProfile(),
      )
    }

    function refreshDiscoveryResults() {
      setDiscoveryResults(
        loadStoredArray(
          discoveryResultsStorageKey,
        ),
      )
    }

    function refreshEverything() {
      refreshJobs()
      refreshProfile()
      refreshDiscoveryResults()
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
      "jobpilot:profile-updated",
      refreshProfile,
    )

    window.addEventListener(
      "jobpilot:discovery-updated",
      refreshDiscoveryResults,
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
        "jobpilot:profile-updated",
        refreshProfile,
      )

      window.removeEventListener(
        "jobpilot:discovery-updated",
        refreshDiscoveryResults,
      )
    }
  }, [])

  const dashboardData =
    useMemo(
      () => {
        const applications =
          jobs.filter(
            (job) =>
              job.status !==
                "Saved" &&
              job.status !==
                "Rejected",
          ).length

        const interviews =
          jobs.filter(
            (job) =>
              job.status ===
              "Interview",
          ).length

        const offers =
          jobs.filter(
            (job) =>
              job.status ===
              "Offer",
          ).length

        const awaitingResponse =
          jobs.filter(
            (job) =>
              job.status ===
              "Applied",
          ).length

        const priorityJobs =
          jobs
            .filter(
              jobNeedsAttention,
            )
            .sort(
              sortPriorityJobs,
            )
            .slice(
              0,
              4,
            )

        const recentJobs =
          [...jobs]
            .sort(
              (
                first,
                second,
              ) =>
                getSafeTime(
                  second.updatedAt ||
                    second.createdAt,
                ) -
                getSafeTime(
                  first.updatedAt ||
                    first.createdAt,
                ),
            )
            .slice(
              0,
              5,
            )

        return {
          applications,
          interviews,
          offers,
          awaitingResponse,
          priorityJobs,
          recentJobs,
        }
      },
      [jobs],
    )

  const highMatchJobs =
    useMemo(
      () =>
        [...discoveryResults]
          .filter(
            (job) =>
              Number(
                job
                  ?.matchAnalysis
                  ?.score ||
                  job?.matchScore ||
                  0,
              ) >= 90,
          )
          .sort(
            (
              first,
              second,
            ) =>
              getSafeTime(
                second.discoveredAt ||
                  second.postedAt,
              ) -
              getSafeTime(
                first.discoveredAt ||
                  first.postedAt,
              ),
          )
          .slice(
            0,
            3,
          ),
      [discoveryResults],
    )

  const displayName =
    getDisplayName(
      profile,
    )

  const stats = [
    {
      title:
        "Active applications",
      value:
        dashboardData
          .applications,
      description:
        "Applications still in progress",
      icon:
        Briefcase,
    },
    {
      title:
        "Interviews",
      value:
        dashboardData
          .interviews,
      description:
        "Currently at interview stage",
      icon:
        Users,
    },
    {
      title:
        "Awaiting response",
      value:
        dashboardData
          .awaitingResponse,
      description:
        "Submitted applications waiting",
      icon:
        Clock3,
    },
    {
      title:
        "Offers",
      value:
        dashboardData
          .offers,
      description:
        "Successful opportunities",
      icon:
        Trophy,
    },
  ]

  return (
    <div className="min-w-0 pb-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Job-search command centre
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome back
            {displayName
              ? `, ${displayName}`
              : ""}
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-400">
            Review what needs attention, track your pipeline and continue from your latest opportunity.
          </p>
        </div>

        <Link
          to="/jobs"
          className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Plus
            size={17}
          />
          Open Jobs
        </Link>
      </header>

      {highMatchJobs.length > 0 && (
        <HighMatchNotification
          jobs={
            highMatchJobs
          }
        />
      )}

      <section className="jp-grid-compact mt-8 gap-4">
        {stats.map(
          (stat) => {
            const Icon =
              stat.icon

            return (
              <article
                key={
                  stat.title
                }
                className="rounded-xl border border-zinc-800 bg-[#151515] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-400">
                      {
                        stat.title
                      }
                    </p>

                    <p className="mt-2 text-3xl font-bold tracking-tight">
                      {
                        stat.value
                      }
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/80 text-zinc-300">
                    <Icon
                      size={18}
                    />
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-zinc-600">
                  {
                    stat.description
                  }
                </p>
              </article>
            )
          },
        )}
      </section>

      {jobs.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          <div className="jp-grid-panels jp-grid-equal mt-6 gap-6">
            <PriorityPanel
              jobs={
                dashboardData
                  .priorityJobs
              }
            />

            <PipelinePanel
              jobs={jobs}
            />
          </div>

          <RecentJobsPanel
            jobs={
              dashboardData
                .recentJobs
            }
          />
        </>
      )}
    </div>
  )
}

function HighMatchNotification({
  jobs,
}) {
  function selectDiscoverJobs() {
    try {
      localStorage.setItem(
        jobsViewStorageKey,
        "discover",
      )
    } catch {
      /*
       * Jobs still opens normally when
       * local storage is unavailable.
       */
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/[0.06]">
      <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <Sparkles
              size={20}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-violet-100">
                Recent high matches
              </h2>

              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                {jobs.length} found
              </span>
            </div>

            <p className="mt-1 text-sm leading-6 text-violet-100/55">
              Automatic discovery found new vacancies matching 90% or more of your Candidate Profile.
            </p>
          </div>
        </div>

        <Link
          to="/jobs"
          onClick={
            selectDiscoverJobs
          }
          className="jp-button-matching inline-flex w-fit shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
        >
          Review matches
          <ArrowRight
            size={15}
          />
        </Link>
      </div>

      <div className="grid border-t border-violet-500/15 md:grid-cols-3 md:divide-x md:divide-violet-500/15">
        {jobs.map(
          (job) => {
            const score =
              Math.round(
                Number(
                  job
                    ?.matchAnalysis
                    ?.score ||
                    job?.matchScore ||
                    0,
                ),
              )

            return (
              <Link
                key={
                  job.discoveryId ||
                  job.id ||
                  `${job.title}-${job.company}`
                }
                to="/jobs"
                onClick={
                  selectDiscoverJobs
                }
                className="group flex min-w-0 items-center justify-between gap-4 border-b border-violet-500/15 px-5 py-4 transition last:border-b-0 hover:bg-violet-500/[0.07] md:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {job.title ||
                      job.role ||
                      "Untitled job"}
                  </p>

                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {job.company ||
                      "Company not listed"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300">
                    {score}%
                  </span>

                  <ArrowRight
                    size={14}
                    className="text-violet-500/40 transition group-hover:translate-x-0.5 group-hover:text-violet-300"
                  />
                </div>
              </Link>
            )
          },
        )}
      </div>
    </section>
  )
}

function EmptyDashboard() {
  return (
    <section className="mt-6 flex min-h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-[#131313] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
        <Target
          size={24}
        />
      </div>

      <h2 className="mt-5 text-xl font-semibold">
        Start your job-search workspace
      </h2>

      <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">
        Discover vacancies or add an opportunity manually. Your applications, interviews and next actions will then appear here automatically.
      </p>

      <Link
        to="/jobs"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        <Plus
          size={17}
        />
        Find or add a job
      </Link>
    </section>
  )
}

function PriorityPanel({
  jobs,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock
              size={18}
              className="text-violet-300"
            />

            <h2 className="font-semibold">
              Next up
            </h2>
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            The most useful jobs to continue working on.
          </p>
        </div>

        <Link
          to="/jobs"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          View My Jobs
          <ArrowRight
            size={15}
          />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
            <CheckCircle2
              size={20}
            />
          </div>

          <p className="mt-4 text-sm font-medium text-zinc-300">
            Nothing urgent
          </p>

          <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-600">
            Jobs with an active next step will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {jobs.map(
            (job) => {
              const action =
                getNextAction(
                  job,
                )

              const actionDate =
                getActionDate(
                  job,
                )

              const overdue =
                isActionOverdue(
                  job,
                )

              return (
                <Link
                  key={
                    job.id
                  }
                  to={`/jobs/${job.id}`}
                  className="group flex flex-col justify-between gap-4 px-5 py-4 transition hover:bg-zinc-800/35 sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {
                          job.role ||
                          "Untitled job"
                        }
                      </p>

                      <StatusBadge
                        status={
                          job.status
                        }
                      />
                    </div>

                    <p className="mt-2 flex min-w-0 items-center gap-2 text-xs text-zinc-500">
                      <Building2
                        size={13}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        {
                          job.company ||
                          "Company not set"
                        }
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-zinc-300">
                        {
                          action
                        }
                      </p>

                      <p
                        className={[
                          "mt-1 text-xs",

                          overdue
                            ? "text-red-300"
                            : "text-zinc-600",
                        ].join(
                          " ",
                        )}
                      >
                        {actionDate
                          ? `${overdue ? "Overdue" : "Due"} ${formatDate(actionDate)}`
                          : "No due date"}
                      </p>
                    </div>

                    <ArrowRight
                      size={16}
                      className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-300"
                    />
                  </div>
                </Link>
              )
            },
          )}
        </div>
      )}
    </section>
  )
}

function PipelinePanel({
  jobs,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <div className="border-b border-zinc-800 px-5 py-5 sm:px-6">
        <h2 className="font-semibold">
          Application pipeline
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          A simple view of every tracked opportunity.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {pipelineStatuses.map(
          (status) => {
            const total =
              jobs.filter(
                (job) =>
                  job.status ===
                  status,
              ).length

            const percentage =
              jobs.length === 0
                ? 0
                : Math.round(
                    (
                      total /
                      jobs.length
                    ) *
                      100,
                  )

            return (
              <div
                key={
                  status
                }
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-300">
                    {
                      status
                    }
                  </span>

                  <span className="text-sm font-semibold text-zinc-200">
                    {
                      total
                    }
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={
                      getPipelineColour(
                        status,
                      )
                    }
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            )
          },
        )}

        <div className="flex items-center justify-between gap-4 border-t border-zinc-800 pt-5">
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {jobs.length} tracked
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Across every pipeline stage
            </p>
          </div>

          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
          >
            View analytics
            <ArrowRight
              size={15}
            />
          </Link>
        </div>
      </div>
    </section>
  )
}

function RecentJobsPanel({
  jobs,
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2 className="font-semibold">
            Recent jobs
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Opportunities you have worked on most recently.
          </p>
        </div>

        <Link
          to="/jobs"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          View all jobs
          <ArrowRight
            size={15}
          />
        </Link>
      </div>

      <div className="divide-y divide-zinc-800">
        {jobs.map(
          (job) => (
            <Link
              key={
                job.id
              }
              to={`/jobs/${job.id}`}
              className="group grid gap-4 px-5 py-4 transition hover:bg-zinc-800/35 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {
                    job.role ||
                    "Untitled job"
                  }
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2
                      size={13}
                      className="shrink-0"
                    />

                    <span className="truncate">
                      {
                        job.company ||
                        "Company not set"
                      }
                    </span>
                  </span>

                  {job.location && (
                    <span className="flex items-center gap-2">
                      <MapPin
                        size={13}
                      />

                      {
                        job.location
                      }
                    </span>
                  )}
                </div>
              </div>

              <StatusBadge
                status={
                  job.status
                }
              />

              <div className="flex items-center justify-between gap-3 text-xs text-zinc-600 sm:justify-end">
                <span>
                  {formatCompactDateTime(
                    job.updatedAt ||
                      job.createdAt,
                  ) ||
                    "Recently updated"}
                </span>

                <ArrowRight
                  size={15}
                  className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-300"
                />
              </div>
            </Link>
          ),
        )}
      </div>
    </section>
  )
}

function StatusBadge({
  status,
}) {
  return (
    <span
      className={[
        "inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",

        getJobStatusClass(
          status,
        ),
      ].join(
        " ",
      )}
    >
      {status ||
        "Saved"}
    </span>
  )
}

function getPipelineColour(
  status,
) {
  return getPipelineBarClass(
    status,
  )
}

const jobPilotPrefix =
  "jobpilot."

const recentSearchKeys = [
  "jobpilot.discovery-history",
  "jobpilot.discovery-last-event",
  "jobpilot.background-automation-last-event",
]

const assistantDraftKeys = [
  "jobpilot.assistant-draft",
  "jobpilot.latest-analysis",
  "jobpilot.assistant-handoff",
  "jobpilot.application-tailoring",
]

export function collectBreakVeilStorage() {
  const snapshot =
    {}

  for (
    let index =
      0;
    index <
    localStorage.length;
    index +=
      1
  ) {
    const key =
      localStorage.key(
        index,
      )

    if (
      !key ||
      !key.startsWith(
        jobPilotPrefix,
      )
    ) {
      continue
    }

    snapshot[key] =
      localStorage.getItem(
        key,
      ) ??
      ""
  }

  return snapshot
}

export function applyBreakVeilStorage(
  snapshot,
) {
  const keysToRemove =
    []

  for (
    let index =
      0;
    index <
    localStorage.length;
    index +=
      1
  ) {
    const key =
      localStorage.key(
        index,
      )

    if (
      key?.startsWith(
        jobPilotPrefix,
      )
    ) {
      keysToRemove.push(
        key,
      )
    }
  }

  for (
    const key
    of keysToRemove
  ) {
    localStorage.removeItem(
      key,
    )
  }

  if (
    !snapshot ||
    typeof snapshot !==
      "object" ||
    Array.isArray(
      snapshot,
    )
  ) {
    return
  }

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      snapshot,
    )
  ) {
    if (
      !key.startsWith(
        jobPilotPrefix,
      )
    ) {
      continue
    }

    localStorage.setItem(
      key,
      String(
        value ??
          "",
      ),
    )
  }
}

export function clearAllBreakVeilStorage() {
  applyBreakVeilStorage(
    {},
  )
}

export function clearRecentSearches() {
  for (
    const key
    of recentSearchKeys
  ) {
    localStorage.removeItem(
      key,
    )
  }

  window.dispatchEvent(
    new Event(
      "jobpilot:discovery-updated",
    ),
  )
}

export function clearAssistantDrafts() {
  for (
    const key
    of assistantDraftKeys
  ) {
    localStorage.removeItem(
      key,
    )
  }

  window.dispatchEvent(
    new Event(
      "jobpilot:assistant-cleared",
    ),
  )
}

export function clearJobActivityHistory() {
  const storageKey =
    "jobpilot.jobs"

  let jobs =
    []

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          storageKey,
        ) ||
          "[]",
      )

    jobs =
      Array.isArray(
        parsed,
      )
        ? parsed
        : []
  } catch {
    // Keep the safe empty fallback when stored job data is damaged.
  }

  const updatedJobs =
    jobs.map(
      (job) => {
        if (
          !job ||
          typeof job !==
            "object"
        ) {
          return job
        }

        const remainingJob = {
          ...job,
        }

        delete remainingJob
          .activityHistory

        return remainingJob
      },
    )

  localStorage.setItem(
    storageKey,
    JSON.stringify(
      updatedJobs,
    ),
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:jobs-updated",
    ),
  )

  return updatedJobs.length
}

export function buildServiceSummary({
  gmailStatus,
  sourceStatus,
} = {}) {
  return {
    gmail: {
      configured:
        Boolean(
          gmailStatus?.configured,
        ),

      connected:
        Boolean(
          gmailStatus?.connected,
        ),

      email:
        String(
          gmailStatus?.email ||
            "",
        ),

      permission:
        "gmail.compose",
    },

    reed: {
      configured:
        Boolean(
          sourceStatus
            ?.sources
            ?.reed
            ?.configured,
        ),

      permission:
        "Official vacancy search and job details",
    },

    adzuna: {
      configured:
        Boolean(
          sourceStatus
            ?.sources
            ?.adzuna
            ?.configured,
        ),

      permission:
        "Official vacancy search",
    },

    jooble: {
      configured:
        Boolean(
          sourceStatus
            ?.sources
            ?.jooble
            ?.configured,
        ),

      permission:
        "Official REST vacancy search",
    },

    arbeitnow: {
      configured:
        Boolean(
          sourceStatus
            ?.sources
            ?.arbeitnow
            ?.configured,
        ),

      connectionMode:
        "public",

      permission:
        "Public European vacancy search with full descriptions",
    },
    jobicy: {
      configured:
        Boolean(
          sourceStatus
            ?.sources
            ?.jobicy
            ?.configured,
        ),

      connectionMode:
        "public",

      permission:
        "Public remote vacancy search with full descriptions",
    },

    remotive: {
      configured:
        Boolean(
          sourceStatus
            ?.sources
            ?.remotive
            ?.configured,
        ),

      connectionMode:
        "public",

      permission:
        "Public remote vacancy search with required attribution",
    },
  }
}

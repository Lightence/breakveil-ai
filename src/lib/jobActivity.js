const maximumStoredEvents = 150

function clean(value) {
  return String(value || "").trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function createId() {
  if (
    globalThis.crypto
      ?.randomUUID
  ) {
    return globalThis.crypto.randomUUID()
  }

  return [
    "activity",
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join("-")
}

function normaliseEvent(
  event,
) {
  if (
    !event ||
    typeof event !== "object"
  ) {
    return null
  }

  const createdAt =
    clean(event.createdAt) ||
    new Date().toISOString()

  return {
    id:
      clean(event.id) ||
      createId(),

    type:
      clean(event.type) ||
      "updated",

    title:
      clean(event.title) ||
      "Job updated",

    description:
      clean(event.description),

    actor:
      clean(event.actor) ||
      "user",

    createdAt,

    dedupeKey:
      clean(event.dedupeKey),

    metadata:
      event.metadata &&
      typeof event.metadata ===
        "object" &&
      !Array.isArray(
        event.metadata,
      )
        ? event.metadata
        : {},
  }
}

export function createJobActivity({
  type = "updated",
  title = "Job updated",
  description = "",
  actor = "user",
  createdAt = "",
  dedupeKey = "",
  metadata = {},
} = {}) {
  return normaliseEvent({
    id:
      createId(),

    type,
    title,
    description,
    actor,

    createdAt:
      createdAt ||
      new Date()
        .toISOString(),

    dedupeKey,
    metadata,
  })
}

export function appendJobActivity(
  job,
  event,
) {
  const normalised =
    normaliseEvent(
      event,
    )

  if (!normalised) {
    return job
  }

  const currentHistory =
    safeArray(
      job?.activityHistory,
    )
      .map(
        normaliseEvent,
      )
      .filter(Boolean)

  const duplicate =
    currentHistory.some(
      (item) =>
        item.id ===
          normalised.id ||
        (
          normalised
            .dedupeKey &&
          item.dedupeKey ===
            normalised
              .dedupeKey
        ),
    )

  if (duplicate) {
    return job
  }

  return {
    ...job,

    activityHistory: [
      normalised,
      ...currentHistory,
    ].slice(
      0,
      maximumStoredEvents,
    ),
  }
}

export function appendJobActivityToJobs(
  jobs,
  jobId,
  event,
) {
  return safeArray(
    jobs,
  ).map(
    (job) =>
      String(job.id) ===
      String(jobId)
        ? appendJobActivity(
            job,
            event,
          )
        : job,
  )
}

function inferredEvent({
  id,
  type,
  title,
  description = "",
  actor = "system",
  createdAt,
  dedupeKey,
  metadata = {},
}) {
  return normaliseEvent({
    id,
    type,
    title,
    description,
    actor,
    createdAt,
    dedupeKey,
    metadata,
  })
}

function getApplicationStatusTitle(
  status,
) {
  const titles = {
    Draft:
      "Application draft saved",

    "Ready for Review":
      "Application ready for review",

    Approved:
      "Application approved",

    Sent:
      "Application sent",
  }

  return (
    titles[status] ||
    `Application status: ${status}`
  )
}

function getJobStatusTitle(
  status,
) {
  if (
    status === "Offer"
  ) {
    return "Offer recorded"
  }

  if (
    status === "Rejected"
  ) {
    return "Application outcome recorded"
  }

  return `Status changed to ${status}`
}

function hasMatchingMetadata(
  events,
  key,
  value,
) {
  return events.some(
    (event) =>
      String(
        event.metadata
          ?.[key] || "",
      ) ===
      String(value || ""),
  )
}

function dateValue(
  value,
  fallback,
) {
  const candidate =
    clean(value) ||
    clean(fallback)

  if (!candidate) {
    return new Date()
      .toISOString()
  }

  const date =
    new Date(candidate)

  return Number.isNaN(
    date.getTime(),
  )
    ? new Date()
        .toISOString()
    : date.toISOString()
}

function pushUnique(
  collection,
  event,
) {
  const normalised =
    normaliseEvent(
      event,
    )

  if (!normalised) {
    return
  }

  const key =
    normalised.dedupeKey ||
    normalised.id

  if (
    collection.keys.has(
      key,
    )
  ) {
    return
  }

  collection.keys.add(
    key,
  )

  collection.events.push(
    normalised,
  )
}

export function buildJobActivityTimeline(
  job,
  applicationPackage = null,
) {
  if (!job) {
    return []
  }

  const storedEvents =
    safeArray(
      job.activityHistory,
    )
      .map(
        normaliseEvent,
      )
      .filter(Boolean)

  const collection = {
    keys:
      new Set(),

    events:
      [],
  }

  for (
    const event
    of storedEvents
  ) {
    pushUnique(
      collection,
      event,
    )
  }

  const trackedAt =
    dateValue(
      job.createdAt,
      job.updatedAt,
    )

  pushUnique(
    collection,
    inferredEvent({
      id:
        `inferred-job-created-${job.id}`,

      type:
        "tracked",

      title:
        "Job added to tracker",

      description:
        job.importedFromLiveSearch
          ? "Saved from live job search."
          : "Added to My Jobs.",

      createdAt:
        trackedAt,

      dedupeKey:
        `job-created-${job.id}`,

      metadata: {
        source:
          job.source ||
          "manual",
      },
    }),
  )

  if (
    job.status &&
    job.status !==
      "Saved" &&
    !hasMatchingMetadata(
      storedEvents,
      "status",
      job.status,
    )
  ) {
    pushUnique(
      collection,
      inferredEvent({
        id:
          `inferred-current-status-${job.id}-${job.status}`,

        type:
          [
            "Offer",
            "Rejected",
          ].includes(
            job.status,
          )
            ? "outcome"
            : "status",

        title:
          getJobStatusTitle(
            job.status,
          ),

        description:
          "This status existed before detailed activity recording was enabled.",

        createdAt:
          dateValue(
            job.updatedAt,
            job.dateApplied,
          ),

        dedupeKey:
          `current-status-${job.id}-${job.status}`,

        metadata: {
          status:
            job.status,

          inferred:
            true,
        },
      }),
    )
  }

  const hasInterview =
    Boolean(
      job.interviewDate ||
      job.interviewTime ||
      job.interviewLocation ||
      job.interviewLink,
    )

  if (
    hasInterview &&
    !hasMatchingMetadata(
      storedEvents,
      "interviewDate",
      job.interviewDate,
    )
  ) {
    const interviewDescription = [
      job.interviewDate,
      job.interviewTime
        ? `at ${job.interviewTime}`
        : "",
      job.interviewFormat,
      job.interviewLocation,
    ]
      .filter(Boolean)
      .join(" · ")

    pushUnique(
      collection,
      inferredEvent({
        id:
          `inferred-interview-${job.id}-${job.interviewDate || "undated"}-${job.interviewTime || ""}`,

        type:
          "interview",

        title:
          "Interview details added",

        description:
          interviewDescription,

        createdAt:
          dateValue(
            job.updatedAt,
            job.interviewDate,
          ),

        dedupeKey:
          `interview-${job.id}-${job.interviewDate || "undated"}-${job.interviewTime || ""}`,

        metadata: {
          interviewDate:
            job.interviewDate ||
            "",

          inferred:
            true,
        },
      }),
    )
  }

  if (
    applicationPackage
  ) {
    const packageId =
      applicationPackage.id ||
      job.id

    if (
      !hasMatchingMetadata(
        storedEvents,
        "applicationCreatedId",
        packageId,
      )
    ) {
      pushUnique(
        collection,
        inferredEvent({
          id:
            `inferred-application-created-${packageId}`,

          type:
            "application",

          title:
            "Application package created",

          description:
            "Application documents and email details were prepared.",

          createdAt:
            dateValue(
              applicationPackage
                .createdAt,
              applicationPackage
                .updatedAt,
            ),

          dedupeKey:
            `application-created-${packageId}`,

          metadata: {
            applicationCreatedId:
              packageId,

            inferred:
              true,
          },
        }),
      )
    }

    const packageStatus =
      clean(
        applicationPackage
          .status,
      )

    if (
      packageStatus &&
      packageStatus !==
        "Draft" &&
      !hasMatchingMetadata(
        storedEvents,
        "applicationStatus",
        packageStatus,
      )
    ) {
      pushUnique(
        collection,
        inferredEvent({
          id:
            `inferred-application-status-${packageId}-${packageStatus}`,

          type:
            packageStatus ===
              "Sent"
              ? "sent"
              : "application",

          title:
            getApplicationStatusTitle(
              packageStatus,
            ),

          description:
            packageStatus ===
              "Sent"
              ? "The application was recorded as sent."
              : "Current application package status.",

          createdAt:
            dateValue(
              packageStatus ===
                "Sent"
                ? applicationPackage
                    .sentAt
                : applicationPackage
                    .updatedAt,
              applicationPackage
                .createdAt,
            ),

          dedupeKey:
            `application-status-${packageId}-${packageStatus}`,

          metadata: {
            applicationStatus:
              packageStatus,

            inferred:
              true,
          },
        }),
      )
    }

    const draftHistory =
      safeArray(
        applicationPackage
          .gmailDraftHistory,
      )

    const fallbackDraft =
      applicationPackage
        .gmailDraftId
        ? [
            {
              draftId:
                applicationPackage
                  .gmailDraftId,

              createdAt:
                applicationPackage
                  .gmailDraftCreatedAt,

              attachmentNames:
                applicationPackage
                  .gmailDraftAttachmentNames,
            },
          ]
        : []

    const drafts =
      draftHistory.length >
      0
        ? draftHistory
        : fallbackDraft

    for (
      const draft
      of drafts
    ) {
      const draftKey =
        clean(
          draft.draftId,
        ) ||
        clean(
          draft.createdAt,
        )

      if (!draftKey) {
        continue
      }

      pushUnique(
        collection,
        inferredEvent({
          id:
            `inferred-gmail-draft-${packageId}-${draftKey}`,

          type:
            "gmail",

          title:
            "Gmail draft created",

          description:
            safeArray(
              draft.attachmentNames,
            ).length > 0
              ? `${safeArray(draft.attachmentNames).length} attachment${safeArray(draft.attachmentNames).length === 1 ? "" : "s"} included.`
              : "Application email saved to Gmail Drafts.",

          createdAt:
            dateValue(
              draft.createdAt,
              applicationPackage
                .updatedAt,
            ),

          dedupeKey:
            `gmail-draft-${packageId}-${draftKey}`,

          metadata: {
            gmailDraftId:
              clean(
                draft.draftId,
              ),

            inferred:
              true,
          },
        }),
      )
    }
  }

  return collection.events
    .sort(
      (first, second) =>
        new Date(
          second.createdAt,
        ).getTime() -
        new Date(
          first.createdAt,
        ).getTime(),
    )
    .slice(
      0,
      maximumStoredEvents,
    )
}
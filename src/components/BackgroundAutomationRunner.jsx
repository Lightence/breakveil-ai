import {
  useEffect,
  useRef,
} from "react"

import {
  isDiscoveryDue,
  loadDiscoverySettings,
  runJobDiscovery,
} from "../lib/jobDiscovery"

import {
  appendJobActivity,
  createJobActivity,
} from "../lib/jobActivity"

const queueStorageKey =
  "jobpilot.application-queue"

const jobsStorageKey =
  "jobpilot.jobs"

function loadStoredArray(
  storageKey,
) {
  try {
    const savedValue =
      localStorage.getItem(
        storageKey,
      )

    return savedValue
      ? JSON.parse(savedValue)
      : []
  } catch {
    return []
  }
}

function saveStoredArray(
  storageKey,
  value,
) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(value),
  )
}

function isAutomationPage() {
  return window.location.hash
    .toLowerCase()
    .includes("/automation")
}

function updateSentApplication(
  applicationPackage,
  result,
) {
  const sentAt =
    result.sentAt ||
    new Date().toISOString()

  const currentQueue =
    loadStoredArray(
      queueStorageKey,
    )

  const updatedQueue =
    currentQueue.map(
      (item) =>
        item.id ===
        applicationPackage.id
          ? {
              ...item,

              status: "Sent",
              sentAt,

              gmailSentAt:
                sentAt,

              gmailSentMessageId:
                result.messageId ||
                "",

              gmailSentThreadId:
                result.threadId ||
                "",

              sendMethod:
                "gmail-api-automatic",

              autoSendEnabled:
                false,

              autoSendCompletedAt:
                sentAt,

              updatedAt:
                sentAt,
            }
          : item,
    )

  saveStoredArray(
    queueStorageKey,
    updatedQueue,
  )

  const currentJobs =
    loadStoredArray(
      jobsStorageKey,
    )

  const applicationDate =
    sentAt.slice(0, 10)

  const automaticSendActivity =
    createJobActivity({
      type:
        "sent",

      title:
        "Application sent automatically",

      description:
        applicationPackage
          .recipientEmail
          ? `Sent to ${applicationPackage.recipientEmail} through the approved Gmail automation.`
          : "Sent through the approved Gmail automation.",

      actor:
        "automation",

      createdAt:
        sentAt,

      dedupeKey:
        `application-auto-sent-${applicationPackage.id}-${sentAt}`,

      metadata: {
        applicationStatus:
          "Sent",

        sendMethod:
          "gmail-api-automatic",

        recipientEmail:
          applicationPackage
            .recipientEmail ||
          "",
      },
    })

  const updatedJobs =
    currentJobs.map(
      (job) =>
        job.id ===
        applicationPackage.jobId
          ? appendJobActivity({
              ...job,

              status: "Applied",

              dateApplied:
                job.dateApplied ||
                applicationDate,

              updatedAt:
                sentAt,
            }, automaticSendActivity)
          : job,
    )

  saveStoredArray(
    jobsStorageKey,
    updatedJobs,
  )

  localStorage.setItem(
    "jobpilot.background-automation-last-event",

    JSON.stringify({
      type: "sent",

      packageId:
        applicationPackage.id,

      jobRole:
        applicationPackage.jobRole,

      company:
        applicationPackage.company,

      recipientEmail:
        applicationPackage.recipientEmail,

      sentAt,
    }),
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:queue-updated",
    ),
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:jobs-updated",
    ),
  )
}

export default function BackgroundAutomationRunner() {
  const cycleInProgress =
    useRef(false)

  const timeoutIdRef =
    useRef(null)

  const discoveryCycleInProgress =
    useRef(false)

  const discoveryTimeoutIdRef =
    useRef(null)

  useEffect(() => {
    async function runCycle() {
      /*
       * The Automation page already has its own visible
       * runner. This global runner takes over everywhere
       * else so the two cannot normally compete.
       */
      if (
        cycleInProgress.current ||
        isAutomationPage()
      ) {
        return
      }

      if (
        !window.jobPilot?.gmail
          ?.getSendControl ||
        !window.jobPilot?.gmail
          ?.autoSendDraft
      ) {
        return
      }

      cycleInProgress.current =
        true

      try {
        const controlResult =
          await window.jobPilot.gmail
            .getSendControl()

        if (
          !controlResult?.ok ||
          !controlResult
            .automationReady
        ) {
          return
        }

        const eligiblePackages =
          loadStoredArray(
            queueStorageKey,
          )
            .filter(
              (applicationPackage) =>
                applicationPackage
                  .status ===
                  "Approved" &&

                Boolean(
                  applicationPackage
                    .gmailDraftId,
                ) &&

                applicationPackage
                  .autoSendEnabled ===
                  true,
            )
            .sort(
              (first, second) => {
                const firstTime =
                  new Date(
                    first
                      .autoSendQueuedAt ||
                      first.updatedAt ||
                      0,
                  ).getTime()

                const secondTime =
                  new Date(
                    second
                      .autoSendQueuedAt ||
                      second.updatedAt ||
                      0,
                  ).getTime()

                return (
                  firstTime -
                  secondTime
                )
              },
            )

        const applicationPackage =
          eligiblePackages[0]

        if (!applicationPackage) {
          return
        }

        const result =
          await window.jobPilot.gmail
            .autoSendDraft({
              automaticApproved: true,

              packageId:
                applicationPackage.id,

              draftId:
                applicationPackage
                  .gmailDraftId,

              recipientEmail:
                applicationPackage
                  .recipientEmail,

              emailSubject:
                applicationPackage
                  .emailSubject,

              jobRole:
                applicationPackage
                  .jobRole,

              company:
                applicationPackage
                  .company,
            })

        if (!result?.ok) {
          if (!result?.skipped) {
            localStorage.setItem(
              "jobpilot.background-automation-last-event",

              JSON.stringify({
                type: "failed",

                packageId:
                  applicationPackage.id,

                jobRole:
                  applicationPackage.jobRole,

                company:
                  applicationPackage.company,

                error:
                  result?.error ||
                  "Automatic sending failed.",

                occurredAt:
                  new Date().toISOString(),
              }),
            )
          }

          return
        }

        updateSentApplication(
          applicationPackage,
          result,
        )
      } catch (error) {
        console.error(
          "Background automation cycle failed:",
          error,
        )
      } finally {
        cycleInProgress.current =
          false
      }
    }

    function scheduleCycle(
      delay = 250,
    ) {
      if (
        timeoutIdRef.current
      ) {
        window.clearTimeout(
          timeoutIdRef.current,
        )
      }

      timeoutIdRef.current =
        window.setTimeout(
          runCycle,
          delay,
        )
    }

    scheduleCycle(1500)

    const intervalId =
      window.setInterval(
        runCycle,
        20 * 1000,
      )

    function handleHashChange() {
      scheduleCycle(500)
    }

    function handleQueueUpdate() {
      scheduleCycle(500)
    }

    window.addEventListener(
      "hashchange",
      handleHashChange,
    )

    window.addEventListener(
      "jobpilot:queue-updated",
      handleQueueUpdate,
    )

    return () => {
      window.clearInterval(
        intervalId,
      )

      if (
        timeoutIdRef.current
      ) {
        window.clearTimeout(
          timeoutIdRef.current,
        )
      }

      window.removeEventListener(
        "hashchange",
        handleHashChange,
      )

      window.removeEventListener(
        "jobpilot:queue-updated",
        handleQueueUpdate,
      )
    }
  }, [])

  useEffect(() => {
    async function runDiscoveryCycle() {
      if (discoveryCycleInProgress.current) {
        return
      }

      const settings =
        loadDiscoverySettings()

      if (!isDiscoveryDue(settings)) {
        return
      }

      discoveryCycleInProgress.current = true

      try {
        await runJobDiscovery({
          forceRefresh: false,
          trigger: "scheduled",
        })
      } catch (error) {
        console.error(
          "Background job discovery failed:",
          error,
        )
      } finally {
        discoveryCycleInProgress.current = false
      }
    }

    function scheduleDiscoveryCycle(
      delay = 500,
    ) {
      if (discoveryTimeoutIdRef.current) {
        window.clearTimeout(
          discoveryTimeoutIdRef.current,
        )
      }

      discoveryTimeoutIdRef.current =
        window.setTimeout(
          runDiscoveryCycle,
          delay,
        )
    }

    scheduleDiscoveryCycle(4000)

    const intervalId =
      window.setInterval(
        runDiscoveryCycle,
        60 * 1000,
      )

    function handleDiscoverySettingsUpdate() {
      scheduleDiscoveryCycle(350)
    }

    function handleFocus() {
      scheduleDiscoveryCycle(800)
    }

    window.addEventListener(
      "jobpilot:discovery-settings-updated",
      handleDiscoverySettingsUpdate,
    )

    window.addEventListener(
      "focus",
      handleFocus,
    )

    return () => {
      window.clearInterval(intervalId)

      if (discoveryTimeoutIdRef.current) {
        window.clearTimeout(
          discoveryTimeoutIdRef.current,
        )
      }

      window.removeEventListener(
        "jobpilot:discovery-settings-updated",
        handleDiscoverySettingsUpdate,
      )

      window.removeEventListener(
        "focus",
        handleFocus,
      )
    }
  }, [])

  return null
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  useLocation,
} from "react-router-dom"


import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileText,
  Gauge,
  History,
  LoaderCircle,
  Mail,
  Pause,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Timer,
  Unplug,
  UserRound,
  X,
  Zap,
} from "lucide-react"

import ConfirmDialog from "../components/ConfirmDialog"
import JobDiscoveryControlCard from "../components/JobDiscoveryControlCard"

import {
  formatPreferenceDateTime,
} from "../lib/uiPreferences"

const queueStorageKey =
  "jobpilot.application-queue"

const jobsStorageKey =
  "jobpilot.jobs"

const emptyGmailStatus = {
  configured: false,
  connected: false,
  email: "",
  needsReconnect: false,
  error: "",
}

const emptySendControl = {
  enabled: false,
  dailyLimit: 3,
  sentToday: 0,
  remaining: 3,
  sendInProgress: false,

  automationEnabled: false,
  workingHoursEnabled: true,
  workingHoursStart: 9,
  workingHoursEnd: 17,
  minimumDelayMinutes: 10,
  sessionLimit: 3,
  pauseOnFailure: true,

  automaticSessionSent: 0,
  automaticSessionRemaining: 3,
  automationReady: false,
  automationReason:
    "Automatic sending is paused.",
  withinWorkingHours: true,
  nextAutomaticSendAt: "",

  logs: [],
}

function loadStoredArray(storageKey) {
  try {
    const savedValue =
      localStorage.getItem(storageKey)

    return savedValue
      ? JSON.parse(savedValue)
      : []
  } catch {
    return []
  }
}

function formatDateTime(
  value,
) {
  return formatPreferenceDateTime(
    value,
  )
}

function formatHour(hour) {
  const safeHour = Number(hour)

  return new Date(
    2000,
    0,
    1,
    safeHour,
    0,
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getDraftCount(
  applicationPackage,
) {
  if (
    Array.isArray(
      applicationPackage.gmailDraftHistory,
    )
  ) {
    return applicationPackage
      .gmailDraftHistory.length
  }

  if (
    applicationPackage.gmailDraftCount
  ) {
    return applicationPackage
      .gmailDraftCount
  }

  return applicationPackage.gmailDraftId
    ? 1
    : 0
}

export default function Automation() {
  const location =
    useLocation()

  const [gmailStatus, setGmailStatus] =
    useState(emptyGmailStatus)

  const [sendControl, setSendControl] =
    useState(emptySendControl)

  const [queue, setQueue] =
    useState(() =>
      loadStoredArray(
        queueStorageKey,
      ),
    )

  const queueRef = useRef(queue)

  const autoCycleInProgress =
    useRef(false)

  const [isLoading, setIsLoading] =
    useState(true)

  const [
    isConnecting,
    setIsConnecting,
  ] = useState(false)

  const [
    isDisconnecting,
    setIsDisconnecting,
  ] = useState(false)

  const [
    isUpdatingControl,
    setIsUpdatingControl,
  ] = useState(false)

  const [
    sendingPackageId,
    setSendingPackageId,
  ] = useState(null)

  const [
    automaticallySendingPackageId,
    setAutomaticallySendingPackageId,
  ] = useState(null)

  const [
    pendingSendPackage,
    setPendingSendPackage,
  ] = useState(null)

  const [
    sendAcknowledged,
    setSendAcknowledged,
  ] = useState(false)

  const [
    showDisconnectConfirmation,
    setShowDisconnectConfirmation,
  ] = useState(false)

  const [message, setMessage] =
    useState("")

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        location.search,
      )

    const requestedSection =
      parameters.get(
        "section",
      )

    if (
      requestedSection !==
        "gmail" &&
      requestedSection !==
        "discovery"
    ) {
      return undefined
    }

    const targetId =
      requestedSection ===
        "gmail"
        ? "gmail-delivery-settings"
        : "automatic-job-discovery"

    const timeoutId =
      window.setTimeout(
        () => {
          document
            .getElementById(
              targetId,
            )
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start",
            })
        },
        120,
      )

    return () =>
      window.clearTimeout(
        timeoutId,
      )
  }, [
    location.search,
  ])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    loadAllData()

    function refreshQueue() {
      const savedQueue =
        loadStoredArray(
          queueStorageKey,
        )

      setQueue(savedQueue)
      queueRef.current =
        savedQueue
    }

    function refreshEverything() {
      refreshQueue()
      loadAllData()
    }

    window.addEventListener(
      "focus",
      refreshEverything,
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
        "jobpilot:queue-updated",
        refreshQueue,
      )
    }
  }, [])

  useEffect(() => {
    if (
      !gmailStatus.connected ||
      !sendControl.enabled ||
      !sendControl.automationEnabled
    ) {
      return undefined
    }

    runAutomaticCycle()

    const intervalId =
      window.setInterval(
        runAutomaticCycle,
        20 * 1000,
      )

    return () => {
      window.clearInterval(
        intervalId,
      )
    }
  }, [
    gmailStatus.connected,
    sendControl.enabled,
    sendControl.automationEnabled,
  ])

  const approvedOutbox =
    useMemo(() => {
      return queue
        .filter(
          (applicationPackage) =>
            applicationPackage.status ===
              "Approved" &&
            applicationPackage.gmailDraftId,
        )
        .sort(
          (first, second) => {
            if (
              first.autoSendEnabled &&
              !second.autoSendEnabled
            ) {
              return -1
            }

            if (
              !first.autoSendEnabled &&
              second.autoSendEnabled
            ) {
              return 1
            }

            const firstDate =
              new Date(
                first.autoSendQueuedAt ||
                  first.gmailDraftCreatedAt ||
                  first.updatedAt ||
                  0,
              ).getTime()

            const secondDate =
              new Date(
                second.autoSendQueuedAt ||
                  second.gmailDraftCreatedAt ||
                  second.updatedAt ||
                  0,
              ).getTime()

            return firstDate - secondDate
          },
        )
    }, [queue])

  const automaticQueueCount =
    useMemo(() => {
      return approvedOutbox.filter(
        (applicationPackage) =>
          applicationPackage
            .autoSendEnabled,
      ).length
    }, [approvedOutbox])

  const [showApproved, setShowApproved] =
    useState(() => approvedOutbox.length > 0)

  const [showActivity, setShowActivity] =
    useState(false)

  async function loadAllData() {
    setIsLoading(true)

    try {
      await Promise.all([
        loadGmailStatus(),
        loadSendControl(),
      ])
    } finally {
      setIsLoading(false)
    }
  }

  async function loadGmailStatus() {
    try {
      if (!window.jobPilot?.gmail) {
        setGmailStatus({
          ...emptyGmailStatus,

          error:
            "The Gmail service is unavailable. Fully restart BreakVeil.",
        })

        return
      }

      const result =
        await window.jobPilot.gmail
          .getStatus()

      setGmailStatus({
        configured:
          Boolean(
            result?.configured,
          ),

        connected:
          Boolean(
            result?.connected,
          ),

        email:
          result?.email || "",

        needsReconnect:
          Boolean(
            result?.needsReconnect,
          ),

        error:
          result?.error || "",
      })
    } catch (error) {
      setGmailStatus({
        ...emptyGmailStatus,

        error:
          error?.message ||
          "BreakVeil could not check Gmail.",
      })
    }
  }

  async function loadSendControl() {
    try {
      if (
        !window.jobPilot?.gmail
          ?.getSendControl
      ) {
        setSendControl(
          emptySendControl,
        )

        return null
      }

      const result =
        await window.jobPilot.gmail
          .getSendControl()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "BreakVeil could not load sending controls.",
        )

        return null
      }

      updateControlState(result)

      return result
    } catch (error) {
      setMessage(
        error?.message ||
        "BreakVeil could not load sending controls.",
      )

      return null
    }
  }

  function updateControlState(result) {
    setSendControl({
      enabled:
        Boolean(result?.enabled),

      dailyLimit:
        Number(
          result?.dailyLimit ?? 3,
        ),

      sentToday:
        Number(
          result?.sentToday ?? 0,
        ),

      remaining:
        Number(
          result?.remaining ?? 0,
        ),

      sendInProgress:
        Boolean(
          result?.sendInProgress,
        ),

      automationEnabled:
        Boolean(
          result?.automationEnabled,
        ),

      workingHoursEnabled:
        result?.workingHoursEnabled !==
        false,

      workingHoursStart:
        Number(
          result?.workingHoursStart ??
            9,
        ),

      workingHoursEnd:
        Number(
          result?.workingHoursEnd ??
            17,
        ),

      minimumDelayMinutes:
        Number(
          result?.minimumDelayMinutes ??
            10,
        ),

      sessionLimit:
        Number(
          result?.sessionLimit ?? 3,
        ),

      pauseOnFailure:
        result?.pauseOnFailure !==
        false,

      automaticSessionSent:
        Number(
          result?.automaticSessionSent ??
            0,
        ),

      automaticSessionRemaining:
        Number(
          result
            ?.automaticSessionRemaining ??
            0,
        ),

      automationReady:
        Boolean(
          result?.automationReady,
        ),

      automationReason:
        result?.automationReason ||
        "Automatic sending is paused.",

      withinWorkingHours:
        result?.withinWorkingHours !==
        false,

      nextAutomaticSendAt:
        result?.nextAutomaticSendAt ||
        "",

      logs:
        Array.isArray(result?.logs)
          ? result.logs
          : [],
    })
  }

  function saveQueue(updatedQueue) {
    localStorage.setItem(
      queueStorageKey,
      JSON.stringify(
        updatedQueue,
      ),
    )

    setQueue(updatedQueue)
    queueRef.current =
      updatedQueue

    window.dispatchEvent(
      new Event(
        "jobpilot:queue-updated",
      ),
    )
  }

  function updateSentApplication(
    applicationPackage,
    result,
    sendMethod,
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

                sendMethod,

                autoSendEnabled:
                  false,

                autoSendCompletedAt:
                  sendMethod ===
                  "gmail-api-automatic"
                    ? sentAt
                    : item
                        .autoSendCompletedAt ||
                      "",

                updatedAt:
                  sentAt,
              }
            : item,
      )

    saveQueue(updatedQueue)

    const currentJobs =
      loadStoredArray(
        jobsStorageKey,
      )

    const applicationDate =
      sentAt.slice(0, 10)

    const updatedJobs =
      currentJobs.map(
        (job) =>
          job.id ===
          applicationPackage.jobId
            ? {
                ...job,

                status:
                  "Applied",

                dateApplied:
                  job.dateApplied ||
                  applicationDate,

                updatedAt:
                  sentAt,
              }
            : job,
      )

    localStorage.setItem(
      jobsStorageKey,
      JSON.stringify(
        updatedJobs,
      ),
    )

    window.dispatchEvent(
      new Event(
        "jobpilot:jobs-updated",
      ),
    )
  }

  async function connectGmail() {
    setIsConnecting(true)

    setMessage(
      "Your browser is opening. Complete the Google authorisation process.",
    )

    try {
      const result =
        await window.jobPilot.gmail
          .connect()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "Gmail could not be connected.",
        )

        await loadGmailStatus()
        return
      }

      setGmailStatus({
        configured: true,
        connected: true,
        email:
          result.email || "",
        needsReconnect: false,
        error: "",
      })

      setMessage(
        `Gmail connected successfully${result.email ? ` as ${result.email}` : ""}.`,
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "Gmail could not be connected.",
      )
    } finally {
      setIsConnecting(false)
    }
  }

  async function openGmailDrafts() {
    try {
      const result =
        await window.jobPilot.gmail
          .openDrafts()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "Gmail could not be opened.",
        )
      }
    } catch (error) {
      setMessage(
        error?.message ||
        "Gmail could not be opened.",
      )
    }
  }

  async function confirmDisconnect() {
    setShowDisconnectConfirmation(
      false,
    )

    setIsDisconnecting(true)

    try {
      const result =
        await window.jobPilot.gmail
          .disconnect()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "Gmail could not be disconnected.",
        )

        return
      }

      setGmailStatus({
        configured: true,
        connected: false,
        email: "",
        needsReconnect: false,
        error: "",
      })

      await updateSendingControl({
        enabled: false,
        automationEnabled: false,
      })

      setMessage(
        "Gmail has been disconnected and sending has been stopped.",
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "Gmail could not be disconnected.",
      )
    } finally {
      setIsDisconnecting(false)
    }
  }

  async function updateSendingControl(
    changes,
    successMessage = "",
  ) {
    setIsUpdatingControl(true)

    try {
      const result =
        await window.jobPilot.gmail
          .updateSendControl(changes)

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The sending controls could not be updated.",
        )

        return false
      }

      updateControlState(result)

      if (successMessage) {
        setMessage(successMessage)
      }

      return true
    } catch (error) {
      setMessage(
        error?.message ||
        "The sending controls could not be updated.",
      )

      return false
    } finally {
      setIsUpdatingControl(false)
    }
  }

  async function enableSending() {
    await updateSendingControl(
      {
        enabled: true,
      },

      "Controlled Gmail sending is enabled.",
    )
  }

  async function emergencyStop() {
    await updateSendingControl(
      {
        enabled: false,
        automationEnabled: false,
      },

      "Emergency stop activated. Manual and automatic sending are blocked.",
    )
  }

  async function enableAutomation() {
    await updateSendingControl(
      {
        automationEnabled: true,
      },

      "Automatic sending is active. Queued applications will be processed while BreakVeil remains open.",
    )
  }

  async function pauseAutomation() {
    await updateSendingControl(
      {
        automationEnabled: false,
      },

      "Automatic sending has been paused.",
    )
  }

  async function resetAutomaticSession() {
    setIsUpdatingControl(true)

    try {
      const result =
        await window.jobPilot.gmail
          .resetAutoSession()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The automatic session could not be reset.",
        )

        return
      }

      updateControlState(result)

      setMessage(
        "The automatic session counter has been reset.",
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "The automatic session could not be reset.",
      )
    } finally {
      setIsUpdatingControl(false)
    }
  }

  function toggleAutomaticQueue(
    applicationPackage,
  ) {
    const enabling =
      !applicationPackage
        .autoSendEnabled

    const updatedQueue =
      queueRef.current.map(
        (item) =>
          item.id ===
          applicationPackage.id
            ? {
                ...item,

                autoSendEnabled:
                  enabling,

                autoSendQueuedAt:
                  enabling
                    ? new Date()
                        .toISOString()
                    : "",

                updatedAt:
                  new Date()
                    .toISOString(),
              }
            : item,
      )

    saveQueue(updatedQueue)

    setMessage(
      enabling
        ? `${applicationPackage.jobRole} at ${applicationPackage.company} has been queued for automatic sending.`
        : `${applicationPackage.jobRole} at ${applicationPackage.company} has been removed from the automatic queue.`,
    )

    if (
      enabling &&
      sendControl.automationEnabled
    ) {
      window.setTimeout(
        runAutomaticCycle,
        500,
      )
    }
  }

  async function runAutomaticCycle() {
    if (
      autoCycleInProgress.current
    ) {
      return
    }

    if (
      !window.jobPilot?.gmail
        ?.autoSendDraft
    ) {
      return
    }

    autoCycleInProgress.current =
      true

    try {
      const controlResult =
        await window.jobPilot.gmail
          .getSendControl()

      if (!controlResult?.ok) {
        return
      }

      updateControlState(
        controlResult,
      )

      if (
        !controlResult
          .automationReady
      ) {
        return
      }

      const eligiblePackages =
        queueRef.current
          .filter(
            (applicationPackage) =>
              applicationPackage
                .status ===
                "Approved" &&
              applicationPackage
                .gmailDraftId &&
              applicationPackage
                .autoSendEnabled,
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

      setAutomaticallySendingPackageId(
        applicationPackage.id,
      )

      setMessage(
        `Automatically sending ${applicationPackage.jobRole} at ${applicationPackage.company}...`,
      )

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

      if (result?.control) {
        updateControlState(
          result.control,
        )
      }

      if (!result?.ok) {
        if (!result?.skipped) {
          setMessage(
            result?.automationPaused
              ? `Automatic sending failed: ${result.error} Automation has been paused.`
              : `Automatic sending failed: ${result?.error || "Unknown error"}`,
          )
        }

        return
      }

      updateSentApplication(
        applicationPackage,
        result,
        "gmail-api-automatic",
      )

      setMessage(
        `Application automatically sent to ${applicationPackage.recipientEmail}. The linked job has been moved to Applied.`,
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "The automatic sending cycle failed.",
      )

      await loadSendControl()
    } finally {
      setAutomaticallySendingPackageId(
        null,
      )

      autoCycleInProgress.current =
        false
    }
  }

  function requestManualSend(
    applicationPackage,
  ) {
    if (!gmailStatus.connected) {
      setMessage(
        "Connect Gmail before sending an application.",
      )

      return
    }

    if (!sendControl.enabled) {
      setMessage(
        "Controlled sending is stopped.",
      )

      return
    }

    if (
      sendControl.remaining <= 0
    ) {
      setMessage(
        "Your daily sending limit has been reached.",
      )

      return
    }

    setPendingSendPackage(
      applicationPackage,
    )

    setSendAcknowledged(false)
  }

  function cancelManualSend() {
    setPendingSendPackage(null)
    setSendAcknowledged(false)
  }

  async function confirmManualSend() {
    if (
      !pendingSendPackage ||
      !sendAcknowledged
    ) {
      return
    }

    const applicationPackage =
      pendingSendPackage

    setSendingPackageId(
      applicationPackage.id,
    )

    setPendingSendPackage(null)
    setSendAcknowledged(false)

    setMessage(
      "Sending the latest Gmail draft...",
    )

    try {
      const result =
        await window.jobPilot.gmail
          .sendDraft({
            confirmed: true,

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

      if (result?.control) {
        updateControlState(
          result.control,
        )
      }

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The Gmail draft could not be sent.",
        )

        return
      }

      updateSentApplication(
        applicationPackage,
        result,
        "gmail-api-manual",
      )

      setMessage(
        `Application Sent successfully to ${applicationPackage.recipientEmail}.`,
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "The Gmail draft could not be sent.",
      )

      await loadSendControl()
    } finally {
      setSendingPackageId(null)
    }
  }

  return (
    <div className="min-w-0 pb-8">
      <header>
        <p className="text-sm font-medium text-zinc-500">
          Application Delivery
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Automation
        </h1>

        <p className="mt-2 max-w-3xl text-zinc-400">
          Control Gmail delivery, scheduled job discovery and the applications allowed to send automatically.
        </p>
      </header>

      <div
        id="gmail-delivery-settings"
        className="mt-8 scroll-mt-24"
      >
        <DeliveryStatusBar
          status={gmailStatus}
          control={sendControl}
          approvedCount={
            approvedOutbox.length
          }
          automaticCount={
            automaticQueueCount
          }
          isLoading={isLoading}
          isConnecting={isConnecting}
          isDisconnecting={isDisconnecting}
          onConnect={connectGmail}
          onOpenDrafts={openGmailDrafts}
          onRefresh={loadAllData}
          onDisconnect={() =>
            setShowDisconnectConfirmation(
              true,
            )
          }
        />
      </div>

      {message && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/45 px-4 py-3 text-sm text-zinc-300">
          <CheckCircle2
            size={16}
            className="mt-0.5 shrink-0 text-zinc-500"
          />

          <span className="leading-6">
            {message}
          </span>
        </div>
      )}

      <div className="jp-grid-panels jp-grid-equal mt-6 gap-6">
        <ManualControlCard
          control={sendControl}
          gmailConnected={
            gmailStatus.connected
          }
          isUpdating={
            isUpdatingControl
          }
          onEnable={enableSending}
          onStop={emergencyStop}
          onChangeLimit={(value) =>
            updateSendingControl(
              {
                dailyLimit:
                  Number(value),
              },

              `Daily sending limit changed to ${value}.`,
            )
          }
        />

        <AutomaticControlCard
          control={sendControl}
          gmailConnected={
            gmailStatus.connected
          }
          queuedCount={
            automaticQueueCount
          }
          isUpdating={
            isUpdatingControl
          }
          onEnable={enableAutomation}
          onPause={pauseAutomation}
          onResetSession={
            resetAutomaticSession
          }
          onUpdate={
            updateSendingControl
          }
        />
      </div>

      <div
        id="automatic-job-discovery"
        className="scroll-mt-24"
      >
        <JobDiscoveryControlCard />
      </div>

      <section className="mt-6 min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
        <button
          type="button"
          onClick={() =>
            setShowApproved((current) => !current)
          }
          aria-expanded={showApproved}
          aria-controls="approved-applications-content"
          className="group flex w-full flex-col justify-between gap-4 px-4 py-5 text-left transition hover:bg-zinc-900/45 sm:px-6 lg:flex-row lg:items-center"
        >
          <div>
            <div className="flex items-center gap-3">
              <Send
                size={20}
                className="text-sky-300"
              />

              <h2 className="text-lg font-semibold">
                Approved Applications
              </h2>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              Review each approved Gmail draft, send it manually or add it to the automatic queue.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
              {approvedOutbox.length} approved
            </span>

            <span className="jp-tone-automation rounded-full border px-3 py-1 text-xs font-medium">
              {automaticQueueCount} automatic
            </span>

            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition group-hover:text-white">
              {showApproved ? (
                <ChevronUp size={15} aria-hidden="true" />
              ) : (
                <ChevronDown size={15} aria-hidden="true" />
              )}
            </span>
          </div>
        </button>

        {showApproved && (
        <div
          id="approved-applications-content"
          role="region"
          aria-label="Approved applications"
          className="border-t border-zinc-800 p-4 sm:p-6"
        >
          {approvedOutbox.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 text-center">
              <Mail
                size={25}
                className="text-zinc-600"
              />

              <p className="mt-4 font-medium">
                No Approved Applications
              </p>

              <p className="mt-2 max-w-md text-sm text-zinc-500">
                Prepare an application inside a Job Workspace, approve it and create its Gmail draft.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedOutbox.map(
                (applicationPackage) => {
                  const isSending =
                    sendingPackageId ===
                      applicationPackage.id ||
                    automaticallySendingPackageId ===
                      applicationPackage.id

                  return (
                    <article
                      key={
                        applicationPackage.id
                      }
                      className={[
                        "rounded-xl border p-5",

                        applicationPackage
                          .autoSendEnabled
                          ? "jp-automation-panel"
                          : "border-zinc-800 bg-zinc-900/40",
                      ].join(" ")}
                    >
                      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-semibold">
                              {
                                applicationPackage.jobRole
                              }
                            </h3>

                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                              Approved
                            </span>

                            {applicationPackage.autoSendEnabled && (
                              <span className="jp-tone-automation rounded-full border px-2.5 py-1 text-xs font-medium">
                                Automatic Queue
                              </span>
                            )}

                            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                              {getDraftCount(
                                applicationPackage,
                              )}{" "}
                              draft
                              {getDraftCount(
                                applicationPackage,
                              ) === 1
                                ? ""
                                : "s"}
                            </span>
                          </div>

                          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                            <Briefcase
                              size={14}
                            />

                            {
                              applicationPackage.company
                            }
                          </p>

                          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                            <Mail size={14} />

                            {
                              applicationPackage.recipientEmail
                            }
                          </p>

                          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                            <Clock3
                              size={13}
                            />

                            Latest draft{" "}
                            {formatDateTime(
                              applicationPackage.gmailDraftCreatedAt,
                            )}
                          </p>
                        </div>

                        <div className="grid w-full gap-2 sm:flex sm:flex-wrap xl:w-auto xl:justify-end">
                          <button
                            type="button"
                            disabled={isSending}
                            onClick={() =>
                              toggleAutomaticQueue(
                                applicationPackage,
                              )
                            }
                            className={[
                              "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto",

                              applicationPackage
                                .autoSendEnabled
                                ? "jp-tone-automation hover:brightness-110"
                                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
                            ].join(" ")}
                          >
                            {applicationPackage.autoSendEnabled ? (
                              <Pause size={16} />
                            ) : (
                              <Zap size={16} />
                            )}

                            {applicationPackage.autoSendEnabled
                              ? "Remove from Queue"
                              : "Add to Automatic Queue"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              isSending ||
                              !gmailStatus.connected ||
                              !sendControl.enabled ||
                              sendControl.remaining <=
                                0
                            }
                            onClick={() =>
                              requestManualSend(
                                applicationPackage,
                              )
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
                          >
                            {isSending ? (
                              <LoaderCircle
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Send size={16} />
                            )}

                            {isSending
                              ? "Processing"
                              : "Review and Send"}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                },
              )}
            </div>
          )}
        </div>
        )}
      </section>

      <section className="mt-6 min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-4 py-5 sm:px-6">
          <button
            type="button"
            onClick={() =>
              setShowActivity((current) => !current)
            }
            aria-expanded={showActivity}
            aria-controls="sending-activity-content"
            className="group flex min-w-0 flex-1 items-start justify-between gap-4 rounded-lg text-left"
          >
          <div>
            <div className="flex items-center gap-3">
              <History
                size={20}
                className="text-zinc-400"
              />

              <h2 className="text-lg font-semibold">
                Sending Activity
              </h2>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              A local record of manual and automatic Gmail delivery attempts.
            </p>
          </div>

          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition group-hover:text-white">
            {showActivity ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </span>
          </button>

          <button
            type="button"
            onClick={loadSendControl}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            title="Refresh activity"
            aria-label="Refresh sending activity"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {showActivity && (
        <div
          id="sending-activity-content"
          role="region"
          aria-label="Sending activity"
          className="border-t border-zinc-800 p-6"
        >
          {sendControl.logs.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <History
                size={23}
                className="text-zinc-700"
              />

              <p className="mt-3 text-sm text-zinc-500">
                No Gmail Sending Activity Yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sendControl.logs.map(
                (entry) => (
                  <ActivityEntry
                    key={entry.id}
                    entry={entry}
                  />
                ),
              )}
            </div>
          )}
        </div>
        )}
      </section>

      {pendingSendPackage && (
        <SendConfirmationModal
          applicationPackage={
            pendingSendPackage
          }
          gmailAddress={
            gmailStatus.email
          }
          sendControl={
            sendControl
          }
          acknowledged={
            sendAcknowledged
          }
          onAcknowledgedChange={
            setSendAcknowledged
          }
          onConfirm={
            confirmManualSend
          }
          onCancel={
            cancelManualSend
          }
        />
      )}

      <ConfirmDialog
        open={
          showDisconnectConfirmation
        }
        title="Disconnect Gmail?"
        message="BreakVeil will remove its saved authorisation and stop manual and automatic Gmail sending."
        confirmLabel="Disconnect Gmail"
        cancelLabel="Keep connected"
        danger
        onConfirm={
          confirmDisconnect
        }
        onCancel={() =>
          setShowDisconnectConfirmation(
            false,
          )
        }
      />
    </div>
  )
}

function DeliveryStatusBar({
  status,
  control,
  approvedCount,
  automaticCount,
  isLoading,
  isConnecting,
  isDisconnecting,
  onConnect,
  onOpenDrafts,
  onRefresh,
  onDisconnect,
}) {
  const summaries = [
    {
      label:
        "Gmail Account",

      value:
        isLoading
          ? "Checking"
          : status.connected
            ? status.email ||
              "Connected"
            : status.configured
              ? "Disconnected"
              : "Setup Required",

      icon:
        Mail,
    },
    {
      label:
        "Controlled Sending",

      value:
        control.enabled
          ? "Enabled"
          : "Stopped",

      icon:
        ShieldCheck,
    },
    {
      label:
        "Automatic Sending",

      value:
        control.automationEnabled
          ? "Running"
          : "Paused",

      icon:
        Zap,
    },
    {
      label:
        "Delivery Queue",

      value:
        `${approvedCount} Approved • ${automaticCount} Automatic`,

      icon:
        Send,
    },
    {
      label:
        "Daily Allowance",

      value:
        `${control.remaining} Remaining`,

      icon:
        Gauge,
    },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <div className="grid 2xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(175px,1fr))] gap-px bg-zinc-800">
          {summaries.map(
            (summary) => {
              const Icon =
                summary.icon

              return (
                <div
                  key={
                    summary.label
                  }
                  className="flex min-w-0 items-center gap-3 bg-[#151515] px-4 py-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400">
                    {isLoading &&
                    summary.label ===
                      "Gmail Account" ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Icon
                        size={16}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                      {
                        summary.label
                      }
                    </p>

                    <p
                      className="mt-1 truncate text-sm font-semibold text-zinc-200"
                      title={
                        summary.value
                      }
                    >
                      {
                        summary.value
                      }
                    </p>
                  </div>
                </div>
              )
            },
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-4 sm:flex sm:flex-wrap 2xl:grid 2xl:grid-cols-2 2xl:border-l 2xl:border-t-0">
          {status.connected ? (
            <>
              <button
                type="button"
                onClick={
                  onOpenDrafts
                }
                className={`${primaryButtonClass} col-span-2 w-full justify-center sm:w-auto sm:flex-1 2xl:col-span-2`}
              >
                <ExternalLink
                  size={16}
                />
                Open Gmail Drafts
              </button>

              <button
                type="button"
                onClick={
                  onRefresh
                }
                aria-label="Refresh Gmail and sending status"
                title="Refresh Status"
                className={`${secondaryButtonClass} w-full justify-center px-3 sm:w-auto`}
              >
                <RefreshCw
                  size={16}
                />
              </button>

              <button
                type="button"
                disabled={
                  isDisconnecting
                }
                onClick={
                  onDisconnect
                }
                className={`${dangerOutlineButtonClass} w-full justify-center px-3 sm:w-auto`}
              >
                {isDisconnecting ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Unplug
                    size={16}
                  />
                )}

                <span className="2xl:hidden">
                  Disconnect
                </span>
              </button>
            </>
          ) : (
            status.configured && (
              <button
                type="button"
                disabled={
                  isConnecting
                }
                onClick={
                  onConnect
                }
                className={`${primaryButtonClass} col-span-2 w-full justify-center`}
              >
                {isConnecting ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Mail
                    size={16}
                  />
                )}

                {isConnecting
                  ? "Waiting for Google"
                  : "Connect Gmail"}
              </button>
            )
          )}
        </div>
      </div>

      {!status.configured &&
        !isLoading && (
          <div className="border-t border-zinc-800 p-4 sm:p-5">
            <WarningBox
              title="Credentials File Not Found"
              message="Make sure credentials.json is inside electron/google, then restart BreakVeil."
            />
          </div>
        )}

      {status.needsReconnect && (
        <div className="border-t border-zinc-800 p-4 sm:p-5">
          <WarningBox
            title="Gmail Needs Reconnecting"
            message={
              status.error ||
              "The saved authorisation is no longer valid."
            }
          />
        </div>
      )}
    </section>
  )
}

function ManualControlCard({
  control,
  gmailConnected,
  isUpdating,
  onEnable,
  onStop,
  onChangeLimit,
}) {
  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <CardHeader
        icon={ShieldCheck}
        title="Controlled Sending"
        description="The master safety control for every Gmail delivery."
      >
        <SendingBadge
          enabled={
            control.enabled
          }
        />
      </CardHeader>

      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Sent Today"
            value={
              control.sentToday
            }
          />

          <StatCard
            label="Daily Remaining"
            value={
              control.remaining
            }
          />
        </div>

        <label className="mt-5 block">
          <span className={labelClass}>
            Daily Sending Limit
          </span>

          <select
            value={
              control.dailyLimit
            }
            disabled={
              isUpdating
            }
            onChange={(event) =>
              onChangeLimit(
                event.target.value,
              )
            }
            className={selectClass}
          >
            {[1, 3, 5, 10, 15, 20].map(
              (limit) => (
                <option
                  key={
                    limit
                  }
                  value={
                    limit
                  }
                >
                  {limit} per day
                </option>
              ),
            )}
          </select>
        </label>

        <div className="mt-5">
          {control.enabled ? (
            <button
              type="button"
              disabled={
                isUpdating
              }
              onClick={
                onStop
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Power
                size={16}
              />
              Emergency Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={
                !gmailConnected ||
                isUpdating
              }
              onClick={
                onEnable
              }
              className={`${primaryButtonClass} w-full justify-center`}
            >
              <Power
                size={16}
              />
              Enable Sending
            </button>
          )}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-zinc-500"
          />

          <p className="text-xs leading-5 text-zinc-600">
            Manual delivery always opens a final confirmation. Emergency Stop blocks both manual and automatic sending immediately.
          </p>
        </div>
      </div>
    </section>
  )
}

function AutomaticControlCard({
  control,
  gmailConnected,
  queuedCount,
  isUpdating,
  onEnable,
  onPause,
  onResetSession,
  onUpdate,
}) {
  const [
    showAdvancedSettings,
    setShowAdvancedSettings,
  ] = useState(false)

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <CardHeader
        icon={Zap}
        title="Automatic Sending"
        description="Processes only applications you explicitly add to the automatic queue."
      >
        <AutomationBadge
          enabled={
            control.automationEnabled
          }
        />
      </CardHeader>

      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Queued"
            value={
              queuedCount
            }
          />

          <StatCard
            label="Session Sent"
            value={
              control.automaticSessionSent
            }
          />

          <StatCard
            label="Session Remaining"
            value={
              control
                .automaticSessionRemaining
            }
          />
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Current State
            </p>

            {control.nextAutomaticSendAt &&
              !control.automationReady && (
                <span className="text-xs text-zinc-600">
                  Next check{" "}
                  {formatDateTime(
                    control.nextAutomaticSendAt,
                  )}
                </span>
              )}
          </div>

          <p
            className={[
              "mt-2 text-sm leading-6",

              control.automationReady
                ? "text-emerald-300"
                : "text-zinc-400",
            ].join(" ")}
          >
            {
              control.automationReason
            }
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {control.automationEnabled ? (
            <button
              type="button"
              disabled={
                isUpdating
              }
              onClick={
                onPause
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              <Pause
                size={16}
              />
              Pause Automation
            </button>
          ) : (
            <button
              type="button"
              disabled={
                !gmailConnected ||
                !control.enabled ||
                isUpdating
              }
              onClick={
                onEnable
              }
              className={`${primaryButtonClass} flex-1 justify-center`}
            >
              <Play
                size={16}
              />
              Start Automation
            </button>
          )}

          <button
            type="button"
            disabled={
              isUpdating
            }
            onClick={
              onResetSession
            }
            aria-label="Reset automatic session counter"
            title="Reset Session Counter"
            className={secondaryButtonClass}
          >
            <RotateCcw
              size={16}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowAdvancedSettings(
              (current) =>
                !current,
            )
          }
          className="mt-5 flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left transition hover:bg-zinc-900/60"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-300">
              Advanced Settings
            </span>

            <span className="mt-1 block text-xs text-zinc-600">
              Working hours, delay, session limit and failure handling.
            </span>
          </span>

          {showAdvancedSettings ? (
            <ChevronUp
              size={17}
              className="shrink-0 text-zinc-500"
            />
          ) : (
            <ChevronDown
              size={17}
              className="shrink-0 text-zinc-500"
            />
          )}
        </button>

        {showAdvancedSettings && (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/25 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={
                  control.workingHoursEnabled
                }
                disabled={
                  isUpdating
                }
                onChange={(event) =>
                  onUpdate({
                    workingHoursEnabled:
                      event.target.checked,
                  })
                }
                className="mt-1 h-4 w-4"
              />

              <span>
                <span className="block text-sm font-medium text-zinc-300">
                  Restrict Working Hours
                </span>

                <span className="mt-1 block text-xs leading-5 text-zinc-600">
                  Prevent automatic sending outside the selected hours.
                </span>
              </span>
            </label>

            {control.workingHoursEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>
                    Start Time
                  </span>

                  <select
                    value={
                      control.workingHoursStart
                    }
                    disabled={
                      isUpdating
                    }
                    onChange={(event) =>
                      onUpdate({
                        workingHoursStart:
                          Number(
                            event.target.value,
                          ),
                      })
                    }
                    className={selectClass}
                  >
                    {Array.from(
                      {
                        length:
                          24,
                      },
                      (
                        _,
                        hour,
                      ) => (
                        <option
                          key={
                            hour
                          }
                          value={
                            hour
                          }
                        >
                          {
                            formatHour(
                              hour,
                            )
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className={labelClass}>
                    End Time
                  </span>

                  <select
                    value={
                      control.workingHoursEnd
                    }
                    disabled={
                      isUpdating
                    }
                    onChange={(event) =>
                      onUpdate({
                        workingHoursEnd:
                          Number(
                            event.target.value,
                          ),
                      })
                    }
                    className={selectClass}
                  >
                    {Array.from(
                      {
                        length:
                          24,
                      },
                      (
                        _,
                        hour,
                      ) => (
                        <option
                          key={
                            hour
                          }
                          value={
                            hour
                          }
                        >
                          {
                            formatHour(
                              hour,
                            )
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>
                  Minimum Delay
                </span>

                <select
                  value={
                    control.minimumDelayMinutes
                  }
                  disabled={
                    isUpdating
                  }
                  onChange={(event) =>
                    onUpdate({
                      minimumDelayMinutes:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                  className={selectClass}
                >
                  {[1, 2, 5, 10, 15, 30, 60].map(
                    (minutes) => (
                      <option
                        key={
                          minutes
                        }
                        value={
                          minutes
                        }
                      >
                        {minutes} minute
                        {minutes ===
                        1
                          ? ""
                          : "s"}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className={labelClass}>
                  Session Limit
                </span>

                <select
                  value={
                    control.sessionLimit
                  }
                  disabled={
                    isUpdating
                  }
                  onChange={(event) =>
                    onUpdate({
                      sessionLimit:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                  className={selectClass}
                >
                  {[1, 2, 3, 5, 10, 15, 20].map(
                    (limit) => (
                      <option
                        key={
                          limit
                        }
                        value={
                          limit
                        }
                      >
                        {limit} email
                        {limit ===
                        1
                          ? ""
                          : "s"}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={
                  control.pauseOnFailure
                }
                disabled={
                  isUpdating
                }
                onChange={(event) =>
                  onUpdate({
                    pauseOnFailure:
                      event.target.checked,
                  })
                }
                className="mt-1 h-4 w-4"
              />

              <span>
                <span className="block text-sm font-medium text-zinc-300">
                  Pause After a Failure
                </span>

                <span className="mt-1 block text-xs leading-5 text-zinc-600">
                  Recommended when a Gmail draft has been edited, moved or deleted.
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <Timer
            size={16}
            className="mt-0.5 shrink-0 text-zinc-500"
          />

          <p className="text-xs leading-5 text-zinc-600">
            BreakVeil must remain running in the window or system tray while automatic delivery processes the queue.
          </p>
        </div>
      </div>
    </section>
  )
}

function SendConfirmationModal({
  applicationPackage,
  gmailAddress,
  sendControl,
  acknowledged,
  onAcknowledgedChange,
  onConfirm,
  onCancel,
}) {
  const attachmentNames =
    Array.isArray(
      applicationPackage
        .gmailDraftAttachmentNames,
    )
      ? applicationPackage
          .gmailDraftAttachmentNames
      : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex h-[min(92vh,860px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-4 py-5 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold">
              Confirm Gmail send
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              This manual action sends a real email.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <WarningBox
            title="Final sending confirmation"
            message="Gmail will send the current contents of this draft immediately."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailCard
              icon={Mail}
              label="From"
              value={gmailAddress}
            />

            <DetailCard
              icon={UserRound}
              label="To"
              value={
                applicationPackage.recipientEmail
              }
            />

            <DetailCard
              icon={Briefcase}
              label="Application"
              value={`${applicationPackage.jobRole} at ${applicationPackage.company}`}
            />

            <DetailCard
              icon={Gauge}
              label="Daily allowance"
              value={`${sendControl.remaining} remaining`}
            />
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Subject
            </p>

            <p className="mt-2 text-sm text-zinc-300">
              {
                applicationPackage.emailSubject
              }
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Attachments
            </p>

            <div className="mt-3 space-y-2">
              {attachmentNames.map(
                (filename) => (
                  <p
                    key={filename}
                    className="flex items-center gap-2 text-sm text-zinc-400"
                  >
                    <FileText size={14} />
                    {filename}
                  </p>
                ),
              )}
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) =>
                onAcknowledgedChange(
                  event.target.checked,
                )
              }
              className="mt-1 h-4 w-4"
            />

            <span className="text-sm leading-6 text-zinc-300">
              I have reviewed the recipient and understand
              that this sends the Gmail draft immediately.
            </span>
          </label>

          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className={secondaryButtonClass}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!acknowledged}
              onClick={onConfirm}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              <Send size={16} />
              Send Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityEntry({ entry }) {
  const successful =
    entry.status === "success"

  const automatic =
    entry.mode === "automatic"

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",

            successful
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 text-red-300",
          ].join(" ")}
        >
          {successful ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {successful
                ? "Application Sent"
                : "Sending Failed"}
            </p>

            <span
              className={[
                "rounded-full border px-2 py-0.5 text-[11px]",

                automatic
                  ? "jp-tone-automation"
                  : "jp-tone-neutral",
              ].join(" ")}
            >
              {automatic
                ? "Automatic"
                : "Manual"}
            </span>
          </div>

          <p className="mt-1 text-sm text-zinc-400">
            {entry.jobRole || "Application"}
            {entry.company
              ? ` at ${entry.company}`
              : ""}
          </p>

          <p className="mt-1 break-all text-xs text-zinc-600">
            {entry.recipientEmail ||
              "No recipient recorded"}
          </p>

          {!successful &&
            entry.error && (
              <p className="mt-2 text-xs text-red-300">
                {entry.error}
              </p>
            )}

          {entry.automationPaused && (
            <p className="mt-1 text-xs text-amber-300">
              Automation was paused automatically.
            </p>
          )}
        </div>
      </div>

      <p className="shrink-0 text-xs text-zinc-600">
        {formatDateTime(
          entry.timestamp,
        )}
      </p>
    </div>
  )
}

function CardHeader({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
          <Icon size={19} />
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {description}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        {children}
      </div>
    </div>
  )
}

function WarningBox({
  title,
  message,
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
      <AlertTriangle
        size={18}
        className="mt-0.5 shrink-0 text-amber-300"
      />

      <div>
        <p className="text-sm font-medium text-amber-200">
          {title}
        </p>

        <p className="mt-1 text-sm leading-6 text-amber-200/70">
          {message}
        </p>
      </div>
    </div>
  )
}

function DetailCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        <Icon size={13} />
        {label}
      </p>

      <p className="mt-2 break-words text-sm text-zinc-300">
        {value || "Not available"}
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p
        className="mt-1 truncate text-xl font-bold"
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

function SendingBadge({
  enabled,
}) {
  return (
    <span
      className={[
        badgeBaseClass,

        enabled
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-700 bg-zinc-800 text-zinc-400",
      ].join(" ")}
    >
      <Power size={13} />

      {enabled
        ? "Enabled"
        : "Stopped"}
    </span>
  )
}

function AutomationBadge({
  enabled,
}) {
  return (
    <span
      className={[
        badgeBaseClass,

        enabled
          ? "jp-tone-automation"
          : "jp-tone-neutral",
      ].join(" ")}
    >
      {enabled ? (
        <Play size={13} />
      ) : (
        <Pause size={13} />
      )}

      {enabled
        ? "Running"
        : "Paused"}
    </span>
  )
}

const badgeBaseClass =
  "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"

const primaryButtonClass =
  "jp-button-automation flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"

const secondaryButtonClass =
  "flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"

const dangerOutlineButtonClass =
  "flex items-center gap-2 rounded-lg border border-red-500/20 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"

const labelClass =
  "mb-2 block text-xs font-medium text-zinc-400"

const selectClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"

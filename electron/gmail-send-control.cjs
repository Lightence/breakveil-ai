const path = require("path")
const fs = require("fs")

const fileSystem = fs.promises

const DEFAULT_SETTINGS = {
  enabled: false,
  dailyLimit: 3,

  automationEnabled: false,
  workingHoursEnabled: true,
  workingHoursStart: 9,
  workingHoursEnd: 17,
  minimumDelayMinutes: 10,
  sessionLimit: 3,
  pauseOnFailure: true,
}

const MAX_LOG_ENTRIES = 500

let sendInProgress = false
let automaticSessionSent = 0

function registerGmailSendControl({
  app,
  ipcMain,
  getAuthenticatedGmail,
  getErrorMessage,
}) {
  function getStorageFolder() {
    return path.join(
      app.getPath("userData"),
      "gmail-send-control",
    )
  }

  function getSettingsPath() {
    return path.join(
      getStorageFolder(),
      "settings.json",
    )
  }

  function getActivityLogPath() {
    return path.join(
      getStorageFolder(),
      "activity-log.json",
    )
  }

  async function ensureStorage() {
    await fileSystem.mkdir(
      getStorageFolder(),
      {
        recursive: true,
      },
    )
  }

  async function readJsonFile(
    filePath,
    fallbackValue,
  ) {
    await ensureStorage()

    try {
      const fileContents =
        await fileSystem.readFile(
          filePath,
          "utf8",
        )

      return JSON.parse(
        fileContents,
      )
    } catch {
      return fallbackValue
    }
  }

  async function writeJsonFile(
    filePath,
    value,
  ) {
    await ensureStorage()

    await fileSystem.writeFile(
      filePath,
      JSON.stringify(
        value,
        null,
        2,
      ),
      "utf8",
    )
  }

  function normaliseNumber(
    value,
    fallbackValue,
    minimum,
    maximum,
  ) {
    const parsedValue =
      Number.parseInt(
        String(value),
        10,
      )

    if (
      !Number.isFinite(
        parsedValue,
      )
    ) {
      return fallbackValue
    }

    return Math.min(
      maximum,
      Math.max(
        minimum,
        parsedValue,
      ),
    )
  }

  function normaliseDailyLimit(
    value,
  ) {
    return normaliseNumber(
      value,
      DEFAULT_SETTINGS.dailyLimit,
      1,
      20,
    )
  }

  function normaliseHour(
    value,
    fallbackValue,
  ) {
    return normaliseNumber(
      value,
      fallbackValue,
      0,
      23,
    )
  }

  function normaliseDelay(
    value,
  ) {
    return normaliseNumber(
      value,
      DEFAULT_SETTINGS.minimumDelayMinutes,
      1,
      120,
    )
  }

  function normaliseSessionLimit(
    value,
  ) {
    return normaliseNumber(
      value,
      DEFAULT_SETTINGS.sessionLimit,
      1,
      20,
    )
  }

  function normaliseSettings(
    settings = {},
  ) {
    return {
      enabled:
        settings.enabled === true,

      dailyLimit:
        normaliseDailyLimit(
          settings.dailyLimit,
        ),

      automationEnabled:
        settings.automationEnabled ===
        true,

      workingHoursEnabled:
        settings.workingHoursEnabled !==
        false,

      workingHoursStart:
        normaliseHour(
          settings.workingHoursStart,
          DEFAULT_SETTINGS
            .workingHoursStart,
        ),

      workingHoursEnd:
        normaliseHour(
          settings.workingHoursEnd,
          DEFAULT_SETTINGS
            .workingHoursEnd,
        ),

      minimumDelayMinutes:
        normaliseDelay(
          settings.minimumDelayMinutes,
        ),

      sessionLimit:
        normaliseSessionLimit(
          settings.sessionLimit,
        ),

      pauseOnFailure:
        settings.pauseOnFailure !==
        false,
    }
  }

  async function readSettings() {
    const savedSettings =
      await readJsonFile(
        getSettingsPath(),
        DEFAULT_SETTINGS,
      )

    return normaliseSettings({
      ...DEFAULT_SETTINGS,
      ...savedSettings,
    })
  }

  async function writeSettings(
    settings,
  ) {
    const safeSettings =
      normaliseSettings(
        settings,
      )

    await writeJsonFile(
      getSettingsPath(),
      safeSettings,
    )

    return safeSettings
  }

  async function readActivityLog() {
    const savedLog =
      await readJsonFile(
        getActivityLogPath(),
        [],
      )

    return Array.isArray(savedLog)
      ? savedLog
      : []
  }

  async function writeActivityLog(
    entries,
  ) {
    await writeJsonFile(
      getActivityLogPath(),
      entries.slice(
        0,
        MAX_LOG_ENTRIES,
      ),
    )
  }

  async function addActivityEntry(
    entry,
  ) {
    const activityLog =
      await readActivityLog()

    const newEntry = {
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,

      timestamp:
        new Date().toISOString(),

      ...entry,
    }

    const updatedLog = [
      newEntry,
      ...activityLog,
    ].slice(
      0,
      MAX_LOG_ENTRIES,
    )

    await writeActivityLog(
      updatedLog,
    )

    return newEntry
  }

  function getLocalDateKey(
    dateValue = new Date(),
  ) {
    const date =
      dateValue instanceof Date
        ? dateValue
        : new Date(dateValue)

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return ""
    }

    const year =
      date.getFullYear()

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(2, "0")

    const day =
      String(
        date.getDate(),
      ).padStart(2, "0")

    return `${year}-${month}-${day}`
  }

  function getSuccessfulSendsToday(
    activityLog,
  ) {
    const today =
      getLocalDateKey()

    return activityLog.filter(
      (entry) =>
        entry.status ===
          "success" &&
        getLocalDateKey(
          entry.timestamp,
        ) === today,
    ).length
  }

  function isWithinWorkingHours(
    settings,
    date = new Date(),
  ) {
    if (
      !settings.workingHoursEnabled
    ) {
      return true
    }

    const currentHour =
      date.getHours() +
      date.getMinutes() / 60

    const start =
      settings.workingHoursStart

    const end =
      settings.workingHoursEnd

    if (start === end) {
      return true
    }

    if (start < end) {
      return (
        currentHour >= start &&
        currentHour < end
      )
    }

    return (
      currentHour >= start ||
      currentHour < end
    )
  }

  function findLatestAutomaticSuccess(
    activityLog,
  ) {
    return activityLog.find(
      (entry) =>
        entry.status ===
          "success" &&
        entry.mode ===
          "automatic",
    )
  }

  function getDelayState(
    settings,
    activityLog,
  ) {
    const latestAutomaticSend =
      findLatestAutomaticSuccess(
        activityLog,
      )

    if (
      !latestAutomaticSend
        ?.timestamp
    ) {
      return {
        ready: true,
        nextAutomaticSendAt: "",
        remainingMilliseconds: 0,
      }
    }

    const lastSentTime =
      new Date(
        latestAutomaticSend.timestamp,
      ).getTime()

    if (
      Number.isNaN(
        lastSentTime,
      )
    ) {
      return {
        ready: true,
        nextAutomaticSendAt: "",
        remainingMilliseconds: 0,
      }
    }

    const nextAllowedTime =
      lastSentTime +
      settings.minimumDelayMinutes *
        60 *
        1000

    const remainingMilliseconds =
      Math.max(
        0,
        nextAllowedTime -
          Date.now(),
      )

    return {
      ready:
        remainingMilliseconds === 0,

      nextAutomaticSendAt:
        new Date(
          nextAllowedTime,
        ).toISOString(),

      remainingMilliseconds,
    }
  }

  function buildAutomationState(
    settings,
    activityLog,
    sentToday,
  ) {
    const dailyRemaining =
      Math.max(
        0,
        settings.dailyLimit -
          sentToday,
      )

    const sessionRemaining =
      Math.max(
        0,
        settings.sessionLimit -
          automaticSessionSent,
      )

    const withinWorkingHours =
      isWithinWorkingHours(
        settings,
      )

    const delayState =
      getDelayState(
        settings,
        activityLog,
      )

    let ready = true
    let reason =
      "Automation is ready."

    if (!settings.enabled) {
      ready = false
      reason =
        "Controlled sending is stopped."
    } else if (
      !settings.automationEnabled
    ) {
      ready = false
      reason =
        "Automatic sending is paused."
    } else if (
      sendInProgress
    ) {
      ready = false
      reason =
        "Another email is currently being processed."
    } else if (
      dailyRemaining <= 0
    ) {
      ready = false
      reason =
        "The daily sending limit has been reached."
    } else if (
      sessionRemaining <= 0
    ) {
      ready = false
      reason =
        "The automatic session limit has been reached."
    } else if (
      !withinWorkingHours
    ) {
      ready = false
      reason =
        "Outside the configured working hours."
    } else if (
      !delayState.ready
    ) {
      ready = false
      reason =
        "Waiting for the minimum delay between automatic emails."
    }

    return {
      ready,
      reason,
      withinWorkingHours,

      dailyRemaining,
      sessionRemaining,

      nextAutomaticSendAt:
        delayState.nextAutomaticSendAt,

      delayRemainingMilliseconds:
        delayState.remainingMilliseconds,
    }
  }

  async function buildControlStatus() {
    const settings =
      await readSettings()

    const activityLog =
      await readActivityLog()

    const sentToday =
      getSuccessfulSendsToday(
        activityLog,
      )

    const automationState =
      buildAutomationState(
        settings,
        activityLog,
        sentToday,
      )

    return {
      ...settings,

      sentToday,

      remaining:
        automationState
          .dailyRemaining,

      sendInProgress,

      automaticSessionSent,

      automaticSessionRemaining:
        automationState
          .sessionRemaining,

      automationReady:
        automationState.ready,

      automationReason:
        automationState.reason,

      withinWorkingHours:
        automationState
          .withinWorkingHours,

      nextAutomaticSendAt:
        automationState
          .nextAutomaticSendAt,

      delayRemainingMilliseconds:
        automationState
          .delayRemainingMilliseconds,

      logs:
        activityLog.slice(
          0,
          100,
        ),
    }
  }

  async function draftWasAlreadySent(
    draftId,
    activityLog,
  ) {
    return activityLog.some(
      (entry) =>
        entry.status ===
          "success" &&
        entry.draftId ===
          draftId,
    )
  }

  async function executeDraftSend({
    payload,
    mode,
  }) {
    const draftId =
      String(
        payload.draftId || "",
      ).trim()

    const packageId =
      String(
        payload.packageId || "",
      ).trim()

    const recipientEmail =
      String(
        payload.recipientEmail ||
          "",
      ).trim()

    const emailSubject =
      String(
        payload.emailSubject ||
          "",
      ).trim()

    const jobRole =
      String(
        payload.jobRole || "",
      ).trim()

    const company =
      String(
        payload.company || "",
      ).trim()

    if (sendInProgress) {
      return {
        ok: false,
        skipped:
          mode === "automatic",

        error:
          "Another Gmail message is currently being processed.",

        control:
          await buildControlStatus(),
      }
    }

    const settings =
      await readSettings()

    const activityLog =
      await readActivityLog()

    const sentToday =
      getSuccessfulSendsToday(
        activityLog,
      )

    if (!settings.enabled) {
      return {
        ok: false,
        skipped:
          mode === "automatic",

        error:
          "Controlled Gmail sending is stopped.",

        control:
          await buildControlStatus(),
      }
    }

    if (
      sentToday >=
      settings.dailyLimit
    ) {
      return {
        ok: false,
        skipped:
          mode === "automatic",

        error:
          `The daily sending limit of ${settings.dailyLimit} has been reached.`,

        control:
          await buildControlStatus(),
      }
    }

    if (
      mode === "manual" &&
      payload.confirmed !== true
    ) {
      return {
        ok: false,

        error:
          "The application must be confirmed before it can be sent.",

        control:
          await buildControlStatus(),
      }
    }

    if (
      mode === "automatic"
    ) {
      if (
        payload.automaticApproved !==
        true
      ) {
        return {
          ok: false,

          error:
            "This application has not been queued for automatic sending.",

          control:
            await buildControlStatus(),
        }
      }

      const automationState =
        buildAutomationState(
          settings,
          activityLog,
          sentToday,
        )

      if (
        !automationState.ready
      ) {
        return {
          ok: false,
          skipped: true,

          error:
            automationState.reason,

          control:
            await buildControlStatus(),
        }
      }
    }

    if (!draftId) {
      return {
        ok: false,

        error:
          "No Gmail draft is available for this application.",

        control:
          await buildControlStatus(),
      }
    }

    if (!packageId) {
      return {
        ok: false,

        error:
          "The application package could not be identified.",

        control:
          await buildControlStatus(),
      }
    }

    const alreadySent =
      await draftWasAlreadySent(
        draftId,
        activityLog,
      )

    if (alreadySent) {
      return {
        ok: false,

        error:
          "This exact Gmail draft has already been sent.",

        control:
          await buildControlStatus(),
      }
    }

    sendInProgress = true

    try {
      const { gmail } =
        await getAuthenticatedGmail()

      const response =
        await gmail.users.drafts.send({
          userId: "me",

          requestBody: {
            id: draftId,
          },
        })

      const sentAt =
        new Date().toISOString()

      await addActivityEntry({
        status: "success",
        action:
          "gmail-draft-send",
        mode,

        packageId,
        draftId,

        recipientEmail,
        emailSubject,
        jobRole,
        company,

        messageId:
          response.data.id || "",

        threadId:
          response.data.threadId ||
          "",
      })

      if (
        mode === "automatic"
      ) {
        automaticSessionSent += 1
      }

      sendInProgress = false

      return {
        ok: true,
        mode,
        sentAt,

        messageId:
          response.data.id || "",

        threadId:
          response.data.threadId ||
          "",

        control:
          await buildControlStatus(),
      }
    } catch (error) {
      const errorMessage =
        getErrorMessage(error)

      let automationPaused = false

      if (
        mode === "automatic" &&
        settings.pauseOnFailure
      ) {
        await writeSettings({
          ...settings,
          automationEnabled: false,
        })

        automationPaused = true
      }

      await addActivityEntry({
        status: "failed",
        action:
          "gmail-draft-send",
        mode,

        packageId,
        draftId,

        recipientEmail,
        emailSubject,
        jobRole,
        company,

        error: errorMessage,
        automationPaused,
      })

      sendInProgress = false

      return {
        ok: false,
        mode,
        error: errorMessage,
        automationPaused,

        control:
          await buildControlStatus(),
      }
    } finally {
      sendInProgress = false
    }
  }

  ipcMain.handle(
    "gmail:get-send-control",
    async () => {
      try {
        return {
          ok: true,
          ...(await buildControlStatus()),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            getErrorMessage(error),
        }
      }
    },
  )

  ipcMain.handle(
    "gmail:update-send-control",
    async (
      _event,
      changes = {},
    ) => {
      try {
        const currentSettings =
          await readSettings()

        const enablingAutomation =
          changes.automationEnabled ===
            true &&
          !currentSettings
            .automationEnabled

        const updatedSettings = {
          ...currentSettings,
          ...changes,
        }

        if (
          changes.enabled === false
        ) {
          updatedSettings
            .automationEnabled =
            false
        }

        if (
          updatedSettings
            .automationEnabled &&
          !updatedSettings.enabled
        ) {
          updatedSettings
            .automationEnabled =
            false
        }

        if (
          enablingAutomation &&
          updatedSettings.enabled
        ) {
          automaticSessionSent = 0
        }

        await writeSettings(
          updatedSettings,
        )

        return {
          ok: true,
          ...(await buildControlStatus()),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            getErrorMessage(error),
        }
      }
    },
  )

  ipcMain.handle(
    "gmail:reset-auto-session",
    async () => {
      try {
        automaticSessionSent = 0

        return {
          ok: true,
          ...(await buildControlStatus()),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            getErrorMessage(error),
        }
      }
    },
  )

  ipcMain.handle(
    "gmail:send-draft",
    async (
      _event,
      payload = {},
    ) => {
      return executeDraftSend({
        payload,
        mode: "manual",
      })
    },
  )

  ipcMain.handle(
    "gmail:auto-send-draft",
    async (
      _event,
      payload = {},
    ) => {
      return executeDraftSend({
        payload,
        mode: "automatic",
      })
    },
  )
}

module.exports = {
  registerGmailSendControl,
}
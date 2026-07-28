const {
  Menu,
  Notification,
  Tray,
  nativeImage,
} = require("electron")

const path = require("path")
const fs = require("fs")

const fileSystem = fs.promises

const DEFAULT_SEND_SETTINGS = {
  enabled: false,
  dailyLimit: 3,
  automationEnabled: false,
}

const TRAY_REFRESH_INTERVAL =
  10 * 1000

const START_IN_BACKGROUND_ARGUMENT =
  "--background"

function registerBackgroundTray({
  app,
  getWindowSettings = () => ({
    keepRunningOnClose:
      true,
  }),
}) {
  let tray = null
  let mainWindow = null
  let isQuitting = false
  let refreshInterval = null

  let hiddenNotificationShown =
    false

  let discoveryEventInitialised =
    false

  let lastDiscoveryEventId =
    ""

  const startedInBackground =
    process.argv.includes(
      START_IN_BACKGROUND_ARGUMENT,
    )

  /*
  |--------------------------------------------------------------------------
  | Single-instance protection
  |--------------------------------------------------------------------------
  */

  const hasSingleInstanceLock =
    app.requestSingleInstanceLock()

  if (!hasSingleInstanceLock) {
    isQuitting = true
    app.quit()
  }

  app.on(
    "second-instance",
    () => {
      showMainWindow()
    },
  )

  /*
  |--------------------------------------------------------------------------
  | Sending-control storage
  |--------------------------------------------------------------------------
  */

  function getSendControlFolder() {
    return path.join(
      app.getPath("userData"),
      "gmail-send-control",
    )
  }

  function getSendSettingsPath() {
    return path.join(
      getSendControlFolder(),
      "settings.json",
    )
  }

  function getActivityLogPath() {
    return path.join(
      getSendControlFolder(),
      "activity-log.json",
    )
  }

  async function readJsonFile(
    filePath,
    fallbackValue,
  ) {
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
    await fileSystem.mkdir(
      path.dirname(filePath),
      {
        recursive: true,
      },
    )

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

  async function readSendSettings() {
    const settings =
      await readJsonFile(
        getSendSettingsPath(),
        DEFAULT_SEND_SETTINGS,
      )

    return {
      ...DEFAULT_SEND_SETTINGS,
      ...(settings || {}),
    }
  }

  async function updateSendSettings(
    changes,
  ) {
    const currentSettings =
      await readSendSettings()

    const updatedSettings = {
      ...currentSettings,
      ...changes,
    }

    if (
      updatedSettings.enabled !== true
    ) {
      updatedSettings.automationEnabled =
        false
    }

    await writeJsonFile(
      getSendSettingsPath(),
      updatedSettings,
    )

    return updatedSettings
  }

  /*
  |--------------------------------------------------------------------------
  | Windows startup
  |--------------------------------------------------------------------------
  */

  function canManageWindowsStartup() {
    return (
      process.platform === "win32" &&
      app.isPackaged
    )
  }

  function getStartWithWindowsStatus() {
    if (
      !canManageWindowsStartup()
    ) {
      return false
    }

    try {
      const loginSettings =
        app.getLoginItemSettings({
          path: process.execPath,

          args: [
            START_IN_BACKGROUND_ARGUMENT,
          ],
        })

      return (
        loginSettings.openAtLogin ===
        true
      )
    } catch (error) {
      console.error(
        "Could not read Windows startup setting:",
        error,
      )

      return false
    }
  }

  async function setStartWithWindows(
    enabled,
  ) {
    if (
      !canManageWindowsStartup()
    ) {
      showNotification(
        "Install BreakVeil first",
        "Start with Windows becomes available after BreakVeil has been installed.",
      )

      return
    }

    try {
      app.setLoginItemSettings({
        openAtLogin:
          enabled === true,

        path:
          process.execPath,

        args: [
          START_IN_BACKGROUND_ARGUMENT,
        ],
      })

      const actualStatus =
        getStartWithWindowsStatus()

      showNotification(
        actualStatus
          ? "Start with Windows enabled"
          : "Start with Windows disabled",

        actualStatus
          ? "BreakVeil will start quietly in the system tray when you sign in to Windows."
          : "BreakVeil will no longer start automatically with Windows.",
      )

      await refreshTrayMenu()
    } catch (error) {
      console.error(
        "Could not change Windows startup setting:",
        error,
      )

      showNotification(
        "Startup setting failed",
        "BreakVeil could not change the Windows startup setting.",
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Queue and activity summaries
  |--------------------------------------------------------------------------
  */

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

  async function getSendSummary() {
    const settings =
      await readSendSettings()

    const activityLog =
      await readJsonFile(
        getActivityLogPath(),
        [],
      )

    const safeLog =
      Array.isArray(activityLog)
        ? activityLog
        : []

    const today =
      getLocalDateKey()

    const sentToday =
      safeLog.filter(
        (entry) =>
          entry?.status ===
            "success" &&
          getLocalDateKey(
            entry.timestamp,
          ) === today,
      ).length

    return {
      settings,
      sentToday,
    }
  }

  async function getQueueSummary() {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.webContents.isDestroyed()
    ) {
      return {
        approved: 0,
        automatic: 0,
      }
    }

    try {
      return await mainWindow.webContents
        .executeJavaScript(
          `(() => {
            try {
              const queue = JSON.parse(
                localStorage.getItem(
                  "jobpilot.application-queue"
                ) || "[]"
              )

              const safeQueue =
                Array.isArray(queue)
                  ? queue
                  : []

              return {
                approved:
                  safeQueue.filter(
                    (item) =>
                      item?.status ===
                        "Approved" &&
                      Boolean(
                        item?.gmailDraftId
                      )
                  ).length,

                automatic:
                  safeQueue.filter(
                    (item) =>
                      item?.status ===
                        "Approved" &&
                      Boolean(
                        item?.gmailDraftId
                      ) &&
                      item?.autoSendEnabled ===
                        true
                  ).length,
              }
            } catch {
              return {
                approved: 0,
                automatic: 0,
              }
            }
          })()`,
          true,
        )
    } catch {
      return {
        approved: 0,
        automatic: 0,
      }
    }
  }

  async function getDiscoverySummary() {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.webContents.isDestroyed()
    ) {
      return {
        enabled: false,
        newMatches: 0,
        lastRunAt: "",
        event: null,
      }
    }

    try {
      return await mainWindow.webContents.executeJavaScript(
        `(() => {
          try {
            const settings = JSON.parse(
              localStorage.getItem(
                "jobpilot.discovery-settings"
              ) || "{}"
            )

            const results = JSON.parse(
              localStorage.getItem(
                "jobpilot.discovery-results"
              ) || "[]"
            )

            const event = JSON.parse(
              localStorage.getItem(
                "jobpilot.discovery-last-event"
              ) || "null"
            )

            return {
              enabled:
                settings?.enabled === true,

              newMatches:
                Array.isArray(results)
                  ? results.length
                  : 0,

              lastRunAt:
                settings?.lastRunAt || "",

              event:
                event &&
                typeof event === "object"
                  ? event
                  : null,
            }
          } catch {
            return {
              enabled: false,
              newMatches: 0,
              lastRunAt: "",
              event: null,
            }
          }
        })()`,
        true,
      )
    } catch {
      return {
        enabled: false,
        newMatches: 0,
        lastRunAt: "",
        event: null,
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Tray icon
  |--------------------------------------------------------------------------
  */

  function createTrayIcon() {
    const brandedIcon =
      nativeImage.createFromPath(
        path.join(
          __dirname,
          "assets",
          "breakveil-icon.png",
        ),
      )

    if (!brandedIcon.isEmpty()) {
      return brandedIcon.resize({
        width: 16,
        height: 16,
      })
    }

    const trayIconData =
      "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA0klEQVR4nOVXQQ7EIAhEsxfv8v8Htn/YnkhcI4oKtM3OraU4UxiaElJKcCc+XOA4zq8mEWIOrfuhroA28UhI9CRvcUQu4CUi9h70QATwfXsCcbJTUAMxU+LPdYdAdK6oBSUZYh6S1zlbAqQHreaam3AkQuyBGlyPZyu2VIGewaTm2xKgiXcK6PV51gPLJtwZzxLmLRiZ0lSAZCLMBEjHUf1DNIt3juF/CWj1Wqv/IgE1oSY5QLEXeP8X0n7wHA9wq5MFSq7IBTzIARq7IeG25dQbF3FTT09xwkYWAAAAAElFTkSuQmCC"

    return nativeImage
      .createFromDataURL(
        `data:image/png;base64,${trayIconData}`,
      )
      .resize({
        width: 16,
        height: 16,
      })
  }

  function showNotification(
    title,
    body,
    onClick = null,
  ) {
    if (
      !Notification.isSupported()
    ) {
      return
    }

    const notification =
      new Notification({
        title,
        body,
      })

    if (
      typeof onClick ===
      "function"
    ) {
      notification.on(
        "click",
        onClick,
      )
    }

    notification.show()
  }

  /*
  |--------------------------------------------------------------------------
  | Window control
  |--------------------------------------------------------------------------
  */

  function showMainWindow() {
    if (
      !mainWindow ||
      mainWindow.isDestroyed()
    ) {
      return
    }

    mainWindow.setOpacity(1)

    mainWindow.setSkipTaskbar(
      false,
    )

    if (
      mainWindow.isMinimized()
    ) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  }

  async function openDiscoveryMatches() {
    showMainWindow()

    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.webContents.isDestroyed()
    ) {
      return
    }

    try {
      await mainWindow.webContents.executeJavaScript(
        `(() => {
          window.location.hash = "#/jobs"
          window.dispatchEvent(
            new Event(
              "jobpilot:discovery-updated"
            )
          )
        })()`,
        true,
      )
    } catch (error) {
      console.error(
        "Could not open discovered jobs:",
        error,
      )
    }
  }

  function hideMainWindow({
    notify = true,
  } = {}) {
    if (
      !mainWindow ||
      mainWindow.isDestroyed()
    ) {
      return
    }

    mainWindow.hide()

    mainWindow.setSkipTaskbar(
      true,
    )

    if (
      notify &&
      !hiddenNotificationShown
    ) {
      hiddenNotificationShown = true

      showNotification(
        "BreakVeil AI is still running",
        "Automation continues in the system tray. Right-click the tray icon to pause it or quit safely.",
      )
    }
  }

  async function setDiscoveryEnabled(
    enabled,
  ) {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.webContents.isDestroyed()
    ) {
      return
    }

    try {
      await mainWindow.webContents.executeJavaScript(
        `(() => {
          const storageKey =
            "jobpilot.discovery-settings"

          let current = {}

          try {
            current = JSON.parse(
              localStorage.getItem(
                storageKey
              ) || "{}"
            )
          } catch {
            current = {}
          }

          const updated = {
            ...current,
            enabled: ${enabled === true},
            nextRunAt:
              ${enabled === true}
                ? new Date().toISOString()
                : current?.nextRunAt || "",
          }

          localStorage.setItem(
            storageKey,
            JSON.stringify(updated),
          )

          window.dispatchEvent(
            new Event(
              "jobpilot:discovery-settings-updated"
            )
          )

          return updated
        })()`,
        true,
      )

      showNotification(
        enabled
          ? "Job discovery resumed"
          : "Job discovery paused",

        enabled
          ? "BreakVeil will search connected sources for new profile matches."
          : "No scheduled vacancy searches will run until discovery is resumed.",
      )

      await refreshTrayMenu()
    } catch (error) {
      console.error(
        "Could not change job discovery setting:",
        error,
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Sending controls
  |--------------------------------------------------------------------------
  */

  async function setAutomationEnabled(
    enabled,
  ) {
    const settings =
      await readSendSettings()

    if (
      enabled &&
      settings.enabled !== true
    ) {
      showNotification(
        "Controlled sending is stopped",
        "Open BreakVeil and enable controlled sending before resuming automation.",
      )

      return
    }

    await updateSendSettings({
      automationEnabled:
        enabled,
    })

    showNotification(
      enabled
        ? "Automation resumed"
        : "Automation paused",

      enabled
        ? "Queued applications can now be processed in the background."
        : "No automatic applications will be sent until automation is resumed.",
    )

    await refreshTrayMenu()
  }

  async function emergencyStop() {
    await updateSendSettings({
      enabled: false,
      automationEnabled: false,
    })

    showNotification(
      "Emergency stop activated",
      "Manual and automatic Gmail sending are now blocked.",
    )

    await refreshTrayMenu()
  }

  function quitApp() {
    isQuitting = true

    if (refreshInterval) {
      clearInterval(
        refreshInterval,
      )

      refreshInterval = null
    }

    if (tray) {
      tray.destroy()
      tray = null
    }

    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.destroy()
    }

    app.quit()
  }

  /*
  |--------------------------------------------------------------------------
  | Tray menu
  |--------------------------------------------------------------------------
  */

  async function refreshTrayMenu() {
    if (!tray) {
      return
    }

    const [
      queueSummary,
      sendSummary,
      discoverySummary,
    ] = await Promise.all([
      getQueueSummary(),
      getSendSummary(),
      getDiscoverySummary(),
    ])

    const {
      settings,
      sentToday,
    } = sendSummary

    const discoveryEventId =
      discoverySummary?.event?.id ||
      ""

    if (!discoveryEventInitialised) {
      discoveryEventInitialised = true
      lastDiscoveryEventId =
        discoveryEventId
    } else if (
      discoveryEventId &&
      discoveryEventId !==
        lastDiscoveryEventId
    ) {
      lastDiscoveryEventId =
        discoveryEventId

      const eventCount =
        Number(
          discoverySummary?.event?.count ||
            0,
        )

      const sampleTitle =
        discoverySummary?.event
          ?.sampleTitle ||
        "New vacancy"

      const sampleCompany =
        discoverySummary?.event
          ?.sampleCompany ||
        ""

      showNotification(
        `${eventCount || discoverySummary.newMatches} new job match${
          (eventCount || discoverySummary.newMatches) === 1
            ? ""
            : "es"
        }`,
        sampleCompany
          ? `${sampleTitle} at ${sampleCompany}`
          : sampleTitle,
        openDiscoveryMatches,
      )
    }

    const startWithWindows =
      getStartWithWindowsStatus()

    const startupMenuItem =
      canManageWindowsStartup()
        ? {
            label:
              "Start with Windows",

            type:
              "checkbox",

            checked:
              startWithWindows,

            click:
              (menuItem) => {
                setStartWithWindows(
                  menuItem.checked,
                )
              },
          }
        : {
            label:
              "Start with Windows (available after install)",

            enabled: false,
          }

    const menu =
      Menu.buildFromTemplate([
        {
          label:
            "Open BreakVeil AI",

          click:
            showMainWindow,
        },

        {
          type:
            "separator",
        },

        {
          label:
            `Approved outbox: ${queueSummary.approved}`,

          enabled: false,
        },

        {
          label:
            `Automatic queue: ${queueSummary.automatic}`,

          enabled: false,
        },

        {
          label:
            `Sent today: ${sentToday} / ${settings.dailyLimit || 3}`,

          enabled: false,
        },

        {
          type:
            "separator",
        },

        {
          label:
            `New job matches: ${discoverySummary.newMatches || 0}`,

          enabled: false,
        },

        {
          label:
            discoverySummary.enabled
              ? "Pause job discovery"
              : "Resume job discovery",

          click: () => {
            setDiscoveryEnabled(
              !discoverySummary.enabled,
            )
          },
        },

        {
          label:
            "Open new job matches",

          enabled:
            discoverySummary.newMatches > 0,

          click:
            openDiscoveryMatches,
        },

        {
          type:
            "separator",
        },

        {
          label:
            settings.automationEnabled
              ? "Pause automation"
              : "Resume automation",

          enabled:
            settings.enabled === true,

          click: () => {
            setAutomationEnabled(
              !settings.automationEnabled,
            )
          },
        },

        {
          label:
            "Emergency stop",

          enabled:
            settings.enabled === true ||
            settings.automationEnabled ===
              true,

          click:
            emergencyStop,
        },

        {
          type:
            "separator",
        },

        startupMenuItem,

        {
          type:
            "separator",
        },

        {
          label:
            "Quit BreakVeil AI",

          click:
            quitApp,
        },
      ])

    tray.setContextMenu(menu)

    const tooltipParts = []

    if (discoverySummary.newMatches > 0) {
      tooltipParts.push(
        `${discoverySummary.newMatches} new job match${
          discoverySummary.newMatches === 1
            ? ""
            : "es"
        }`,
      )
    }

    if (queueSummary.automatic > 0) {
      tooltipParts.push(
        `${queueSummary.automatic} automatic application${
          queueSummary.automatic === 1
            ? ""
            : "s"
        } queued`,
      )
    }

    tray.setToolTip(
      tooltipParts.length > 0
        ? `BreakVeil AI — ${tooltipParts.join(" • ")}`
        : "BreakVeil AI",
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Window attachment
  |--------------------------------------------------------------------------
  */

  function attachWindow(
    window,
    {
      startHidden =
        false,
    } = {},
  ) {
    mainWindow =
      window

    if (
      startedInBackground ||
      startHidden
    ) {
      mainWindow.setOpacity(
        0,
      )

      hideMainWindow({
        notify:
          false,
      })
    }

    mainWindow.on(
      "close",
      (event) => {
        if (isQuitting) {
          return
        }

        const settings =
          getWindowSettings()

        if (
          settings.keepRunningOnClose !==
          true
        ) {
          isQuitting =
            true

          return
        }

        event.preventDefault()

        hideMainWindow()
      },
    )

    mainWindow.on(
      "show",
      refreshTrayMenu,
    )

    mainWindow.webContents.on(
      "did-finish-load",
      async () => {
        if (
          startedInBackground ||
          startHidden
        ) {
          hideMainWindow({
            notify:
              false,
          })
        }

        await refreshTrayMenu()
      },
    )

    mainWindow.on(
      "closed",
      () => {
        mainWindow = null
      },
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Tray creation
  |--------------------------------------------------------------------------
  */

  async function createTray() {
    if (tray) {
      return tray
    }

    tray = new Tray(
      createTrayIcon(),
    )

    tray.setToolTip(
      "BreakVeil AI",
    )

    tray.on(
      "click",
      showMainWindow,
    )

    tray.on(
      "right-click",
      refreshTrayMenu,
    )

    await refreshTrayMenu()

    refreshInterval =
      setInterval(
        refreshTrayMenu,
        TRAY_REFRESH_INTERVAL,
      )

    return tray
  }

  app.on(
    "before-quit",
    () => {
      isQuitting = true
    },
  )

  return {
    attachWindow,
    createTray,
    hideMainWindow,
    refreshTrayMenu,
    showMainWindow,
  }
}

module.exports = {
  registerBackgroundTray,
}

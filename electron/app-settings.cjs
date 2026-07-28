const fs = require("fs")
const path = require("path")

const fileSystem =
  fs.promises

const START_IN_BACKGROUND_ARGUMENT =
  "--background"

const DEFAULT_APP_SETTINGS = {
  launchAtStartup:
    false,

  startMinimized:
    false,

  keepRunningOnClose:
    true,
}

function registerAppSettings({
  app,
  ipcMain,
  getErrorMessage,
}) {
  let cachedSettings = {
    ...DEFAULT_APP_SETTINGS,
  }

  let loaded =
    false

  function getSettingsFolder() {
    return path.join(
      app.getPath(
        "userData",
      ),
      "app-settings",
    )
  }

  function getSettingsPath() {
    return path.join(
      getSettingsFolder(),
      "settings.json",
    )
  }

  function canManageStartup() {
    return (
      process.platform ===
        "win32" &&
      app.isPackaged
    )
  }

  function readStartupStatus() {
    if (
      !canManageStartup()
    ) {
      return false
    }

    try {
      return (
        app.getLoginItemSettings()
          .openAtLogin ===
        true
      )
    } catch {
      return false
    }
  }

  async function writeSettings(
    settings,
  ) {
    await fileSystem.mkdir(
      getSettingsFolder(),
      {
        recursive:
          true,
      },
    )

    await fileSystem.writeFile(
      getSettingsPath(),
      JSON.stringify(
        settings,
        null,
        2,
      ),
      "utf8",
    )
  }

  async function loadSettings() {
    if (loaded) {
      return {
        ...cachedSettings,

        startupAvailable:
          canManageStartup(),
      }
    }

    try {
      const contents =
        await fileSystem.readFile(
          getSettingsPath(),
          "utf8",
        )

      const parsed =
        JSON.parse(
          contents,
        )

      cachedSettings = {
        ...DEFAULT_APP_SETTINGS,

        ...(parsed &&
        typeof parsed ===
          "object"
          ? parsed
          : {}),
      }
    } catch {
      cachedSettings = {
        ...DEFAULT_APP_SETTINGS,
      }
    }

    if (
      canManageStartup()
    ) {
      cachedSettings.launchAtStartup =
        readStartupStatus()
    }

    loaded =
      true

    return {
      ...cachedSettings,

      startupAvailable:
        canManageStartup(),
    }
  }

  function getCachedSettings() {
    return {
      ...cachedSettings,

      startupAvailable:
        canManageStartup(),
    }
  }

  async function applyStartupSetting(
    settings,
  ) {
    if (
      !canManageStartup()
    ) {
      return false
    }

    app.setLoginItemSettings({
      openAtLogin:
        settings.launchAtStartup ===
        true,

      path:
        process.execPath,

      args:
        settings.startMinimized
          ? [
              START_IN_BACKGROUND_ARGUMENT,
            ]
          : [],
    })

    return readStartupStatus()
  }

  async function updateSettings(
    changes,
  ) {
    await loadSettings()

    const safeChanges =
      changes &&
      typeof changes ===
        "object"
        ? changes
        : {}

    const updated = {
      ...cachedSettings,

      launchAtStartup:
        safeChanges.launchAtStartup ===
        undefined
          ? cachedSettings.launchAtStartup
          : safeChanges.launchAtStartup ===
            true,

      startMinimized:
        safeChanges.startMinimized ===
        undefined
          ? cachedSettings.startMinimized
          : safeChanges.startMinimized ===
            true,

      keepRunningOnClose:
        safeChanges.keepRunningOnClose ===
        undefined
          ? cachedSettings.keepRunningOnClose
          : safeChanges.keepRunningOnClose !==
            false,
    }

    if (
      canManageStartup() &&
      (
        safeChanges.launchAtStartup !==
          undefined ||
        safeChanges.startMinimized !==
          undefined
      )
    ) {
      updated.launchAtStartup =
        await applyStartupSetting(
          updated,
        )
    }

    cachedSettings =
      updated

    await writeSettings(
      cachedSettings,
    )

    return getCachedSettings()
  }

  async function replaceSettings(
    settings,
  ) {
    const input =
      settings &&
      typeof settings ===
        "object"
        ? settings
        : DEFAULT_APP_SETTINGS

    return updateSettings({
      launchAtStartup:
        input.launchAtStartup ===
        true,

      startMinimized:
        input.startMinimized ===
        true,

      keepRunningOnClose:
        input.keepRunningOnClose !==
        false,
    })
  }

  async function resetSettings() {
    return replaceSettings(
      DEFAULT_APP_SETTINGS,
    )
  }

  ipcMain.handle(
    "app-settings:get",
    async () => {
      try {
        return {
          ok:
            true,

          settings:
            await loadSettings(),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            getErrorMessage(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "app-settings:update",
    async (
      _event,
      changes,
    ) => {
      try {
        return {
          ok:
            true,

          settings:
            await updateSettings(
              changes,
            ),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            getErrorMessage(
              error,
            ),
        }
      }
    },
  )

  return {
    getSettings:
      loadSettings,

    getCachedSettings,

    replaceSettings,

    resetSettings,
  }
}

module.exports = {
  registerAppSettings,
}

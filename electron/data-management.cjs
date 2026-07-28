const fs = require("fs")
const path = require("path")
const zlib = require("zlib")
const {
  promisify,
} = require("util")

const fileSystem =
  fs.promises

const gzip =
  promisify(
    zlib.gzip,
  )

const gunzip =
  promisify(
    zlib.gunzip,
  )

const BACKUP_FORMAT =
  "jobpilot-backup"

const BACKUP_VERSION =
  1

const MAX_BACKUP_BYTES =
  250 * 1024 * 1024

const DEFAULT_SETTINGS = {
  automaticFrequency:
    "disabled",

  retentionCount:
    5,

  lastAutomaticBackupAt:
    "",

  lastManualBackupAt:
    "",
}

const FREQUENCY_INTERVALS = {
  daily:
    24 * 60 * 60 * 1000,

  weekly:
    7 * 24 * 60 * 60 * 1000,

  monthly:
    30 * 24 * 60 * 60 * 1000,
}

const VALID_FREQUENCIES =
  new Set([
    "disabled",
    "daily",
    "weekly",
    "monthly",
  ])

const VALID_RETENTION_COUNTS =
  new Set([
    3,
    5,
    10,
    20,
  ])

function registerDataManagement({
  app,
  dialog,
  ipcMain,
  shell,
  getErrorMessage,
  getAppSettings,
  replaceAppSettings,
  resetAppSettings,
}) {
  function friendlyError(
    error,
  ) {
    if (
      typeof getErrorMessage ===
      "function"
    ) {
      return getErrorMessage(
        error,
      )
    }

    return (
      error?.message ||
      "An unknown error occurred."
    )
  }

  function getUserDataPath() {
    return app.getPath(
      "userData",
    )
  }

  function getManagementFolder() {
    return path.join(
      getUserDataPath(),
      "data-management",
    )
  }

  function getSettingsPath() {
    return path.join(
      getManagementFolder(),
      "settings.json",
    )
  }

  function getBackupsFolder() {
    return path.join(
      getUserDataPath(),
      "backups",
    )
  }

  function getDocumentsFolder() {
    return path.join(
      getUserDataPath(),
      "jobpilot-documents",
    )
  }

  function getDocumentsIndexPath() {
    return path.join(
      getDocumentsFolder(),
      "index.json",
    )
  }

  function getAppSettingsPath() {
    return path.join(
      getUserDataPath(),
      "app-settings",
      "settings.json",
    )
  }

  function getGmailControlFolder() {
    return path.join(
      getUserDataPath(),
      "gmail-send-control",
    )
  }

  function getGmailControlSettingsPath() {
    return path.join(
      getGmailControlFolder(),
      "settings.json",
    )
  }

  function getGmailActivityPath() {
    return path.join(
      getGmailControlFolder(),
      "activity-log.json",
    )
  }

  function getJobSourceCachePath() {
    return path.join(
      getUserDataPath(),
      "job-sources",
      "search-cache.json",
    )
  }

  function normaliseLocalStorageData(
    value,
  ) {
    if (
      !value ||
      typeof value !==
        "object" ||
      Array.isArray(
        value,
      )
    ) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(
        value,
      )
        .filter(
          ([key]) =>
            String(
              key,
            ).startsWith(
              "jobpilot.",
            ),
        )
        .map(
          ([
            key,
            storedValue,
          ]) => [
            String(
              key,
            ),
            String(
              storedValue ??
                "",
            ),
          ],
        ),
    )
  }

  function normaliseSettings(
    value,
  ) {
    const input =
      value &&
      typeof value ===
        "object"
        ? value
        : {}

    const frequency =
      VALID_FREQUENCIES.has(
        input.automaticFrequency,
      )
        ? input.automaticFrequency
        : DEFAULT_SETTINGS
            .automaticFrequency

    const retention =
      Number(
        input.retentionCount,
      )

    return {
      automaticFrequency:
        frequency,

      retentionCount:
        VALID_RETENTION_COUNTS.has(
          retention,
        )
          ? retention
          : DEFAULT_SETTINGS
              .retentionCount,

      lastAutomaticBackupAt:
        String(
          input.lastAutomaticBackupAt ||
            "",
        ),

      lastManualBackupAt:
        String(
          input.lastManualBackupAt ||
            "",
        ),
    }
  }

  async function ensureFolder(
    folderPath,
  ) {
    await fileSystem.mkdir(
      folderPath,
      {
        recursive:
          true,
      },
    )
  }

  async function readJson(
    filePath,
    fallbackValue,
  ) {
    try {
      const contents =
        await fileSystem.readFile(
          filePath,
          "utf8",
        )

      return JSON.parse(
        contents,
      )
    } catch {
      return fallbackValue
    }
  }

  async function readOptionalJson(
    filePath,
  ) {
    try {
      const contents =
        await fileSystem.readFile(
          filePath,
          "utf8",
        )

      return JSON.parse(
        contents,
      )
    } catch {
      return null
    }
  }

  async function writeJson(
    filePath,
    value,
  ) {
    await ensureFolder(
      path.dirname(
        filePath,
      ),
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

  async function removePath(
    targetPath,
  ) {
    try {
      await fileSystem.rm(
        targetPath,
        {
          recursive:
            true,

          force:
            true,
        },
      )
    } catch (error) {
      if (
        error?.code !==
        "ENOENT"
      ) {
        throw error
      }
    }
  }

  async function readSettings() {
    const stored =
      await readJson(
        getSettingsPath(),
        DEFAULT_SETTINGS,
      )

    return normaliseSettings(
      stored,
    )
  }

  async function writeSettings(
    settings,
  ) {
    const safeSettings =
      normaliseSettings(
        settings,
      )

    await writeJson(
      getSettingsPath(),
      safeSettings,
    )

    return safeSettings
  }

  async function getFolderSize(
    folderPath,
  ) {
    let total =
      0

    async function visit(
      currentPath,
    ) {
      let entries

      try {
        entries =
          await fileSystem.readdir(
            currentPath,
            {
              withFileTypes:
                true,
            },
          )
      } catch {
        return
      }

      for (
        const entry
        of entries
      ) {
        const fullPath =
          path.join(
            currentPath,
            entry.name,
          )

        if (
          entry.isDirectory()
        ) {
          await visit(
            fullPath,
          )
        } else if (
          entry.isFile()
        ) {
          try {
            const stats =
              await fileSystem.stat(
                fullPath,
              )

            total +=
              stats.size
          } catch {
            // Ignore files that disappear while status is calculated.
          }
        }
      }
    }

    await visit(
      folderPath,
    )

    return total
  }

  function timestampForFile(
    value =
      new Date(),
  ) {
    return value
      .toISOString()
      .replace(
        /[:.]/g,
        "-",
      )
  }

  function friendlyDateForFile() {
    const now =
      new Date()

    const year =
      now.getFullYear()

    const month =
      String(
        now.getMonth() +
          1,
      ).padStart(
        2,
        "0",
      )

    const day =
      String(
        now.getDate(),
      ).padStart(
        2,
        "0",
      )

    return `${year}-${month}-${day}`
  }

  async function readDocumentsForBackup() {
    const index =
      await readJson(
        getDocumentsIndexPath(),
        [],
      )

    const safeIndex =
      Array.isArray(
        index,
      )
        ? index
        : []

    const files =
      []

    for (
      const document
      of safeIndex
    ) {
      const storedName =
        path.basename(
          String(
            document?.storedName ||
              document?.fileName ||
              "",
          ),
        )

      if (!storedName) {
        continue
      }

      const documentPath =
        path.join(
          getDocumentsFolder(),
          storedName,
        )

      try {
        const buffer =
          await fileSystem.readFile(
            documentPath,
          )

        files.push({
          storedName,

          sizeBytes:
            buffer.length,

          base64:
            buffer.toString(
              "base64",
            ),
        })
      } catch {
        // Preserve the index entry so missing documents remain visible after restore.
      }
    }

    return {
      index:
        safeIndex,

      files,
    }
  }

  async function createBackupPayload(
    rendererStorage,
  ) {
    const documents =
      await readDocumentsForBackup()

    return {
      format:
        BACKUP_FORMAT,

      version:
        BACKUP_VERSION,

      createdAt:
        new Date()
          .toISOString(),

      applicationVersion:
        typeof app.getVersion ===
        "function"
          ? app.getVersion()
          : "",

      rendererStorage:
        normaliseLocalStorageData(
          rendererStorage,
        ),

      desktopData: {
        appSettings:
          typeof getAppSettings ===
          "function"
            ? await getAppSettings()
            : await readOptionalJson(
                getAppSettingsPath(),
              ),

        gmailSendControl: {
          settings:
            await readOptionalJson(
              getGmailControlSettingsPath(),
            ),

          activityLog:
            await readOptionalJson(
              getGmailActivityPath(),
            ),
        },

        dataManagementSettings:
          await readSettings(),
      },

      documents,

      privacy: {
        excluded: [
          "Gmail OAuth tokens",
          "Built-in job-source API credentials",
          "Custom job-source API credentials",
          "Google OAuth client credentials",
          "job-search cache files",
        ],
      },
    }
  }

  async function encodeBackup(
    payload,
  ) {
    const raw =
      Buffer.from(
        JSON.stringify(
          payload,
        ),
        "utf8",
      )

    return gzip(
      raw,
      {
        level:
          9,
      },
    )
  }

  async function writeBackupFile(
    filePath,
    rendererStorage,
  ) {
    const payload =
      await createBackupPayload(
        rendererStorage,
      )

    const encoded =
      await encodeBackup(
        payload,
      )

    await ensureFolder(
      path.dirname(
        filePath,
      ),
    )

    await fileSystem.writeFile(
      filePath,
      encoded,
    )

    return {
      filePath,

      createdAt:
        payload.createdAt,

      sizeBytes:
        encoded.length,

      documentCount:
        payload.documents.index.length,
    }
  }

  async function readBackupFile(
    filePath,
  ) {
    const stats =
      await fileSystem.stat(
        filePath,
      )

    if (
      stats.size >
      MAX_BACKUP_BYTES
    ) {
      throw new Error(
        "The selected backup is larger than BreakVeil's 250 MB restore limit.",
      )
    }

    const compressed =
      await fileSystem.readFile(
        filePath,
      )

    let raw

    try {
      raw =
        await gunzip(
          compressed,
        )
    } catch {
      throw new Error(
        "The selected file is not a valid BreakVeil backup.",
      )
    }

    let payload

    try {
      payload =
        JSON.parse(
          raw.toString(
            "utf8",
          ),
        )
    } catch {
      throw new Error(
        "The selected BreakVeil backup is damaged or incomplete.",
      )
    }

    if (
      payload?.format !==
        BACKUP_FORMAT ||
      Number(
        payload?.version,
      ) !==
        BACKUP_VERSION
    ) {
      throw new Error(
        "This backup format is not supported by the current BreakVeil version.",
      )
    }

    return payload
  }

  async function listAutomaticBackups() {
    try {
      const entries =
        await fileSystem.readdir(
          getBackupsFolder(),
          {
            withFileTypes:
              true,
          },
        )

      const backups =
        []

      for (
        const entry
        of entries
      ) {
        if (
          !entry.isFile() ||
          !entry.name.startsWith(
            "automatic-",
          ) ||
          !entry.name.endsWith(
            ".jobpilot-backup",
          )
        ) {
          continue
        }

        const fullPath =
          path.join(
            getBackupsFolder(),
            entry.name,
          )

        try {
          const stats =
            await fileSystem.stat(
              fullPath,
            )

          backups.push({
            name:
              entry.name,

            filePath:
              fullPath,

            modifiedAt:
              stats.mtime.toISOString(),

            sizeBytes:
              stats.size,
          })
        } catch {
          // Ignore an entry that disappears while being listed.
        }
      }

      return backups.sort(
        (
          first,
          second,
        ) =>
          new Date(
            second.modifiedAt,
          ).getTime() -
          new Date(
            first.modifiedAt,
          ).getTime(),
      )
    } catch {
      return []
    }
  }

  async function enforceRetention(
    retentionCount,
  ) {
    const backups =
      await listAutomaticBackups()

    const removable =
      backups.slice(
        retentionCount,
      )

    for (
      const backup
      of removable
    ) {
      await removePath(
        backup.filePath,
      )
    }
  }

  async function buildStatus() {
    const settings =
      await readSettings()

    const backups =
      await listAutomaticBackups()

    const [
      backupSizeBytes,
      documentSizeBytes,
    ] =
      await Promise.all([
        getFolderSize(
          getBackupsFolder(),
        ),
        getFolderSize(
          getDocumentsFolder(),
        ),
      ])

    return {
      settings,

      userDataPath:
        getUserDataPath(),

      backupsPath:
        getBackupsFolder(),

      automaticBackupCount:
        backups.length,

      newestAutomaticBackupAt:
        backups[0]
          ?.modifiedAt ||
        "",

      backupSizeBytes,

      documentSizeBytes,
    }
  }

  function isAutomaticBackupDue(
    settings,
  ) {
    if (
      settings.automaticFrequency ===
      "disabled"
    ) {
      return false
    }

    const interval =
      FREQUENCY_INTERVALS[
        settings.automaticFrequency
      ]

    if (!interval) {
      return false
    }

    const lastTime =
      new Date(
        settings.lastAutomaticBackupAt ||
          0,
      ).getTime()

    if (
      !Number.isFinite(
        lastTime,
      ) ||
      lastTime <=
        0
    ) {
      return true
    }

    return (
      Date.now() -
        lastTime >=
      interval
    )
  }

  async function createAutomaticBackup(
    rendererStorage,
    {
      force =
        false,
    } = {},
  ) {
    const settings =
      await readSettings()

    if (
      !force &&
      !isAutomaticBackupDue(
        settings,
      )
    ) {
      return {
        created:
          false,

        reason:
          settings.automaticFrequency ===
          "disabled"
            ? "disabled"
            : "not-due",
      }
    }

    await ensureFolder(
      getBackupsFolder(),
    )

    const filePath =
      path.join(
        getBackupsFolder(),
        `automatic-${timestampForFile()}.jobpilot-backup`,
      )

    const result =
      await writeBackupFile(
        filePath,
        rendererStorage,
      )

    const updatedSettings =
      await writeSettings({
        ...settings,

        lastAutomaticBackupAt:
          result.createdAt,
      })

    await enforceRetention(
      updatedSettings.retentionCount,
    )

    return {
      created:
        true,

      ...result,
    }
  }

  async function createSafetyBackup(
    rendererStorage,
  ) {
    await ensureFolder(
      getBackupsFolder(),
    )

    const filePath =
      path.join(
        getBackupsFolder(),
        `before-restore-${timestampForFile()}.jobpilot-backup`,
      )

    return writeBackupFile(
      filePath,
      rendererStorage,
    )
  }

  async function restoreDocuments(
    documents,
  ) {
    const index =
      Array.isArray(
        documents?.index,
      )
        ? documents.index
        : []

    const files =
      Array.isArray(
        documents?.files,
      )
        ? documents.files
        : []

    await removePath(
      getDocumentsFolder(),
    )

    await ensureFolder(
      getDocumentsFolder(),
    )

    for (
      const file
      of files
    ) {
      const storedName =
        path.basename(
          String(
            file?.storedName ||
              "",
          ),
        )

      if (
        !storedName ||
        !file?.base64
      ) {
        continue
      }

      const buffer =
        Buffer.from(
          String(
            file.base64,
          ),
          "base64",
        )

      await fileSystem.writeFile(
        path.join(
          getDocumentsFolder(),
          storedName,
        ),
        buffer,
      )
    }

    await writeJson(
      getDocumentsIndexPath(),
      index,
    )
  }

  async function restoreDesktopData(
    desktopData,
  ) {
    if (
      typeof replaceAppSettings ===
      "function"
    ) {
      await replaceAppSettings(
        desktopData?.appSettings ||
          {},
      )
    } else if (
      desktopData?.appSettings &&
      typeof desktopData.appSettings ===
        "object"
    ) {
      await writeJson(
        getAppSettingsPath(),
        desktopData.appSettings,
      )
    }

    if (
      desktopData
        ?.gmailSendControl
        ?.settings &&
      typeof desktopData
        .gmailSendControl
        .settings ===
        "object"
    ) {
      await writeJson(
        getGmailControlSettingsPath(),
        desktopData
          .gmailSendControl
          .settings,
      )
    } else {
      await removePath(
        getGmailControlSettingsPath(),
      )
    }

    if (
      Array.isArray(
        desktopData
          ?.gmailSendControl
          ?.activityLog,
      )
    ) {
      await writeJson(
        getGmailActivityPath(),
        desktopData
          .gmailSendControl
          .activityLog,
      )
    } else {
      await removePath(
        getGmailActivityPath(),
      )
    }

    if (
      desktopData
        ?.dataManagementSettings
    ) {
      await writeSettings(
        desktopData
          .dataManagementSettings,
      )
    }
  }

  async function copyDocumentsToExport(
    exportFolder,
  ) {
    const documents =
      await readDocumentsForBackup()

    const destination =
      path.join(
        exportFolder,
        "documents",
      )

    await ensureFolder(
      destination,
    )

    for (
      const file
      of documents.files
    ) {
      const storedName =
        path.basename(
          String(
            file.storedName ||
              "",
          ),
        )

      if (!storedName) {
        continue
      }

      await fileSystem.writeFile(
        path.join(
          destination,
          storedName,
        ),
        Buffer.from(
          file.base64,
          "base64",
        ),
      )
    }

    return documents.index
  }

  async function buildReadableExport(
    rendererStorage,
    serviceSummary,
  ) {
    return {
      format:
        "jobpilot-readable-export",

      version:
        1,

      exportedAt:
        new Date()
          .toISOString(),

      applicationVersion:
        typeof app.getVersion ===
        "function"
          ? app.getVersion()
          : "",

      localStorage:
        normaliseLocalStorageData(
          rendererStorage,
        ),

      appSettings:
        typeof getAppSettings ===
        "function"
          ? await getAppSettings()
          : await readOptionalJson(
              getAppSettingsPath(),
            ),

      gmailSending: {
        settings:
          await readOptionalJson(
            getGmailControlSettingsPath(),
          ),

        activityLog:
          await readOptionalJson(
            getGmailActivityPath(),
          ),
      },

      connectedServices:
        serviceSummary &&
        typeof serviceSummary ===
          "object"
          ? serviceSummary
          : {},

      documentIndex:
        await readJson(
          getDocumentsIndexPath(),
          [],
        ),

      excludedForSecurity: [
        "Gmail OAuth tokens",
        "Built-in job-source API credentials",
        "Custom job-source API credentials",
        "Google OAuth client credentials",
      ],
    }
  }

  ipcMain.handle(
    "data-management:get-status",
    async () => {
      try {
        return {
          ok:
            true,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:update-settings",
    async (
      _event,
      changes = {},
    ) => {
      try {
        const current =
          await readSettings()

        const settings =
          await writeSettings({
            ...current,
            ...changes,
          })

        await enforceRetention(
          settings.retentionCount,
        )

        return {
          ok:
            true,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:create-backup",
    async (
      _event,
      rendererStorage = {},
    ) => {
      try {
        const result =
          await dialog.showSaveDialog({
            title:
              "Create BreakVeil Backup",

            buttonLabel:
              "Create Backup",

            defaultPath:
              `BreakVeil-Backup-${friendlyDateForFile()}.jobpilot-backup`,

            filters: [
              {
                name:
                  "BreakVeil Backup",

                extensions: [
                  "jobpilot-backup",
                ],
              },
            ],
          })

        if (
          result.canceled ||
          !result.filePath
        ) {
          return {
            ok:
              true,

            canceled:
              true,
          }
        }

        const selectedPath =
          result.filePath.endsWith(
            ".jobpilot-backup",
          )
            ? result.filePath
            : `${result.filePath}.jobpilot-backup`

        const backup =
          await writeBackupFile(
            selectedPath,
            rendererStorage,
          )

        const settings =
          await readSettings()

        await writeSettings({
          ...settings,

          lastManualBackupAt:
            backup.createdAt,
        })

        return {
          ok:
            true,

          canceled:
            false,

          backup,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:run-automatic-backup",
    async (
      _event,
      rendererStorage = {},
    ) => {
      try {
        const result =
          await createAutomaticBackup(
            rendererStorage,
          )

        return {
          ok:
            true,

          ...result,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:restore-backup",
    async (
      _event,
      currentRendererStorage = {},
    ) => {
      try {
        const result =
          await dialog.showOpenDialog({
            title:
              "Restore BreakVeil Backup",

            buttonLabel:
              "Restore Backup",

            properties: [
              "openFile",
            ],

            filters: [
              {
                name:
                  "BreakVeil Backup",

                extensions: [
                  "jobpilot-backup",
                ],
              },
            ],
          })

        if (
          result.canceled ||
          result.filePaths.length ===
            0
        ) {
          return {
            ok:
              true,

            canceled:
              true,
          }
        }

        const payload =
          await readBackupFile(
            result.filePaths[0],
          )

        const safetyBackup =
          await createSafetyBackup(
            currentRendererStorage,
          )

        await restoreDocuments(
          payload.documents,
        )

        await restoreDesktopData(
          payload.desktopData ||
            {},
        )

        return {
          ok:
            true,

          canceled:
            false,

          restoredAt:
            new Date()
              .toISOString(),

          backupCreatedAt:
            payload.createdAt ||
            "",

          rendererStorage:
            normaliseLocalStorageData(
              payload.rendererStorage,
            ),

          safetyBackupPath:
            safetyBackup.filePath,
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:export-all",
    async (
      _event,
      payload = {},
    ) => {
      try {
        const result =
          await dialog.showOpenDialog({
            title:
              "Choose Export Location",

            buttonLabel:
              "Export BreakVeil Data",

            properties: [
              "openDirectory",
            ],
          })

        if (
          result.canceled ||
          result.filePaths.length ===
            0
        ) {
          return {
            ok:
              true,

            canceled:
              true,
          }
        }

        const exportFolder =
          path.join(
            result.filePaths[0],
            `BreakVeil-Export-${timestampForFile()}`,
          )

        await ensureFolder(
          exportFolder,
        )

        const readableData =
          await buildReadableExport(
            payload.rendererStorage,
            payload.serviceSummary,
          )

        await writeJson(
          path.join(
            exportFolder,
            "BreakVeil-data.json",
          ),
          readableData,
        )

        await copyDocumentsToExport(
          exportFolder,
        )

        await fileSystem.writeFile(
          path.join(
            exportFolder,
            "README.txt",
          ),
          [
            "BreakVeil AI data export",
            "",
            "This folder contains a human-readable JSON export and a copy of Resume Library documents.",
            "",
            "For security, Gmail OAuth tokens and all built-in or custom job-source credentials are not included.",
            "Use a .jobpilot-backup file rather than this export when restoring BreakVeil.",
          ].join(
            "\n",
          ),
          "utf8",
        )

        return {
          ok:
            true,

          canceled:
            false,

          exportPath:
            exportFolder,
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:open-storage",
    async () => {
      try {
        await ensureFolder(
          getUserDataPath(),
        )

        const errorMessage =
          await shell.openPath(
            getUserDataPath(),
          )

        if (errorMessage) {
          throw new Error(
            errorMessage,
          )
        }

        return {
          ok:
            true,

          path:
            getUserDataPath(),
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:clear-gmail-logs",
    async () => {
      try {
        await writeJson(
          getGmailActivityPath(),
          [],
        )

        return {
          ok:
            true,
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "data-management:reset-application-data",
    async () => {
      try {
        await Promise.all([
          removePath(
            getDocumentsFolder(),
          ),
          removePath(
            getGmailControlFolder(),
          ),
          removePath(
            getJobSourceCachePath(),
          ),
        ])

        await writeSettings(
          DEFAULT_SETTINGS,
        )

        if (
          typeof resetAppSettings ===
          "function"
        ) {
          await resetAppSettings()
        }

        return {
          ok:
            true,

          preserved: [
            "Automatic and manual backup files",
            "Gmail OAuth authorisation",
            "Reed API credentials",
            "Adzuna API credentials",
          ],
        }
      } catch (error) {
        return {
          ok:
            false,

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  return {
    getStatus:
      buildStatus,
  }
}

module.exports = {
  registerDataManagement,
}

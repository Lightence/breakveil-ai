const fs = require("fs")
const path = require("path")

const fileSystem =
  fs.promises

const SNAPSHOT_FORMAT =
  "jobpilot-data-migration-snapshot"

const SNAPSHOT_FORMAT_VERSION =
  1

const MAX_SNAPSHOT_COUNT =
  5

const MAX_RENDERER_STORAGE_BYTES =
  32 * 1024 * 1024

function registerDataMigrations({
  app,
  ipcMain,
  shell,
  getErrorMessage,
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
      "An unknown migration error occurred."
    )
  }

  function getMigrationFolder() {
    return path.join(
      app.getPath(
        "userData",
      ),
      "data-migrations",
    )
  }

  function getSnapshotFolder() {
    return path.join(
      getMigrationFolder(),
      "snapshots",
    )
  }

  function getStatusPath() {
    return path.join(
      getMigrationFolder(),
      "status.json",
    )
  }

  function safeInteger(
    value,
    fallback =
      0,
  ) {
    const parsed =
      Number.parseInt(
        String(
          value,
        ),
        10,
      )

    return Number.isFinite(
      parsed,
    )
      ? Math.max(
          0,
          parsed,
        )
      : fallback
  }

  function normaliseRendererStorage(
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

  async function ensureFolders() {
    await fileSystem.mkdir(
      getSnapshotFolder(),
      {
        recursive:
          true,
      },
    )
  }

  async function readJsonFile(
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

  async function writeJsonAtomically(
    filePath,
    value,
  ) {
    await fileSystem.mkdir(
      path.dirname(
        filePath,
      ),
      {
        recursive:
          true,
      },
    )

    const temporaryPath =
      `${filePath}.tmp-${process.pid}-${Date.now()}`

    await fileSystem.writeFile(
      temporaryPath,
      JSON.stringify(
        value,
        null,
        2,
      ),
      "utf8",
    )

    try {
      await fileSystem.rename(
        temporaryPath,
        filePath,
      )
    } catch {
      await fileSystem.copyFile(
        temporaryPath,
        filePath,
      )

      await fileSystem.unlink(
        temporaryPath,
      )
    }
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

  async function listSnapshots() {
    await ensureFolders()

    const entries =
      await fileSystem.readdir(
        getSnapshotFolder(),
        {
          withFileTypes:
            true,
        },
      )

    const snapshots =
      []

    for (
      const entry
      of entries
    ) {
      if (
        !entry.isFile() ||
        !entry.name.endsWith(
          ".json",
        )
      ) {
        continue
      }

      const snapshotPath =
        path.join(
          getSnapshotFolder(),
          entry.name,
        )

      try {
        const stats =
          await fileSystem.stat(
            snapshotPath,
          )

        const snapshot =
          await readJsonFile(
            snapshotPath,
            {},
          )

        snapshots.push({
          fileName:
            entry.name,

          path:
            snapshotPath,

          createdAt:
            snapshot.createdAt ||
            stats.mtime
              .toISOString(),

          fromVersion:
            safeInteger(
              snapshot.fromVersion,
            ),

          toVersion:
            safeInteger(
              snapshot.toVersion,
            ),

          appVersion:
            String(
              snapshot.appVersion ||
              "",
            ),

          storageKeyCount:
            safeInteger(
              snapshot.storageKeyCount,
            ),

          sizeBytes:
            stats.size,
        })
      } catch {
        // A damaged migration snapshot is ignored here and left untouched.
      }
    }

    return snapshots.sort(
      (
        first,
        second,
      ) =>
        new Date(
          second.createdAt,
        ).getTime() -
        new Date(
          first.createdAt,
        ).getTime(),
    )
  }

  async function pruneSnapshots() {
    const snapshots =
      await listSnapshots()

    for (
      const snapshot
      of snapshots.slice(
        MAX_SNAPSHOT_COUNT,
      )
    ) {
      try {
        await fileSystem.unlink(
          snapshot.path,
        )
      } catch {
        // Retention cleanup should never block a completed migration.
      }
    }
  }

  async function getStatus() {
    const [
      storedStatus,
      snapshots,
    ] =
      await Promise.all([
        readJsonFile(
          getStatusPath(),
          {},
        ),

        listSnapshots(),
      ])

    return {
      currentVersion:
        safeInteger(
          storedStatus.currentVersion,
        ),

      lastCompletedAt:
        String(
          storedStatus.lastCompletedAt ||
          "",
        ),

      lastFromVersion:
        safeInteger(
          storedStatus.lastFromVersion,
        ),

      lastToVersion:
        safeInteger(
          storedStatus.lastToVersion,
        ),

      lastSnapshotPath:
        String(
          storedStatus.lastSnapshotPath ||
          "",
        ),

      lastSummary:
        storedStatus.lastSummary &&
        typeof storedStatus.lastSummary ===
          "object"
          ? storedStatus.lastSummary
          : null,

      snapshotFolder:
        getSnapshotFolder(),

      snapshotCount:
        snapshots.length,

      newestSnapshot:
        snapshots[0] ||
        null,

      snapshots,
    }
  }

  ipcMain.handle(
    "data-migrations:get-status",
    async () => {
      try {
        return {
          ok:
            true,

          status:
            await getStatus(),
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
    "data-migrations:prepare",
    async (
      _event,
      payload,
    ) => {
      try {
        const fromVersion =
          safeInteger(
            payload?.fromVersion,
          )

        const toVersion =
          safeInteger(
            payload?.toVersion,
          )

        if (
          toVersion <=
          fromVersion
        ) {
          return {
            ok:
              true,

            required:
              false,

            status:
              await getStatus(),
          }
        }

        const rendererStorage =
          normaliseRendererStorage(
            payload?.rendererStorage,
          )

        const serializedStorage =
          JSON.stringify(
            rendererStorage,
          )

        const storageBytes =
          Buffer.byteLength(
            serializedStorage,
            "utf8",
          )

        if (
          storageBytes >
          MAX_RENDERER_STORAGE_BYTES
        ) {
          throw new Error(
            "Local BreakVeil data is too large for an automatic migration snapshot. Create a normal backup before continuing.",
          )
        }

        await ensureFolders()

        const createdAt =
          new Date()
            .toISOString()

        const fileName =
          `${timestampForFile()}-schema-v${fromVersion}-to-v${toVersion}.json`

        const snapshotPath =
          path.join(
            getSnapshotFolder(),
            fileName,
          )

        const snapshot = {
          format:
            SNAPSHOT_FORMAT,

          formatVersion:
            SNAPSHOT_FORMAT_VERSION,

          createdAt,

          appVersion:
            app.getVersion(),

          fromVersion,

          toVersion,

          storageKeyCount:
            Object.keys(
              rendererStorage,
            ).length,

          storageBytes,

          rendererStorage,
        }

        await writeJsonAtomically(
          snapshotPath,
          snapshot,
        )

        await pruneSnapshots()

        const status =
          await getStatus()

        return {
          ok:
            true,

          required:
            true,

          snapshot: {
            fileName,
            path:
              snapshotPath,
            createdAt,
            fromVersion,
            toVersion,
            storageKeyCount:
              snapshot.storageKeyCount,
            storageBytes,
          },

          status,
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
    "data-migrations:complete",
    async (
      _event,
      payload,
    ) => {
      try {
        const completedAt =
          new Date()
            .toISOString()

        const status = {
          currentVersion:
            safeInteger(
              payload?.toVersion,
            ),

          lastCompletedAt:
            completedAt,

          lastFromVersion:
            safeInteger(
              payload?.fromVersion,
            ),

          lastToVersion:
            safeInteger(
              payload?.toVersion,
            ),

          lastSnapshotPath:
            String(
              payload?.snapshotPath ||
              "",
            ),

          lastSummary:
            payload?.summary &&
            typeof payload.summary ===
              "object"
              ? payload.summary
              : null,

          appVersion:
            app.getVersion(),
        }

        await writeJsonAtomically(
          getStatusPath(),
          status,
        )

        return {
          ok:
            true,

          status:
            await getStatus(),
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
    "data-migrations:open-folder",
    async () => {
      try {
        await ensureFolders()

        const openResult =
          await shell.openPath(
            getSnapshotFolder(),
          )

        if (
          openResult
        ) {
          throw new Error(
            openResult,
          )
        }

        return {
          ok:
            true,

          path:
            getSnapshotFolder(),
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
    getStatus,
  }
}

module.exports = {
  registerDataMigrations,
}

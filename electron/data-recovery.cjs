const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const fileSystem =
  fs.promises

const MAX_RENDERER_STORAGE_BYTES =
  32 * 1024 * 1024

const RECOVERY_FORMAT =
  "jobpilot-recovery-quarantine"

const RECOVERY_FORMAT_VERSION =
  1

function registerDataRecovery({
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
      "An unknown recovery error occurred."
    )
  }

  function getRecoveryFolder() {
    return path.join(
      app.getPath(
        "userData",
      ),
      "data-recovery",
    )
  }

  function getQuarantineFolder() {
    return path.join(
      getRecoveryFolder(),
      "quarantine",
    )
  }

  function getDocumentBackupFolder() {
    return path.join(
      getRecoveryFolder(),
      "document-index-backups",
    )
  }

  function getMigrationSnapshotFolder() {
    return path.join(
      app.getPath(
        "userData",
      ),
      "data-migrations",
      "snapshots",
    )
  }

  function getDocumentsFolder() {
    return path.join(
      app.getPath(
        "userData",
      ),
      "jobpilot-documents",
    )
  }

  function getDocumentsIndexPath() {
    return path.join(
      getDocumentsFolder(),
      "index.json",
    )
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

  async function pathExists(
    targetPath,
  ) {
    try {
      await fileSystem.access(
        targetPath,
      )

      return true
    } catch {
      return false
    }
  }

  async function ensureFolders() {
    await Promise.all([
      fileSystem.mkdir(
        getQuarantineFolder(),
        {
          recursive:
            true,
        },
      ),

      fileSystem.mkdir(
        getDocumentBackupFolder(),
        {
          recursive:
            true,
        },
      ),

      fileSystem.mkdir(
        getMigrationSnapshotFolder(),
        {
          recursive:
            true,
        },
      ),

      fileSystem.mkdir(
        getDocumentsFolder(),
        {
          recursive:
            true,
        },
      ),
    ])
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

  async function readJsonFile(
    filePath,
  ) {
    const contents =
      await fileSystem.readFile(
        filePath,
        "utf8",
      )

    return {
      contents,

      value:
        JSON.parse(
          contents,
        ),
    }
  }

  async function listQuarantines() {
    await ensureFolders()

    const entries =
      await fileSystem.readdir(
        getQuarantineFolder(),
        {
          withFileTypes:
            true,
        },
      )

    const quarantines =
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

      const quarantinePath =
        path.join(
          getQuarantineFolder(),
          entry.name,
        )

      try {
        const [
          stats,
          parsed,
        ] =
          await Promise.all([
            fileSystem.stat(
              quarantinePath,
            ),

            readJsonFile(
              quarantinePath,
            ),
          ])

        quarantines.push({
          fileName:
            entry.name,

          path:
            quarantinePath,

          createdAt:
            String(
              parsed.value
                ?.createdAt ||
              stats.mtime
                .toISOString(),
            ),

          reason:
            String(
              parsed.value
                ?.reason ||
              "Recovery quarantine",
            ),

          issueCount:
            safeInteger(
              parsed.value
                ?.issueCount,
            ),

          storageKeyCount:
            safeInteger(
              parsed.value
                ?.storageKeyCount,
            ),

          sizeBytes:
            stats.size,
        })
      } catch {
        // Damaged quarantine files are left untouched and excluded from the list.
      }
    }

    return quarantines.sort(
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

  async function listMigrationSnapshots({
    includeStorage =
      false,
  } = {}) {
    await ensureFolders()

    const entries =
      await fileSystem.readdir(
        getMigrationSnapshotFolder(),
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
          getMigrationSnapshotFolder(),
          entry.name,
        )

      try {
        const [
          stats,
          parsed,
        ] =
          await Promise.all([
            fileSystem.stat(
              snapshotPath,
            ),

            readJsonFile(
              snapshotPath,
            ),
          ])

        const rendererStorage =
          normaliseRendererStorage(
            parsed.value
              ?.rendererStorage,
          )

        if (
          Object.keys(
            rendererStorage,
          ).length ===
          0
        ) {
          continue
        }

        snapshots.push({
          fileName:
            entry.name,

          path:
            snapshotPath,

          createdAt:
            String(
              parsed.value
                ?.createdAt ||
              stats.mtime
                .toISOString(),
            ),

          fromVersion:
            safeInteger(
              parsed.value
                ?.fromVersion,
            ),

          toVersion:
            safeInteger(
              parsed.value
                ?.toVersion,
            ),

          storageKeyCount:
            Object.keys(
              rendererStorage,
            ).length,

          sizeBytes:
            stats.size,

          ...(includeStorage
            ? {
                rendererStorage,
              }
            : {}),
        })
      } catch {
        // Invalid migration snapshots are ignored but never deleted.
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

  async function inspectDocumentLibrary({
    includeEntries =
      false,
  } = {}) {
    await ensureFolders()

    const indexPath =
      getDocumentsIndexPath()

    if (
      !await pathExists(
        indexPath,
      )
    ) {
      return {
        checkedAt:
          new Date()
            .toISOString(),

        healthy:
          true,

        critical:
          false,

        canRepair:
          false,

        documentCount:
          0,

        issueCount:
          0,

        orphanFileCount:
          0,

        issues:
          [],

        indexPath,

        ...(includeEntries
          ? {
              entries:
                [],
            }
          : {}),
      }
    }

    let rawIndex =
      ""

    let entries =
      []

    const issues =
      []

    try {
      rawIndex =
        await fileSystem.readFile(
          indexPath,
          "utf8",
        )

      const parsed =
        JSON.parse(
          rawIndex,
        )

      if (
        !Array.isArray(
          parsed,
        )
      ) {
        issues.push({
          type:
            "invalid-index-container",

          severity:
            "critical",

          message:
            "The Resume Library index is not an array.",
        })
      } else {
        entries =
          parsed
      }
    } catch {
      issues.push({
        type:
          "invalid-index-json",

        severity:
          "critical",

        message:
          "The Resume Library index contains unreadable JSON.",
      })
    }

    const referencedFiles =
      new Set()

    const seenIds =
      new Set()

    if (
      issues.length ===
      0
    ) {
      for (
        let index =
          0;
        index <
        entries.length;
        index +=
          1
      ) {
        const entry =
          entries[
            index
          ]

        if (
          !entry ||
          typeof entry !==
            "object" ||
          Array.isArray(
            entry,
          )
        ) {
          issues.push({
            type:
              "invalid-document-entry",

            severity:
              "repairable",

            index,

            message:
              `Resume Library entry ${index + 1} is not a valid document record.`,
          })

          continue
        }

        const id =
          String(
            entry.id ||
            "",
          ).trim()

        if (!id) {
          issues.push({
            type:
              "missing-document-id",

            severity:
              "repairable",

            index,

            message:
              `Resume Library entry ${index + 1} does not have an identifier.`,
          })
        } else if (
          seenIds.has(
            id,
          )
        ) {
          issues.push({
            type:
              "duplicate-document-id",

            severity:
              "repairable",

            index,

            message:
              `${entry.title || entry.originalName || `Document ${index + 1}`} shares an identifier with another document.`,
          })
        } else {
          seenIds.add(
            id,
          )
        }

        const storedName =
          String(
            entry.storedName ||
            entry.fileName ||
            entry.filename ||
            "",
          ).trim()

        if (
          !storedName ||
          path.basename(
            storedName,
          ) !==
          storedName
        ) {
          issues.push({
            type:
              "invalid-stored-name",

            severity:
              "repairable",

            index,

            message:
              `${entry.title || entry.originalName || `Document ${index + 1}`} does not have a safe stored filename.`,
          })

          continue
        }

        referencedFiles.add(
          storedName,
        )

        const documentPath =
          path.join(
            getDocumentsFolder(),
            storedName,
          )

        if (
          !await pathExists(
            documentPath,
          )
        ) {
          issues.push({
            type:
              "missing-document-file",

            severity:
              "repairable",

            index,

            storedName,

            message:
              `${entry.title || entry.originalName || storedName} is referenced by the Resume Library but the file is missing.`,
          })
        }
      }
    }

    const folderEntries =
      await fileSystem.readdir(
        getDocumentsFolder(),
        {
          withFileTypes:
            true,
        },
      )

    const orphanFiles =
      folderEntries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name !==
              "index.json" &&
            !referencedFiles.has(
              entry.name,
            ),
        )
        .map(
          (entry) =>
            entry.name,
        )

    const critical =
      issues.some(
        (issue) =>
          issue.severity ===
          "critical",
      )

    const repairable =
      issues.some(
        (issue) =>
          issue.severity ===
          "repairable",
      )

    return {
      checkedAt:
        new Date()
          .toISOString(),

      healthy:
        issues.length ===
        0,

      critical,

      canRepair:
        !critical &&
        repairable,

      documentCount:
        entries.length,

      issueCount:
        issues.length,

      orphanFileCount:
        orphanFiles.length,

      issues,

      orphanFiles,

      indexPath,

      ...(includeEntries
        ? {
            entries,
            rawIndex,
          }
        : {}),
    }
  }

  async function getStatus() {
    const [
      quarantines,
      snapshots,
      documentIntegrity,
    ] =
      await Promise.all([
        listQuarantines(),

        listMigrationSnapshots(),

        inspectDocumentLibrary(),
      ])

    return {
      recoveryFolder:
        getRecoveryFolder(),

      quarantineFolder:
        getQuarantineFolder(),

      quarantineCount:
        quarantines.length,

      newestQuarantine:
        quarantines[0] ||
        null,

      quarantines,

      snapshotCount:
        snapshots.length,

      latestSnapshot:
        snapshots[0] ||
        null,

      documentIntegrity,
    }
  }

  ipcMain.handle(
    "data-recovery:get-status",
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
    "data-recovery:create-quarantine",
    async (
      _event,
      payload,
    ) => {
      try {
        const rendererStorage =
          normaliseRendererStorage(
            payload?.rendererStorage,
          )

        const serialized =
          JSON.stringify(
            rendererStorage,
          )

        const storageBytes =
          Buffer.byteLength(
            serialized,
            "utf8",
          )

        if (
          storageBytes >
          MAX_RENDERER_STORAGE_BYTES
        ) {
          throw new Error(
            "The local BreakVeil data is too large for a recovery quarantine file. Create a normal backup before continuing.",
          )
        }

        await ensureFolders()

        const createdAt =
          new Date()
            .toISOString()

        const fileName =
          `${timestampForFile()}-recovery-quarantine.json`

        const quarantinePath =
          path.join(
            getQuarantineFolder(),
            fileName,
          )

        const issues =
          Array.isArray(
            payload?.issues,
          )
            ? payload.issues
            : []

        await writeJsonAtomically(
          quarantinePath,
          {
            format:
              RECOVERY_FORMAT,

            formatVersion:
              RECOVERY_FORMAT_VERSION,

            createdAt,

            appVersion:
              app.getVersion(),

            reason:
              String(
                payload?.reason ||
                "BreakVeil entered safe mode.",
              ),

            issueCount:
              issues.length,

            issues,

            storageKeyCount:
              Object.keys(
                rendererStorage,
              ).length,

            storageBytes,

            rendererStorage,
          },
        )

        return {
          ok:
            true,

          quarantine: {
            fileName,

            path:
              quarantinePath,

            createdAt,

            issueCount:
              issues.length,

            storageKeyCount:
              Object.keys(
                rendererStorage,
              ).length,

            storageBytes,
          },

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
    "data-recovery:get-latest-snapshot",
    async () => {
      try {
        const snapshots =
          await listMigrationSnapshots({
            includeStorage:
              true,
          })

        const latest =
          snapshots[0]

        if (!latest) {
          return {
            ok:
              false,

            error:
              "No valid migration safety snapshot is available.",
          }
        }

        return {
          ok:
            true,

          snapshot:
            latest,
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
    "data-recovery:repair-document-index",
    async () => {
      try {
        const inspection =
          await inspectDocumentLibrary({
            includeEntries:
              true,
          })

        if (
          inspection.critical
        ) {
          throw new Error(
            "The Resume Library index is unreadable and cannot be repaired automatically. Restore a full BreakVeil backup or use the saved index copy in the recovery folder.",
          )
        }

        if (
          !inspection.canRepair
        ) {
          return {
            ok:
              true,

            repaired:
              false,

            summary: {
              removedEntries:
                0,

              generatedIds:
                0,

              reassignedDuplicateIds:
                0,
            },

            documentIntegrity:
              inspection,
          }
        }

        await ensureFolders()

        const backupPath =
          path.join(
            getDocumentBackupFolder(),
            `${timestampForFile()}-index-before-repair.json`,
          )

        await fileSystem.writeFile(
          backupPath,
          inspection.rawIndex,
          "utf8",
        )

        const seenIds =
          new Set()

        const repairedEntries =
          []

        let removedEntries =
          0

        let generatedIds =
          0

        let reassignedDuplicateIds =
          0

        for (
          const entry
          of inspection.entries
        ) {
          if (
            !entry ||
            typeof entry !==
              "object" ||
            Array.isArray(
              entry,
            )
          ) {
            removedEntries +=
              1

            continue
          }

          const storedName =
            String(
              entry.storedName ||
              entry.fileName ||
              entry.filename ||
              "",
            ).trim()

          if (
            !storedName ||
            path.basename(
              storedName,
            ) !==
            storedName
          ) {
            removedEntries +=
              1

            continue
          }

          const documentPath =
            path.join(
              getDocumentsFolder(),
              storedName,
            )

          if (
            !await pathExists(
              documentPath,
            )
          ) {
            removedEntries +=
              1

            continue
          }

          const repairedEntry = {
            ...entry,

            storedName,

            fileName:
              entry.fileName ||
              storedName,
          }

          let id =
            String(
              repairedEntry.id ||
              "",
            ).trim()

          if (!id) {
            id =
              crypto.randomUUID()

            generatedIds +=
              1
          } else if (
            seenIds.has(
              id,
            )
          ) {
            id =
              crypto.randomUUID()

            reassignedDuplicateIds +=
              1
          }

          repairedEntry.id =
            id

          seenIds.add(
            id,
          )

          repairedEntries.push(
            repairedEntry,
          )
        }

        await writeJsonAtomically(
          getDocumentsIndexPath(),
          repairedEntries,
        )

        return {
          ok:
            true,

          repaired:
            true,

          backupPath,

          summary: {
            removedEntries,
            generatedIds,
            reassignedDuplicateIds,
          },

          documentIntegrity:
            await inspectDocumentLibrary(),
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
    "data-recovery:open-folder",
    async () => {
      try {
        await ensureFolders()

        const openResult =
          await shell.openPath(
            getRecoveryFolder(),
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
            getRecoveryFolder(),
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
  registerDataRecovery,
}

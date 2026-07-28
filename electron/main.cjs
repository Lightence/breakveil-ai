const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} = require("electron")

const crypto = require("crypto")
const fs = require("fs")
const http = require("http")
const path = require("path")
const { URL } = require("url")

const PRODUCT_NAME =
  "BreakVeil AI"

const LEGACY_USER_DATA_FOLDER =
  "jobpilot-ai"

app.setName(
  PRODUCT_NAME,
)

app.setPath(
  "userData",
  path.join(
    app.getPath("appData"),
    LEGACY_USER_DATA_FOLDER,
  ),
)

const { google } = require("googleapis")
const nodemailer = require("nodemailer")

const {
  registerGmailSendControl,
} = require("./gmail-send-control.cjs")

const {
  registerBackgroundTray,
} = require("./background-tray.cjs")

const {
  registerJobSources,
} = require("./job-sources.cjs")

const {
  registerJobSearchEngine,
} = require("./job-search-engine.cjs")

const {
  createCustomJobSourceService,
} = require("./custom-job-sources.cjs")

const {
  createDirectEmployerSourceService,
} = require("./direct-employer-sources.cjs")

const {
  registerDocumentPreview,
} = require("./document-preview.cjs")

const {
  registerAppSettings,
} = require("./app-settings.cjs")

const {
  registerDataManagement,
} = require("./data-management.cjs")

const {
  registerDataMigrations,
} = require("./data-migrations.cjs")

const {
  registerDataRecovery,
} = require("./data-recovery.cjs")

const {
  registerCompanyResearch,
} = require("./company-research.cjs")
const fileSystem = fs.promises

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
]

const GMAIL_AUTH_TIMEOUT =
  5 * 60 * 1000

let mainWindow = null

/*
|--------------------------------------------------------------------------
| General helpers
|--------------------------------------------------------------------------
*/

const SAFE_EXTERNAL_PROTOCOLS =
  new Set([
    "https:",
    "http:",
    "mailto:",
  ])

function isSafeExternalUrl(value) {
  try {
    const parsedUrl =
      new URL(value)

    return SAFE_EXTERNAL_PROTOCOLS
      .has(parsedUrl.protocol) &&
      !parsedUrl.username &&
      !parsedUrl.password
  } catch {
    return false
  }
}

async function openExternalSafely(value) {
  if (!isSafeExternalUrl(value)) {
    return false
  }

  await shell.openExternal(value)
  return true
}

function getErrorMessage(error) {
  if (!error) {
    return "An unknown error occurred."
  }

  if (
    typeof error === "string"
  ) {
    return error
  }

  const responseMessage =
    error?.response?.data?.error
      ?.message

  if (responseMessage) {
    return responseMessage
  }

  const nestedError =
    error?.response?.data?.error

  if (
    typeof nestedError ===
    "string"
  ) {
    return nestedError
  }

  if (error.message) {
    return error.message
  }

  return "An unknown error occurred."
}

function isValidEmail(email) {
  const safeEmail =
    String(email || "").trim()

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    safeEmail,
  )
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function getMimeType(filePath) {
  const extension =
    path
      .extname(filePath)
      .toLowerCase()

  const mimeTypes = {
    ".pdf": "application/pdf",

    ".doc":
      "application/msword",

    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    ".txt":
      "text/plain",

    ".rtf":
      "application/rtf",

    ".odt":
      "application/vnd.oasis.opendocument.text",

    ".jpg":
      "image/jpeg",

    ".jpeg":
      "image/jpeg",

    ".png":
      "image/png",
  }

  return (
    mimeTypes[extension] ||
    "application/octet-stream"
  )
}

/*
|--------------------------------------------------------------------------
| Resume Library storage
|--------------------------------------------------------------------------
*/

function getDocumentsFolder() {
  return path.join(
    app.getPath("userData"),
    "jobpilot-documents",
  )
}

function getDocumentsIndexPath() {
  return path.join(
    getDocumentsFolder(),
    "index.json",
  )
}

async function ensureDocumentsStorage() {
  await fileSystem.mkdir(
    getDocumentsFolder(),
    {
      recursive: true,
    },
  )

  try {
    await fileSystem.access(
      getDocumentsIndexPath(),
    )
  } catch {
    await fileSystem.writeFile(
      getDocumentsIndexPath(),
      "[]",
      "utf8",
    )
  }
}

async function readDocumentsIndex() {
  await ensureDocumentsStorage()

  try {
    const indexContents =
      await fileSystem.readFile(
        getDocumentsIndexPath(),
        "utf8",
      )

    const parsedIndex =
      JSON.parse(indexContents)

    return Array.isArray(
      parsedIndex,
    )
      ? parsedIndex
      : []
  } catch {
    return []
  }
}

async function writeDocumentsIndex(
  documents,
) {
  await ensureDocumentsStorage()

  await fileSystem.writeFile(
    getDocumentsIndexPath(),

    JSON.stringify(
      documents,
      null,
      2,
    ),

    "utf8",
  )
}

function getStoredDocumentName(
  document,
) {
  return (
    document?.storedName ||
    document?.fileName ||
    document?.filename ||
    ""
  )
}

function getDocumentTitle(
  originalName,
) {
  const extension =
    path.extname(originalName)

  return path.basename(
    originalName,
    extension,
  )
}

function normaliseCategory(
  category,
) {
  const safeCategory =
    String(category || "")
      .trim()

  return (
    safeCategory ||
    "Other"
  )
}

async function resolveDocument(
  documentId,
) {
  const documents =
    await readDocumentsIndex()

  const document =
    documents.find(
      (item) =>
        item.id === documentId,
    )

  if (!document) {
    throw new Error(
      "The selected document could not be found in the Resume Library.",
    )
  }

  const storedName =
    getStoredDocumentName(
      document,
    )

  if (!storedName) {
    throw new Error(
      "The selected document does not have a valid stored filename.",
    )
  }

  const documentPath =
    path.join(
      getDocumentsFolder(),
      storedName,
    )

  try {
    await fileSystem.access(
      documentPath,
    )
  } catch {
    throw new Error(
      `${document.title || document.originalName || "The selected document"} is no longer available on this computer.`,
    )
  }

  return {
    document,
    documentPath,
  }
}

/*
|--------------------------------------------------------------------------
| Resume Library IPC
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "documents:list",
  async () => {
    try {
      const documents =
        await readDocumentsIndex()

      return documents.sort(
        (first, second) => {
          const firstTime =
            new Date(
              first.updatedAt ||
                first.importedAt ||
                first.createdAt ||
                0,
            ).getTime()

          const secondTime =
            new Date(
              second.updatedAt ||
                second.importedAt ||
                second.createdAt ||
                0,
            ).getTime()

          return (
            secondTime -
            firstTime
          )
        },
      )
    } catch {
      return []
    }
  },
)

ipcMain.handle(
  "documents:add-files",
  async (
    _event,
    category,
  ) => {
    try {
      const selectedCategory =
        normaliseCategory(
          category,
        )

      const result =
        await dialog.showOpenDialog(
          mainWindow,
          {
            title:
              `Import ${selectedCategory}`,

            buttonLabel:
              "Import files",

            properties: [
              "openFile",
              "multiSelections",
            ],

            filters: [
              {
                name:
                  "Documents",

                extensions: [
                  "pdf",
                  "doc",
                  "docx",
                  "txt",
                  "rtf",
                  "odt",
                ],
              },

              {
                name:
                  "All files",

                extensions: ["*"],
              },
            ],
          },
        )

      if (
        result.canceled ||
        result.filePaths.length === 0
      ) {
        return {
          ok: true,
          canceled: true,
          documents: [],
        }
      }

      await ensureDocumentsStorage()

      const existingDocuments =
        await readDocumentsIndex()

      const importedDocuments = []

      for (
        const sourcePath
        of result.filePaths
      ) {
        const originalName =
          path.basename(sourcePath)

        const safeOriginalName =
          originalName.replace(
            /[^a-zA-Z0-9._ -]/g,
            "_",
          )

        const storedName =
          `${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}`

        const destinationPath =
          path.join(
            getDocumentsFolder(),
            storedName,
          )

        await fileSystem.copyFile(
          sourcePath,
          destinationPath,
        )

        const fileStats =
          await fileSystem.stat(
            destinationPath,
          )

        const now =
          new Date().toISOString()

        const isFirstInCategory =
          !existingDocuments.some(
            (document) =>
              document.category ===
              selectedCategory,
          ) &&
          !importedDocuments.some(
            (document) =>
              document.category ===
              selectedCategory,
          )

        const importedDocument = {
          id:
            crypto.randomUUID(),

          title:
            getDocumentTitle(
              originalName,
            ),

          originalName,
          storedName,

          fileName:
            storedName,

          category:
            selectedCategory,

          extension:
            path
              .extname(originalName)
              .toLowerCase(),

          mimeType:
            getMimeType(
              destinationPath,
            ),

          sizeBytes:
            fileStats.size,

          isDefault:
            isFirstInCategory,

          importedAt: now,
          createdAt: now,
          updatedAt: now,
        }

        importedDocuments.push(
          importedDocument,
        )
      }

      const updatedDocuments = [
        ...importedDocuments,
        ...existingDocuments,
      ]

      await writeDocumentsIndex(
        updatedDocuments,
      )

      return {
        ok: true,
        canceled: false,
        documents:
          importedDocuments,
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


function normaliseGeneratedDocumentFormat(format) {
  const safeFormat =
    String(format || "")
      .trim()
      .toLowerCase()

  if (
    safeFormat !== "docx" &&
    safeFormat !== "pdf"
  ) {
    throw new Error(
      "Generated documents must use Word or PDF format.",
    )
  }

  return safeFormat
}

function getSafeGeneratedFileName(
  requestedName,
  format,
) {
  const extension =
    `.${format}`

  let safeName =
    path
      .basename(
        String(
          requestedName ||
            `BreakVeil Cover Letter${extension}`,
        ),
      )
      .replace(
        /[^a-zA-Z0-9._ ()&'-]/g,
        "_",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()

  if (
    !safeName
      .toLowerCase()
      .endsWith(
        extension,
      )
  ) {
    safeName =
      `${path.basename(safeName, path.extname(safeName)) || "BreakVeil Cover Letter"}${extension}`
  }

  return safeName.slice(
    0,
    180,
  )
}

ipcMain.handle(
  "documents:save-generated",
  async (
    _event,
    generatedDetails = {},
  ) => {
    let destinationPath = ""

    try {
      const format =
        normaliseGeneratedDocumentFormat(
          generatedDetails.format,
        )

      const generatedKey =
        String(
          generatedDetails.generatedKey ||
            "",
        )
          .trim()
          .slice(
            0,
            500,
          )

      if (!generatedKey) {
        throw new Error(
          "BreakVeil could not identify which vacancy this cover letter belongs to.",
        )
      }

      const rawBase64 =
        String(
          generatedDetails.base64 ||
            "",
        ).replace(
          /^data:[^;]+;base64,/i,
          "",
        )

      if (!rawBase64) {
        throw new Error(
          "The generated cover letter did not contain any file data.",
        )
      }

      const fileBuffer =
        Buffer.from(
          rawBase64,
          "base64",
        )

      if (
        fileBuffer.length <
        100
      ) {
        throw new Error(
          "The generated cover letter file was incomplete.",
        )
      }

      const maximumFileSize =
        20 * 1024 * 1024

      if (
        fileBuffer.length >
        maximumFileSize
      ) {
        throw new Error(
          "The generated cover letter is larger than the 20 MB library limit.",
        )
      }

      const originalName =
        getSafeGeneratedFileName(
          generatedDetails.fileName,
          format,
        )

      await ensureDocumentsStorage()

      const existingDocuments =
        await readDocumentsIndex()

      const existingDocument =
        existingDocuments.find(
          (document) =>
            [
              "JobPilot",
              "BreakVeil",
            ].includes(
              document.generatedBy,
            ) &&
            document.generatedKind ===
              "cover-letter" &&
            document.generatedKey ===
              generatedKey,
        )

      const safeOriginalName =
        originalName.replace(
          /[^a-zA-Z0-9._ -]/g,
          "_",
        )

      const storedName =
        `${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}`

      destinationPath =
        path.join(
          getDocumentsFolder(),
          storedName,
        )

      const temporaryPath =
        `${destinationPath}.${crypto.randomUUID()}.tmp`

      await fileSystem.writeFile(
        temporaryPath,
        fileBuffer,
        {
          flag: "wx",
        },
      )

      await fileSystem.rename(
        temporaryPath,
        destinationPath,
      )

      const now =
        new Date().toISOString()

      const contentHash =
        crypto
          .createHash(
            "sha256",
          )
          .update(
            fileBuffer,
          )
          .digest(
            "hex",
          )

      const generatedDocument = {
        id:
          existingDocument?.id ||
          crypto.randomUUID(),

        title:
          getDocumentTitle(
            originalName,
          ),

        originalName,
        storedName,

        fileName:
          storedName,

        category:
          "Cover Letter",

        extension:
          `.${format}`,

        mimeType:
          getMimeType(
            destinationPath,
          ),

        sizeBytes:
          fileBuffer.length,

        isDefault:
          Boolean(
            existingDocument?.isDefault,
          ),

        generated:
          true,

        generatedBy:
          "BreakVeil",

        generatedKind:
          "cover-letter",

        generatedFormat:
          format,

        generatedKey,

        generatedContentHash:
          contentHash,

        sourceJobId:
          String(
            generatedDetails.sourceJobId ||
              existingDocument?.sourceJobId ||
              "",
          )
            .trim()
            .slice(
              0,
              200,
            ),

        sourceJobRole:
          String(
            generatedDetails.sourceJobRole ||
              existingDocument?.sourceJobRole ||
              "",
          )
            .trim()
            .slice(
              0,
              300,
            ),

        sourceCompany:
          String(
            generatedDetails.sourceCompany ||
              existingDocument?.sourceCompany ||
              "",
          )
            .trim()
            .slice(
              0,
              300,
            ),

        sourceJobUrl:
          String(
            generatedDetails.sourceJobUrl ||
              existingDocument?.sourceJobUrl ||
              "",
          )
            .trim()
            .slice(
              0,
              2000,
            ),

        assistantWorkspaceId:
          String(
            generatedDetails.assistantWorkspaceId ||
              existingDocument?.assistantWorkspaceId ||
              generatedKey,
          )
            .trim()
            .slice(
              0,
              500,
            ),

        addedAt:
          existingDocument?.addedAt ||
          existingDocument?.importedAt ||
          existingDocument?.createdAt ||
          now,

        importedAt:
          existingDocument?.importedAt ||
          now,

        createdAt:
          existingDocument?.createdAt ||
          now,

        updatedAt:
          now,
      }

      const updatedDocuments =
        existingDocument
          ? existingDocuments.map(
              (document) =>
                document.id ===
                existingDocument.id
                  ? generatedDocument
                  : document,
            )
          : [
              generatedDocument,
              ...existingDocuments,
            ]

      try {
        await writeDocumentsIndex(
          updatedDocuments,
        )
      } catch (error) {
        try {
          await fileSystem.unlink(
            destinationPath,
          )
        } catch {
          // Ignore cleanup errors.
        }

        destinationPath = ""

        throw error
      }

      const previousStoredName =
        getStoredDocumentName(
          existingDocument,
        )

      if (
        previousStoredName &&
        previousStoredName !==
          storedName
      ) {
        const previousPath =
          path.join(
            getDocumentsFolder(),
            previousStoredName,
          )

        try {
          await fileSystem.unlink(
            previousPath,
          )
        } catch (error) {
          if (
            error?.code !==
            "ENOENT"
          ) {
            console.warn(
              "BreakVeil could not remove the previous generated cover letter:",
              getErrorMessage(
                error,
              ),
            )
          }
        }
      }

      return {
        ok: true,

        replaced:
          Boolean(
            existingDocument,
          ),

        document:
          generatedDocument,
      }
    } catch (error) {
      if (destinationPath) {
        try {
          await fileSystem.unlink(
            destinationPath,
          )
        } catch {
          // Ignore cleanup errors.
        }
      }

      return {
        ok: false,

        error:
          getErrorMessage(
            error,
          ),
      }
    }
  },
)

ipcMain.handle(
  "documents:open",
  async (
    _event,
    documentId,
  ) => {
    try {
      const {
        documentPath,
      } = await resolveDocument(
        documentId,
      )

      const openError =
        await shell.openPath(
          documentPath,
        )

      if (openError) {
        throw new Error(
          openError,
        )
      }

      return {
        ok: true,
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
  "documents:set-default",
  async (
    _event,
    documentId,
  ) => {
    try {
      const documents =
        await readDocumentsIndex()

      const selectedDocument =
        documents.find(
          (document) =>
            document.id ===
            documentId,
        )

      if (!selectedDocument) {
        throw new Error(
          "The selected document could not be found.",
        )
      }

      const now =
        new Date().toISOString()

      const updatedDocuments =
        documents.map(
          (document) => {
            if (
              document.category !==
              selectedDocument.category
            ) {
              return document
            }

            return {
              ...document,

              isDefault:
                document.id ===
                documentId,

              updatedAt:
                document.id ===
                documentId
                  ? now
                  : document.updatedAt,
            }
          },
        )

      await writeDocumentsIndex(
        updatedDocuments,
      )

      return {
        ok: true,
        documents:
          updatedDocuments,
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
  "documents:delete",
  async (
    _event,
    documentId,
  ) => {
    try {
      const documents =
        await readDocumentsIndex()

      const selectedDocument =
        documents.find(
          (document) =>
            document.id ===
            documentId,
        )

      if (!selectedDocument) {
        throw new Error(
          "The selected document could not be found.",
        )
      }

      const storedName =
        getStoredDocumentName(
          selectedDocument,
        )

      if (storedName) {
        const documentPath =
          path.join(
            getDocumentsFolder(),
            storedName,
          )

        try {
          await fileSystem.unlink(
            documentPath,
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

      let updatedDocuments =
        documents.filter(
          (document) =>
            document.id !==
            documentId,
        )

      if (
        selectedDocument.isDefault
      ) {
        const replacementIndex =
          updatedDocuments.findIndex(
            (document) =>
              document.category ===
              selectedDocument.category,
          )

        if (
          replacementIndex >= 0
        ) {
          updatedDocuments =
            updatedDocuments.map(
              (
                document,
                index,
              ) =>
                index ===
                replacementIndex
                  ? {
                      ...document,
                      isDefault: true,
                      updatedAt:
                        new Date()
                          .toISOString(),
                    }
                  : document,
            )
        }
      }

      await writeDocumentsIndex(
        updatedDocuments,
      )

      return {
        ok: true,
        documents:
          updatedDocuments,
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

/*
|--------------------------------------------------------------------------
| Gmail OAuth storage
|--------------------------------------------------------------------------
*/

function getGmailCredentialsPath() {
  return path.join(
    __dirname,
    "google",
    "credentials.json",
  )
}

function getGmailTokenPath() {
  return path.join(
    app.getPath("userData"),
    "gmail-token.json",
  )
}

async function gmailCredentialsExist() {
  try {
    await fileSystem.access(
      getGmailCredentialsPath(),
    )

    return true
  } catch {
    return false
  }
}

async function readOAuthConfiguration() {
  const credentialsPath =
    getGmailCredentialsPath()

  let credentialsContents

  try {
    credentialsContents =
      await fileSystem.readFile(
        credentialsPath,
        "utf8",
      )
  } catch {
    throw new Error(
      "Gmail credentials.json could not be found. Place it inside electron/google and restart BreakVeil.",
    )
  }

  let credentials

  try {
    credentials =
      JSON.parse(
        credentialsContents,
      )
  } catch {
    throw new Error(
      "The Gmail credentials.json file is not valid JSON.",
    )
  }

  const configuration =
    credentials.installed ||
    credentials.web

  if (
    !configuration?.client_id ||
    !configuration?.client_secret
  ) {
    throw new Error(
      "The Gmail credentials file does not contain a valid OAuth client.",
    )
  }

  return configuration
}

async function readGmailTokenRecord() {
  try {
    const tokenContents =
      await fileSystem.readFile(
        getGmailTokenPath(),
        "utf8",
      )

    const tokenRecord =
      JSON.parse(
        tokenContents,
      )

    if (
      !tokenRecord ||
      typeof tokenRecord !==
        "object"
    ) {
      return null
    }

    return tokenRecord
  } catch {
    return null
  }
}

async function writeGmailTokenRecord(
  tokenRecord,
) {
  await fileSystem.mkdir(
    path.dirname(
      getGmailTokenPath(),
    ),
    {
      recursive: true,
    },
  )

  await fileSystem.writeFile(
    getGmailTokenPath(),

    JSON.stringify(
      tokenRecord,
      null,
      2,
    ),

    "utf8",
  )
}

async function removeGmailTokenRecord() {
  try {
    await fileSystem.unlink(
      getGmailTokenPath(),
    )
  } catch (error) {
    if (
      error?.code !== "ENOENT"
    ) {
      throw error
    }
  }
}

function createOAuthClient(
  configuration,
  redirectUri,
) {
  return new google.auth.OAuth2(
    configuration.client_id,
    configuration.client_secret,
    redirectUri,
  )
}

function attachTokenPersistence(
  oauthClient,
  existingRecord,
) {
  oauthClient.on(
    "tokens",
    async (
      refreshedTokens,
    ) => {
      try {
        const latestRecord =
          (await readGmailTokenRecord()) ||
          existingRecord ||
          {}

        const mergedTokens = {
          ...(latestRecord.tokens ||
            {}),

          ...refreshedTokens,
        }

        await writeGmailTokenRecord({
          ...latestRecord,

          tokens:
            mergedTokens,

          updatedAt:
            new Date()
              .toISOString(),
        })
      } catch (error) {
        console.error(
          "Could not save refreshed Gmail token:",
          error,
        )
      }
    },
  )
}

async function getAuthenticatedGmail() {
  const configuration =
    await readOAuthConfiguration()

  const tokenRecord =
    await readGmailTokenRecord()

  if (
    !tokenRecord?.tokens
  ) {
    throw new Error(
      "Gmail is not connected. Connect it from the Automation page.",
    )
  }

  const fallbackRedirectUri =
    configuration
      .redirect_uris?.[0] ||
    "http://127.0.0.1"

  const oauthClient =
    createOAuthClient(
      configuration,
      fallbackRedirectUri,
    )

  oauthClient.setCredentials(
    tokenRecord.tokens,
  )

  attachTokenPersistence(
    oauthClient,
    tokenRecord,
  )

  try {
    await oauthClient.getAccessToken()
  } catch {
    throw new Error(
      "The saved Gmail authorisation is no longer valid. Reconnect Gmail from the Automation page.",
    )
  }

  const gmail =
    google.gmail({
      version: "v1",
      auth: oauthClient,
    })

  return {
    gmail,
    oauthClient,
    tokenRecord,
  }
}

/*
|--------------------------------------------------------------------------
| Gmail status
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "gmail:get-status",
  async () => {
    const configured =
      await gmailCredentialsExist()

    if (!configured) {
      return {
        configured: false,
        connected: false,
        email: "",
        needsReconnect: false,

        error:
          "The Gmail credentials file could not be found.",
      }
    }

    const tokenRecord =
      await readGmailTokenRecord()

    if (
      !tokenRecord?.tokens
    ) {
      return {
        configured: true,
        connected: false,
        email: "",
        needsReconnect: false,
        error: "",
      }
    }

    try {
      const {
        gmail,
      } =
        await getAuthenticatedGmail()

      const profileResponse =
        await gmail.users.getProfile({
          userId: "me",
        })

      const emailAddress =
        profileResponse.data
          .emailAddress ||
        tokenRecord.email ||
        ""

      if (
        emailAddress !==
        tokenRecord.email
      ) {
        await writeGmailTokenRecord({
          ...tokenRecord,

          email:
            emailAddress,

          updatedAt:
            new Date()
              .toISOString(),
        })
      }

      return {
        configured: true,
        connected: true,
        email:
          emailAddress,

        needsReconnect: false,
        error: "",
      }
    } catch (error) {
      return {
        configured: true,
        connected: false,

        email:
          tokenRecord.email ||
          "",

        needsReconnect: true,

        error:
          getErrorMessage(error),
      }
    }
  },
)

/*
|--------------------------------------------------------------------------
| Gmail OAuth connection
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "gmail:connect",
  async () => {
    let callbackServer = null
    let timeoutId = null

    try {
      const configuration =
        await readOAuthConfiguration()

      const state =
        crypto
          .randomBytes(32)
          .toString("hex")

      const callbackResult =
        await new Promise(
          (
            resolve,
            reject,
          ) => {
            let completed = false

            function finish(
              error,
              value,
            ) {
              if (completed) {
                return
              }

              completed = true

              if (timeoutId) {
                clearTimeout(
                  timeoutId,
                )

                timeoutId = null
              }

              if (
                callbackServer
              ) {
                callbackServer.close()
              }

              if (error) {
                reject(error)
              } else {
                resolve(value)
              }
            }

            callbackServer =
              http.createServer(
                async (
                  request,
                  response,
                ) => {
                  try {
                    const requestUrl =
                      new URL(
                        request.url,
                        `http://${request.headers.host}`,
                      )

                    if (
                      requestUrl.pathname !==
                      "/oauth2callback"
                    ) {
                      response.writeHead(
                        404,
                        {
                          "Content-Type":
                            "text/plain; charset=utf-8",
                        },
                      )

                      response.end(
                        "Not found",
                      )

                      return
                    }

                    const returnedState =
                      requestUrl.searchParams.get(
                        "state",
                      )

                    const oauthError =
                      requestUrl.searchParams.get(
                        "error",
                      )

                    const code =
                      requestUrl.searchParams.get(
                        "code",
                      )

                    if (
                      returnedState !==
                      state
                    ) {
                      response.writeHead(
                        400,
                        {
                          "Content-Type":
                            "text/html; charset=utf-8",
                        },
                      )

                      response.end(
                        createOAuthResultPage({
                          successful:
                            false,

                          title:
                            "BreakVeil could not connect Gmail",

                          message:
                            "The Google authorisation response could not be verified. You may close this window.",
                        }),
                      )

                      finish(
                        new Error(
                          "The Gmail authorisation response could not be verified.",
                        ),
                      )

                      return
                    }

                    if (oauthError) {
                      response.writeHead(
                        400,
                        {
                          "Content-Type":
                            "text/html; charset=utf-8",
                        },
                      )

                      response.end(
                        createOAuthResultPage({
                          successful:
                            false,

                          title:
                            "Gmail connection cancelled",

                          message:
                            "Google did not authorise BreakVeil. You may close this window.",
                        }),
                      )

                      finish(
                        new Error(
                          `Google authorisation was not completed: ${oauthError}`,
                        ),
                      )

                      return
                    }

                    if (!code) {
                      response.writeHead(
                        400,
                        {
                          "Content-Type":
                            "text/html; charset=utf-8",
                        },
                      )

                      response.end(
                        createOAuthResultPage({
                          successful:
                            false,

                          title:
                            "Gmail connection failed",

                          message:
                            "Google did not return an authorisation code. You may close this window.",
                        }),
                      )

                      finish(
                        new Error(
                          "Google did not return an authorisation code.",
                        ),
                      )

                      return
                    }

                    response.writeHead(
                      200,
                      {
                        "Content-Type":
                          "text/html; charset=utf-8",
                      },
                    )

                    response.end(
                      createOAuthResultPage({
                        successful:
                          true,

                        title:
                          "Gmail connected",

                        message:
                          "Google authorisation was completed. Return to BreakVeil to continue.",
                      }),
                    )

                    finish(
                      null,
                      {
                        code,
                      },
                    )
                  } catch (error) {
                    response.writeHead(
                      500,
                      {
                        "Content-Type":
                          "text/html; charset=utf-8",
                      },
                    )

                    response.end(
                      createOAuthResultPage({
                        successful:
                          false,

                        title:
                          "Gmail connection failed",

                        message:
                          "BreakVeil could not process the Google response. You may close this window.",
                      }),
                    )

                    finish(error)
                  }
                },
              )

            callbackServer.on(
              "error",
              finish,
            )

            callbackServer.listen(
              0,
              "127.0.0.1",
              async () => {
                try {
                  const address =
                    callbackServer.address()

                  const port =
                    typeof address ===
                    "object"
                      ? address.port
                      : null

                  if (!port) {
                    throw new Error(
                      "BreakVeil could not create the local Gmail callback.",
                    )
                  }

                  const redirectUri =
                    `http://127.0.0.1:${port}/oauth2callback`

                  const oauthClient =
                    createOAuthClient(
                      configuration,
                      redirectUri,
                    )

                  const verifier =
                    await oauthClient
                      .generateCodeVerifierAsync()

                  const authUrl =
                    oauthClient.generateAuthUrl({
                      access_type:
                        "offline",

                      prompt:
                        "consent select_account",

                      scope:
                        GMAIL_SCOPES,

                      state,

                      code_challenge:
                        verifier.codeChallenge,

                      code_challenge_method:
                        "S256",
                    })

                  timeoutId =
                    setTimeout(
                      () => {
                        finish(
                          new Error(
                            "Gmail connection timed out. Try connecting again.",
                          ),
                        )
                      },

                      GMAIL_AUTH_TIMEOUT,
                    )

                  await shell.openExternal(
                    authUrl,
                  )

                  callbackServer.oauthDetails = {
                    oauthClient,

                    codeVerifier:
                      verifier.codeVerifier,
                  }
                } catch (error) {
                  finish(error)
                }
              },
            )
          },
        )

      const oauthDetails =
        callbackServer
          ?.oauthDetails

      if (
        !oauthDetails?.oauthClient ||
        !oauthDetails?.codeVerifier
      ) {
        throw new Error(
          "BreakVeil could not complete the Gmail authorisation setup.",
        )
      }

      const tokenResponse =
        await oauthDetails
          .oauthClient
          .getToken({
            code:
              callbackResult.code,

            codeVerifier:
              oauthDetails
                .codeVerifier,
          })

      oauthDetails.oauthClient
        .setCredentials(
          tokenResponse.tokens,
        )

      const gmail =
        google.gmail({
          version: "v1",

          auth:
            oauthDetails
              .oauthClient,
        })

      const profileResponse =
        await gmail.users
          .getProfile({
            userId: "me",
          })

      const emailAddress =
        profileResponse.data
          .emailAddress ||
        ""

      const now =
        new Date().toISOString()

      await writeGmailTokenRecord({
        tokens:
          tokenResponse.tokens,

        email:
          emailAddress,

        connectedAt: now,
        updatedAt: now,
      })

      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.show()
        mainWindow.focus()
      }

      return {
        ok: true,
        email:
          emailAddress,
      }
    } catch (error) {
      if (timeoutId) {
        clearTimeout(
          timeoutId,
        )
      }

      if (callbackServer) {
        try {
          callbackServer.close()
        } catch {
          // The server may already be closed.
        }
      }

      return {
        ok: false,

        error:
          getErrorMessage(error),
      }
    }
  },
)

function createOAuthResultPage({
  successful,
  title,
  message,
}) {
  const statusColour =
    successful
      ? "#34d399"
      : "#f87171"

  const icon =
    successful
      ? "&#10003;"
      : "!"

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>${title}</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #090909;
            color: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }

          .card {
            width: 100%;
            max-width: 520px;
            padding: 36px;
            text-align: center;
            border: 1px solid #27272a;
            border-radius: 18px;
            background: #151515;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
          }

          .icon {
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            border-radius: 18px;
            background: ${statusColour}18;
            color: ${statusColour};
            font-size: 30px;
            font-weight: bold;
          }

          h1 {
            margin: 24px 0 0;
            font-size: 26px;
          }

          p {
            margin: 14px auto 0;
            max-width: 400px;
            color: #a1a1aa;
            font-size: 15px;
            line-height: 1.7;
          }
        </style>
      </head>

      <body>
        <main class="card">
          <div class="icon">${icon}</div>

          <h1>${title}</h1>

          <p>${message}</p>
        </main>
      </body>
    </html>
  `
}

/*
|--------------------------------------------------------------------------
| Gmail disconnect
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "gmail:disconnect",
  async () => {
    try {
      const tokenRecord =
        await readGmailTokenRecord()

      if (
        tokenRecord?.tokens
      ) {
        try {
          const configuration =
            await readOAuthConfiguration()

          const oauthClient =
            createOAuthClient(
              configuration,

              configuration
                .redirect_uris?.[0] ||
                "http://127.0.0.1",
            )

          oauthClient.setCredentials(
            tokenRecord.tokens,
          )

          await oauthClient
            .revokeCredentials()
        } catch (error) {
          console.warn(
            "Google token revocation was not completed:",
            getErrorMessage(error),
          )
        }
      }

      await removeGmailTokenRecord()

      return {
        ok: true,
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

/*
|--------------------------------------------------------------------------
| Gmail draft creation
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "gmail:create-draft",
  async (
    _event,
    draftDetails = {},
  ) => {
    try {
      const recipientEmail =
        String(
          draftDetails.recipientEmail ||
            "",
        ).trim()

      const emailSubject =
        String(
          draftDetails.emailSubject ||
            "",
        ).trim()

      const emailBody =
        String(
          draftDetails.emailBody ||
            "",
        ).trim()

      const cvId =
        String(
          draftDetails.cvId ||
            "",
        ).trim()

      const coverLetterId =
        String(
          draftDetails.coverLetterId ||
            "",
        ).trim()

      if (
        !isValidEmail(
          recipientEmail,
        )
      ) {
        throw new Error(
          "Enter a valid recipient email address before creating the Gmail draft.",
        )
      }

      if (!emailSubject) {
        throw new Error(
          "Enter an email subject before creating the Gmail draft.",
        )
      }

      if (!emailBody) {
        throw new Error(
          "Enter an email message before creating the Gmail draft.",
        )
      }

      if (!cvId) {
        throw new Error(
          "Select a CV before creating the Gmail draft.",
        )
      }

      const {
        gmail,
        tokenRecord,
      } =
        await getAuthenticatedGmail()

      const resolvedCV =
        await resolveDocument(
          cvId,
        )

      const attachments = [
        {
          filename:
            resolvedCV.document
              .originalName ||
            `${resolvedCV.document.title || "CV"}${path.extname(resolvedCV.documentPath)}`,

          path:
            resolvedCV.documentPath,

          contentType:
            resolvedCV.document
              .mimeType ||
            getMimeType(
              resolvedCV.documentPath,
            ),
        },
      ]

      if (coverLetterId) {
        const resolvedCoverLetter =
          await resolveDocument(
            coverLetterId,
          )

        attachments.push({
          filename:
            resolvedCoverLetter
              .document
              .originalName ||
            `${resolvedCoverLetter.document.title || "Cover Letter"}${path.extname(resolvedCoverLetter.documentPath)}`,

          path:
            resolvedCoverLetter
              .documentPath,

          contentType:
            resolvedCoverLetter
              .document
              .mimeType ||
            getMimeType(
              resolvedCoverLetter
                .documentPath,
            ),
        })
      }

      let gmailAddress =
        tokenRecord.email || ""

      if (!gmailAddress) {
        const profileResponse =
          await gmail.users
            .getProfile({
              userId: "me",
            })

        gmailAddress =
          profileResponse.data
            .emailAddress ||
          ""
      }

      const transport =
        nodemailer.createTransport({
          streamTransport: true,
          newline: "unix",
          buffer: true,
        })

      const generatedMessage =
        await transport.sendMail({
          from:
            gmailAddress ||
            "me",

          to:
            recipientEmail,

          subject:
            emailSubject,

          text:
            emailBody,

          attachments,
        })

      if (
        !generatedMessage.message
      ) {
        throw new Error(
          "BreakVeil could not build the Gmail draft message.",
        )
      }

      const rawMessage =
        encodeBase64Url(
          generatedMessage.message,
        )

      const draftResponse =
        await gmail.users
          .drafts.create({
            userId: "me",

            requestBody: {
              message: {
                raw:
                  rawMessage,
              },
            },
          })

      const createdAt =
        new Date().toISOString()

      return {
        ok: true,

        draftId:
          draftResponse.data.id ||
          "",

        messageId:
          draftResponse.data
            .message?.id ||
          "",

        threadId:
          draftResponse.data
            .message?.threadId ||
          "",

        gmailAddress,

        attachmentNames:
          attachments.map(
            (attachment) =>
              attachment.filename,
          ),

        createdAt,
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

/*
|--------------------------------------------------------------------------
| Open Gmail drafts
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "gmail:open-drafts",
  async () => {
    try {
      await shell.openExternal(
        "https://mail.google.com/mail/u/0/#drafts",
      )

      return {
        ok: true,
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

/*
|--------------------------------------------------------------------------
| Gmail sending controls
|--------------------------------------------------------------------------
*/

registerDocumentPreview({
  ipcMain,
  resolveDocument,
  getErrorMessage,
})
registerGmailSendControl({
  app,
  ipcMain,
  getAuthenticatedGmail,
  getErrorMessage,
})

/*
|--------------------------------------------------------------------------
| Secure job-source credentials
|--------------------------------------------------------------------------
*/

const customJobSources =
  createCustomJobSourceService({
    app,
    getErrorMessage,
  })

customJobSources.registerIpc(
  ipcMain,
)

const directEmployerSources =
  createDirectEmployerSourceService({
    app,
    getErrorMessage,
  })

directEmployerSources.registerIpc(
  ipcMain,
)

registerJobSources({
  app,
  ipcMain,
  getErrorMessage,
  customJobSources,
  directEmployerSources,
})

/*
|--------------------------------------------------------------------------
| Live job-search engine
|--------------------------------------------------------------------------
*/

registerJobSearchEngine({
  app,
  ipcMain,
  getErrorMessage,
  customJobSources,
  directEmployerSources,
})

registerCompanyResearch({
  app,
  ipcMain,
  getErrorMessage,
})

/*
|--------------------------------------------------------------------------
| Windows tray and background mode
|--------------------------------------------------------------------------
*/

const appSettings =
  registerAppSettings({
    app,
    ipcMain,
    getErrorMessage,
  })

registerDataMigrations({
  app,
  ipcMain,
  shell,
  getErrorMessage,
})

registerDataRecovery({
  app,
  ipcMain,
  shell,
  getErrorMessage,
})

registerDataManagement({
  app,
  dialog,
  ipcMain,
  shell,
  getErrorMessage,

  getAppSettings:
    appSettings.getSettings,

  replaceAppSettings:
    appSettings.replaceSettings,

  resetAppSettings:
    appSettings.resetSettings,
})

const backgroundTray =
  registerBackgroundTray({
    app,

    getWindowSettings:
      appSettings.getCachedSettings,
  })

/*
|--------------------------------------------------------------------------
| Electron window
|--------------------------------------------------------------------------
*/

function createWindow({
  startHidden = false,
} = {}) {
  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {
    backgroundTray.showMainWindow()
    return mainWindow
  }

  mainWindow =
    new BrowserWindow({
      width: 1440,
      height: 900,

      minWidth: 1050,
      minHeight: 700,

      title:
        PRODUCT_NAME,

      icon:
        path.join(
          __dirname,
          "assets",
          "breakveil-icon.png",
        ),

      backgroundColor:
        "#090909",

      autoHideMenuBar: true,

      show:
        !startHidden,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.cjs",
          ),

        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,

        backgroundThrottling:
          false,
      },
    })

  backgroundTray.attachWindow(
    mainWindow,
    {
      startHidden,
    },
  )

  mainWindow.webContents
    .setWindowOpenHandler(
      ({ url }) => {
        void openExternalSafely(url)
          .catch(() => {})

        return {
          action: "deny",
        }
      },
    )

  mainWindow.webContents.on(
    "will-navigate",
    (event, url) => {
      let isInternalNavigation =
        false

      try {
        const parsedUrl =
          new URL(url)

        isInternalNavigation =
          !app.isPackaged &&
          parsedUrl.origin ===
            "http://localhost:5173"
      } catch {
        isInternalNavigation =
          false
      }

      if (isInternalNavigation) {
        return
      }

      event.preventDefault()
      void openExternalSafely(url)
        .catch(() => {})
    },
  )

  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(
        __dirname,
        "..",
        "dist",
        "index.html",
      ),
    )
  } else {
    mainWindow.loadURL(
      "http://localhost:5173",
    )
  }

  mainWindow.on(
    "closed",
    () => {
      mainWindow = null
    },
  )

  return mainWindow
}

/*
|--------------------------------------------------------------------------
| Electron lifecycle
|--------------------------------------------------------------------------
*/

app.whenReady().then(
  async () => {
    if (
      process.platform ===
      "win32"
    ) {
      app.setAppUserModelId(
        "com.jobpilot.ai",
      )
    }

    const windowSettings =
      await appSettings
        .getSettings()

    const startHidden =
      process.argv.includes(
        "--background",
      ) ||
      windowSettings.startMinimized ===
        true

    createWindow({
      startHidden,
    })

    await backgroundTray
      .createTray()

    app.on(
      "activate",
      () => {
        if (
          mainWindow &&
          !mainWindow.isDestroyed()
        ) {
          backgroundTray
            .showMainWindow()
        } else {
          createWindow()
        }
      },
    )
  },
)

app.on(
  "window-all-closed",
  () => {
    const settings =
      appSettings
        .getCachedSettings()

    if (
      settings.keepRunningOnClose !==
      true
    ) {
      app.quit()
    }
  },
)

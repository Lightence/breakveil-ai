const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const {
  createEncryptedCredentialsRecord,
  decryptCredentialsRecord,
  parseGoogleCredentials,
} = require("../electron/google-credentials.cjs")

const root = path.resolve(__dirname, "..")

function read(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  )
}

const validCredentials = {
  installed: {
    client_id:
      "example.apps.googleusercontent.com",
    client_secret:
      "example-client-secret",
    auth_uri:
      "https://accounts.google.com/o/oauth2/auth",
    token_uri:
      "https://oauth2.googleapis.com/token",
  },
}

function createSafeStorageMock(
  encryptionAvailable = true,
) {
  return {
    isEncryptionAvailable: () =>
      encryptionAvailable,

    encryptString: (value) =>
      Buffer.from(
        `protected:${value}`,
        "utf8",
      ),

    decryptString: (value) => {
      const contents =
        value.toString("utf8")

      if (
        !contents.startsWith(
          "protected:",
        )
      ) {
        throw new Error(
          "Invalid protected data",
        )
      }

      return contents.slice(
        "protected:".length,
      )
    },
  }
}

test("validates Google OAuth credential downloads", () => {
  const result =
    parseGoogleCredentials(
      JSON.stringify(
        validCredentials,
      ),
    )

  assert.equal(
    result.configuration.client_id,
    validCredentials.installed
      .client_id,
  )

  assert.throws(
    () =>
      parseGoogleCredentials(
        "not-json",
      ),
    /not valid JSON/,
  )

  assert.throws(
    () =>
      parseGoogleCredentials(
        JSON.stringify({
          installed: {
            client_id: "missing-secret",
          },
        }),
      ),
    /client ID and client secret/,
  )
})

test("protects imported credentials before local storage", () => {
  const safeStorage =
    createSafeStorageMock()

  const record =
    createEncryptedCredentialsRecord(
      validCredentials,
      safeStorage,
    )

  assert.equal(record.version, 1)
  assert.doesNotMatch(
    JSON.stringify(record),
    /example-client-secret/,
  )

  const decrypted =
    decryptCredentialsRecord(
      record,
      safeStorage,
    )

  assert.deepEqual(
    decrypted.credentials,
    validCredentials,
  )
})

test("refuses to save credentials without protected storage", () => {
  assert.throws(
    () =>
      createEncryptedCredentialsRecord(
        validCredentials,
        createSafeStorageMock(false),
      ),
    /protected storage is unavailable/,
  )
})

test("installed app exposes the credentials import flow", () => {
  const main = read("electron/main.cjs")
  const preload = read(
    "electron/preload.cjs",
  )
  const automation = read(
    "src/pages/Automation.jsx",
  )

  assert.match(
    main,
    /gmail:import-credentials/,
  )
  assert.match(
    main,
    /credentials\.enc\.json/,
  )
  assert.match(
    preload,
    /importCredentials/,
  )
  assert.match(
    automation,
    /Import Google Credentials/,
  )
})

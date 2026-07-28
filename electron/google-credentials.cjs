const MAX_CREDENTIALS_BYTES =
  128 * 1024

function parseGoogleCredentials(
  contents,
) {
  if (
    typeof contents !== "string" ||
    Buffer.byteLength(
      contents,
      "utf8",
    ) > MAX_CREDENTIALS_BYTES
  ) {
    throw new Error(
      "The selected Google credentials file is too large or unreadable.",
    )
  }

  let credentials

  try {
    credentials = JSON.parse(
      contents,
    )
  } catch {
    throw new Error(
      "The selected file is not valid JSON.",
    )
  }

  const configuration =
    credentials?.installed ||
    credentials?.web

  if (
    !configuration ||
    typeof configuration !==
      "object" ||
    typeof configuration.client_id !==
      "string" ||
    !configuration.client_id.trim() ||
    typeof configuration.client_secret !==
      "string" ||
    !configuration.client_secret.trim()
  ) {
    throw new Error(
      "The selected file does not contain a valid Google OAuth client ID and client secret.",
    )
  }

  return {
    credentials,
    configuration,
  }
}

function createEncryptedCredentialsRecord(
  credentials,
  safeStorage,
) {
  if (
    !safeStorage
      ?.isEncryptionAvailable?.()
  ) {
    throw new Error(
      "Windows protected storage is unavailable, so BreakVeil cannot save Google credentials safely.",
    )
  }

  const encryptedCredentials =
    safeStorage
      .encryptString(
        JSON.stringify(
          credentials,
        ),
      )
      .toString("base64")

  return {
    version: 1,
    encryptedCredentials,
  }
}

function decryptCredentialsRecord(
  record,
  safeStorage,
) {
  if (
    record?.version !== 1 ||
    typeof record
      .encryptedCredentials !==
      "string" ||
    !record.encryptedCredentials
  ) {
    throw new Error(
      "The saved Google credentials are not in a recognised format. Import the file again.",
    )
  }

  if (
    !safeStorage
      ?.isEncryptionAvailable?.()
  ) {
    throw new Error(
      "Windows protected storage is unavailable, so the saved Google credentials cannot be opened.",
    )
  }

  let contents

  try {
    contents = safeStorage
      .decryptString(
        Buffer.from(
          record
            .encryptedCredentials,
          "base64",
        ),
      )
  } catch {
    throw new Error(
      "The saved Google credentials could not be decrypted. Import the file again.",
    )
  }

  return parseGoogleCredentials(
    contents,
  )
}

module.exports = {
  MAX_CREDENTIALS_BYTES,
  createEncryptedCredentialsRecord,
  decryptCredentialsRecord,
  parseGoogleCredentials,
}

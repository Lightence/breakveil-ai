const {
  safeStorage,
} = require("electron")

const fs = require("fs")
const path = require("path")

const fileSystem = fs.promises

const {
  getBuiltInJobProvider,
  getBuiltInJobProviderIds,
  getBuiltInJobProviders,
  getSourceNamesMap,
  providerRequiresCredentials,
} = require("./job-provider-registry.cjs")

const SOURCE_NAMES =
  getSourceNamesMap()

const DEFAULT_RECORD = {
  version: 1,
  sources: {},
}

const TEST_TIMEOUT =
  20 * 1000

function registerJobSources({
  app,
  ipcMain,
  getErrorMessage,
  customJobSources,
  directEmployerSources,
}) {
  /*
  |--------------------------------------------------------------------------
  | Storage paths
  |--------------------------------------------------------------------------
  */

  function getStorageFolder() {
    return path.join(
      app.getPath("userData"),
      "job-sources",
    )
  }

  function getCredentialsPath() {
    return path.join(
      getStorageFolder(),
      "credentials.json",
    )
  }

  function getCachePath() {
    return path.join(
      getStorageFolder(),
      "search-cache.json",
    )
  }

  function getProviderFeedCachePath() {
    return path.join(
      getStorageFolder(),
      "provider-feed-cache.json",
    )
  }

  function getHealthPath() {
    return path.join(
      getStorageFolder(),
      "source-health.json",
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

  /*
  |--------------------------------------------------------------------------
  | General helpers
  |--------------------------------------------------------------------------
  */

  function friendlyError(error) {
    if (
      typeof getErrorMessage ===
      "function"
    ) {
      return getErrorMessage(error)
    }

    return (
      error?.message ||
      "An unknown error occurred."
    )
  }

  function normaliseSource(
    source,
  ) {
    const safeSource =
      String(source || "")
        .trim()
        .toLowerCase()

    if (
      !getBuiltInJobProviderIds()
        .includes(
          safeSource,
        )
    ) {
      throw new Error(
        "The selected job source is not supported.",
      )
    }

    return safeSource
  }

  function getSourceName(
    source,
  ) {
    return (
      SOURCE_NAMES[source] ||
      source
    )
  }

  function cleanCredential(
    value,
  ) {
    return String(value || "")
      .trim()
  }

  /*
  |--------------------------------------------------------------------------
  | JSON storage
  |--------------------------------------------------------------------------
  */

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

  async function readCredentialRecord() {
    const record =
      await readJsonFile(
        getCredentialsPath(),
        DEFAULT_RECORD,
      )

    if (
      !record ||
      typeof record !== "object"
    ) {
      return {
        ...DEFAULT_RECORD,
      }
    }

    return {
      version:
        record.version || 1,

      sources:
        record.sources &&
        typeof record.sources ===
          "object"
          ? record.sources
          : {},
    }
  }

  async function writeCredentialRecord(
    record,
  ) {
    await writeJsonFile(
      getCredentialsPath(),
      record,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Encryption
  |--------------------------------------------------------------------------
  */

  async function getEncryptionMode() {
    if (
      typeof safeStorage
        .isAsyncEncryptionAvailable ===
      "function"
    ) {
      try {
        const available =
          await safeStorage
            .isAsyncEncryptionAvailable()

        if (available) {
          return "async"
        }
      } catch {
        // Fall back to the synchronous API.
      }
    }

    if (
      safeStorage
        .isEncryptionAvailable()
    ) {
      return "sync"
    }

    return ""
  }

  async function encryptionIsAvailable() {
    return Boolean(
      await getEncryptionMode(),
    )
  }

  async function encryptCredential(
    plainText,
  ) {
    const safeValue =
      cleanCredential(plainText)

    if (!safeValue) {
      throw new Error(
        "An empty credential cannot be encrypted.",
      )
    }

    const encryptionMode =
      await getEncryptionMode()

    if (!encryptionMode) {
      throw new Error(
        "Secure credential encryption is unavailable on this computer.",
      )
    }

    if (
      encryptionMode === "async"
    ) {
      const encrypted =
        await safeStorage
          .encryptStringAsync(
            safeValue,
          )

      return {
        mode: "async",
        data:
          encrypted.toString(
            "base64",
          ),
      }
    }

    const encrypted =
      safeStorage.encryptString(
        safeValue,
      )

    return {
      mode: "sync",
      data:
        encrypted.toString(
          "base64",
        ),
    }
  }

  async function decryptCredential(
    encryptedRecord,
  ) {
    if (
      !encryptedRecord?.data
    ) {
      return ""
    }

    const encryptedBuffer =
      Buffer.from(
        encryptedRecord.data,
        "base64",
      )

    if (
      encryptedRecord.mode ===
        "async" &&
      typeof safeStorage
        .decryptStringAsync ===
        "function"
    ) {
      const decrypted =
        await safeStorage
          .decryptStringAsync(
            encryptedBuffer,
          )

      return decrypted.result || ""
    }

    if (
      !safeStorage
        .isEncryptionAvailable()
    ) {
      throw new Error(
        "Secure credential decryption is unavailable.",
      )
    }

    return safeStorage.decryptString(
      encryptedBuffer,
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Source credential helpers
  |--------------------------------------------------------------------------
  */

  function sourceIsConfigured(
    source,
    sourceRecord,
  ) {
    const provider =
      getBuiltInJobProvider(
        source,
      )

    if (!provider) {
      return false
    }

    if (
      !providerRequiresCredentials(
        source,
      )
    ) {
      return true
    }

    if (
      source === "reed" ||
      source === "jooble"
    ) {
      return Boolean(
        sourceRecord
          ?.credentials
          ?.apiKey?.data,
      )
    }

    if (source === "adzuna") {
      return Boolean(
        sourceRecord
          ?.credentials
          ?.appId?.data &&
        sourceRecord
          ?.credentials
          ?.appKey?.data,
      )
    }

    return false
  }

  async function decryptSourceCredentials(
    source,
    sourceRecord,
  ) {
    if (
      !sourceIsConfigured(
        source,
        sourceRecord,
      )
    ) {
      throw new Error(
        `${getSourceName(source)} has not been configured.`,
      )
    }

    if (
      !providerRequiresCredentials(
        source,
      )
    ) {
      return {}
    }

    if (
      source === "reed" ||
      source === "jooble"
    ) {
      return {
        apiKey:
          await decryptCredential(
            sourceRecord
              .credentials
              .apiKey,
          ),
      }
    }

    return {
      appId:
        await decryptCredential(
          sourceRecord
            .credentials
            .appId,
        ),

      appKey:
        await decryptCredential(
          sourceRecord
            .credentials
            .appKey,
        ),
    }
  }

  async function buildSourceStatus(
    source,
    record,
    healthRecord,
  ) {
    const sourceRecord =
      record.sources[
        source
      ] ||
      null

    const health =
      healthRecord
        ?.sources
        ?.[source] ||
      null

    const provider =
      getBuiltInJobProvider(
        source,
      )

    return {
      source,

      name:
        getSourceName(
          source,
        ),

      connectionMode:
        provider?.connectionMode ||
        "credential",

      removable:
        provider?.removable !==
        false,

      autoDiscoveryDefault:
        provider?.autoDiscoveryDefault ===
        true,

      descriptionSource:
        provider?.descriptionSource ||
        "",

      capabilities: {
        ...(provider?.capabilities ||
          {}),
      },

      configured:
        sourceIsConfigured(
          source,
          sourceRecord,
        ),

      savedAt:
        sourceRecord
          ?.savedAt ||
        "",

      lastTest:
        sourceRecord
          ?.lastTest ||
        null,

      health:
        health
          ? {
              status:
                health.status ||
                "unknown",

              lastAttemptAt:
                health.lastAttemptAt ||
                "",

              lastSuccessAt:
                health.lastSuccessAt ||
                "",

              lastFailureAt:
                health.lastFailureAt ||
                "",

              consecutiveFailures:
                Number(
                  health.consecutiveFailures ||
                  0,
                ),

              failureType:
                health.failureType ||
                "",

              retryable:
                health.retryable !==
                false,

              retryAt:
                health.retryAt ||
                "",

              statusCode:
                Number(
                  health.statusCode ||
                  0,
                ),

              message:
                health.message ||
                "",

              returned:
                Number(
                  health.returned ||
                  0,
                ),

              available:
                Number(
                  health.available ||
                  0,
                ),
            }
          : null,
    }
  }

  async function getCacheSummary() {
    const cache =
      await readJsonFile(
        getCachePath(),
        {
          version:
            2,

          entries:
            [],
        },
      )

    const now =
      Date.now()

    const entries =
      Array.isArray(
        cache?.entries,
      )
        ? cache.entries
        : []

    let freshCount =
      0

    let staleCount =
      0

    let newestCreatedAt =
      ""

    for (
      const entry
      of entries
    ) {
      const createdAt =
        new Date(
          entry?.createdAt ||
          0,
        ).getTime()

      const expiresAt =
        new Date(
          entry?.expiresAt ||
          0,
        ).getTime()

      const staleUntil =
        new Date(
          entry?.staleUntil ||
          0,
        ).getTime()

      if (
        Number.isFinite(
          createdAt,
        ) &&
        (
          !newestCreatedAt ||
          createdAt >
            new Date(
              newestCreatedAt,
            ).getTime()
        )
      ) {
        newestCreatedAt =
          new Date(
            createdAt,
          ).toISOString()
      }

      if (
        entry.freshEligible !==
          false &&
        Number.isFinite(
          expiresAt,
        ) &&
        expiresAt >
          now
      ) {
        freshCount +=
          1
      } else if (
        Number.isFinite(
          staleUntil,
        ) &&
        staleUntil >
          now
      ) {
        staleCount +=
          1
      }
    }

    return {
      entryCount:
        entries.length,

      freshCount,

      staleCount,

      newestCreatedAt,
    }
  }

  async function buildStatus() {
    const [
      record,
      healthRecord,
      cacheSummary,
      encryptionAvailable,
    ] =
      await Promise.all([
        readCredentialRecord(),

        readJsonFile(
          getHealthPath(),
          {
            version:
              1,

            sources:
              {},
          },
        ),

        getCacheSummary(),

        encryptionIsAvailable(),
      ])

    const providerStatuses =
      await Promise.all(
        getBuiltInJobProviders()
          .map(
            (provider) =>
              buildSourceStatus(
                provider.id,
                record,
                healthRecord,
              ),
          ),
      )

    const customStatuses =
      customJobSources
        ? await customJobSources.getStatuses()
        : {}

    const directEmployerStatuses =
      directEmployerSources
        ? await directEmployerSources.getStatuses()
        : {}

    const dynamicStatuses = {
      ...customStatuses,
      ...directEmployerStatuses,
    }

    for (
      const dynamicStatus
      of Object.values(
        dynamicStatuses,
      )
    ) {
      const health =
        healthRecord
          ?.sources
          ?.[dynamicStatus.source] ||
        null

      if (health) {
        dynamicStatus.health = {
          status:
            health.status ||
            "unknown",
          lastAttemptAt:
            health.lastAttemptAt ||
            "",
          lastSuccessAt:
            health.lastSuccessAt ||
            "",
          lastFailureAt:
            health.lastFailureAt ||
            "",
          consecutiveFailures:
            Number(
              health.consecutiveFailures ||
              0,
            ),
          failureType:
            health.failureType ||
            "",
          retryable:
            health.retryable !==
            false,
          retryAt:
            health.retryAt ||
            "",
          statusCode:
            Number(
              health.statusCode ||
              0,
            ),
          message:
            health.message ||
            "",
          returned:
            Number(
              health.returned ||
              0,
            ),
          available:
            Number(
              health.available ||
              0,
            ),
        }
      }
    }

    const sources = {
      ...providerStatuses.reduce(
        (sourceMap, sourceStatus) => {
          sourceMap[
            sourceStatus.source
          ] =
            sourceStatus

          return sourceMap
        },
        {},
      ),
      ...dynamicStatuses,
    }

    const configuredSources =
      Object.values(
        sources,
      ).filter(
        (source) =>
          source.configured,
      )

    const unhealthySources =
      configuredSources.filter(
        (source) =>
          source.health &&
          source.health.status !==
            "available",
      )

    return {
      encryptionAvailable,

      securityLabel:
        process.platform ===
        "win32"
          ? "Windows DPAPI"
          : "Operating-system encryption",

      sources,

      cacheEntryCount:
        cacheSummary.entryCount,

      cacheSummary,

      searchHealth: {
        state:
          unhealthySources.length ===
            0
            ? "healthy"
            : unhealthySources.length <
                configuredSources.length
              ? "degraded"
              : "unavailable",

        configuredCount:
          configuredSources.length,

        unhealthyCount:
          unhealthySources.length,

        updatedAt:
          healthRecord
            ?.updatedAt ||
          "",
      },
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Network helper
  |--------------------------------------------------------------------------
  */

  async function fetchJson(
    requestUrl,
    options,
    sourceName,
  ) {
    const controller =
      new AbortController()

    const timeoutId =
      setTimeout(
        () => {
          controller.abort()
        },
        TEST_TIMEOUT,
      )

    try {
      const response =
        await fetch(
          requestUrl,
          {
            ...options,

            signal:
              controller.signal,
          },
        )

      const responseText =
        await response.text()

      let responseData = {}

      if (responseText) {
        try {
          responseData =
            JSON.parse(
              responseText,
            )
        } catch {
          responseData = {}
        }
      }

      if (!response.ok) {
        const responseMessage =
          responseData?.error ||
          responseData?.message ||
          ""

        throw new Error(
          response.status === 401 ||
          response.status === 403
            ? `${sourceName} rejected the saved credentials.`
            : `${sourceName} returned error ${response.status}${responseMessage ? `: ${responseMessage}` : "."}`,
        )
      }

      return responseData
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        throw new Error(
          `${sourceName} did not respond within 20 seconds.`,
        )
      }

      throw error
    } finally {
      clearTimeout(
        timeoutId,
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Provider connection tests
  |--------------------------------------------------------------------------
  */

  async function testReed(
    credentials,
  ) {
    const parameters =
      new URLSearchParams({
        keywords:
          "administrator",

        resultsToTake:
          "1",
      })

    const authentication =
      Buffer.from(
        `${credentials.apiKey}:`,
      ).toString(
        "base64",
      )

    const result =
      await fetchJson(
        `https://www.reed.co.uk/api/1.0/search?${parameters.toString()}`,

        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Basic ${authentication}`,
          },
        },

        "Reed",
      )

    const resultCount =
      Array.isArray(
        result?.results,
      )
        ? result.results.length
        : 0

    return {
      ok: true,

      message:
        `Reed connected successfully. Test results returned: ${resultCount}.`,
    }
  }

  async function testAdzuna(
    credentials,
  ) {
    const requestUrl =
      new URL(
        "https://api.adzuna.com/v1/api/jobs/gb/search/1",
      )

    requestUrl.searchParams.set(
      "app_id",
      credentials.appId,
    )

    requestUrl.searchParams.set(
      "app_key",
      credentials.appKey,
    )

    requestUrl.searchParams.set(
      "results_per_page",
      "1",
    )

    requestUrl.searchParams.set(
      "what",
      "administrator",
    )

    requestUrl.searchParams.set(
      "content-type",
      "application/json",
    )

    const result =
      await fetchJson(
        requestUrl.toString(),

        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        },

        "Adzuna",
      )

    const resultCount =
      Array.isArray(
        result?.results,
      )
        ? result.results.length
        : 0

    return {
      ok: true,

      message:
        `Adzuna connected successfully. Test results returned: ${resultCount}.`,
    }
  }

  async function testJooble(
    credentials,
  ) {
    const result =
      await fetchJson(
        `https://jooble.org/api/${encodeURIComponent(
          credentials.apiKey,
        )}`,

        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              keywords:
                "administrator",

              location:
                "United Kingdom",

              page:
                "1",

              ResultOnPage:
                "1",
            }),
        },

        "Jooble",
      )

    const resultCount =
      Array.isArray(
        result?.jobs,
      )
        ? result.jobs.length
        : 0

    return {
      ok:
        true,

      message:
        `Jooble connected successfully. Test results returned: ${resultCount}.`,
    }
  }

  async function testArbeitnow() {
    const requestUrl =
      new URL(
        "https://www.arbeitnow.com/api/job-board-api",
      )

    requestUrl.searchParams.set(
      "q",
      "administrator",
    )

    requestUrl.searchParams.set(
      "page",
      "1",
    )

    const result =
      await fetchJson(
        requestUrl.toString(),

        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        },

        "Arbeitnow",
      )

    const resultCount =
      Array.isArray(
        result?.data,
      )
        ? result.data.length
        : 0

    return {
      ok: true,

      message:
        `Arbeitnow is available. Test results returned: ${resultCount}. No API key is required.`,
    }
  }

  async function testJobicy() {
    const requestUrl =
      new URL(
        "https://jobicy.com/api/v2/remote-jobs",
      )

    requestUrl.searchParams.set(
      "count",
      "1",
    )

    const result =
      await fetchJson(
        requestUrl.toString(),

        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        },

        "Jobicy",
      )

    const resultCount =
      Array.isArray(
        result?.jobs,
      )
        ? result.jobs.length
        : 0

    return {
      ok: true,

      message:
        `Jobicy is available. Test results returned: ${resultCount}. No API key is required.`,
    }
  }

  async function testRemotive() {
    const requestUrl =
      new URL(
        "https://remotive.com/api/remote-jobs",
      )

    requestUrl.searchParams.set(
      "limit",
      "1",
    )

    const result =
      await fetchJson(
        requestUrl.toString(),

        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        },

        "Remotive",
      )

    const resultCount =
      Array.isArray(
        result?.jobs,
      )
        ? result.jobs.length
        : 0

    return {
      ok: true,

      message:
        `Remotive is available. Test results returned: ${resultCount}. No API key is required.`,
    }
  }

  async function runConnectionTest(
    source,
    credentials,
  ) {
    if (source === "reed") {
      return testReed(
        credentials,
      )
    }

    if (source === "adzuna") {
      return testAdzuna(
        credentials,
      )
    }

    if (source === "jooble") {
      return testJooble(
        credentials,
      )
    }

    if (source === "arbeitnow") {
      return testArbeitnow()
    }

    if (source === "jobicy") {
      return testJobicy()
    }

    if (source === "remotive") {
      return testRemotive()
    }

    throw new Error(
      "The selected job source is not supported.",
    )
  }

  async function testStoredSource(
    source,
  ) {
    const record =
      await readCredentialRecord()

    const sourceRecord =
      record.sources[source]

    if (
      !sourceIsConfigured(
        source,
        sourceRecord,
      )
    ) {
      throw new Error(
        `${getSourceName(source)} has not been configured.`,
      )
    }

    const testedAt =
      new Date().toISOString()

    let testResult

    try {
      const credentials =
        await decryptSourceCredentials(
          source,
          sourceRecord,
        )

      const connectionResult =
        await runConnectionTest(
          source,
          credentials,
        )

      testResult = {
        ok: true,
        testedAt,

        message:
          connectionResult.message,
      }
    } catch (error) {
      testResult = {
        ok: false,
        testedAt,

        error:
          friendlyError(error),
      }
    }

    const latestRecord =
      await readCredentialRecord()

    latestRecord.sources[source] = {
      ...(latestRecord
        .sources[source] ||
        sourceRecord),

      lastTest:
        testResult,
    }

    await writeCredentialRecord(
      latestRecord,
    )

    return testResult
  }

  /*
  |--------------------------------------------------------------------------
  | Saving credentials
  |--------------------------------------------------------------------------
  */

  async function saveReedCredentials(
    existingCredentials,
    payload,
  ) {
    const apiKey =
      cleanCredential(
        payload.apiKey,
      ) ||
      existingCredentials.apiKey

    if (!apiKey) {
      throw new Error(
        "Enter your Reed API key.",
      )
    }

    return {
      apiKey,
    }
  }

  async function saveAdzunaCredentials(
    existingCredentials,
    payload,
  ) {
    const appId =
      cleanCredential(
        payload.appId,
      ) ||
      existingCredentials.appId

    const appKey =
      cleanCredential(
        payload.appKey,
      ) ||
      existingCredentials.appKey

    if (!appId) {
      throw new Error(
        "Enter your Adzuna Application ID.",
      )
    }

    if (!appKey) {
      throw new Error(
        "Enter your Adzuna Application Key.",
      )
    }

    return {
      appId,
      appKey,
    }
  }

  async function saveJoobleCredentials(
    existingCredentials,
    payload,
  ) {
    const apiKey =
      cleanCredential(
        payload.apiKey,
      ) ||
      existingCredentials.apiKey

    if (!apiKey) {
      throw new Error(
        "Enter your Jooble API key.",
      )
    }

    return {
      apiKey,
    }
  }

  async function saveSourceCredentials(
    source,
    payload,
  ) {
    if (
      !providerRequiresCredentials(
        source,
      )
    ) {
      throw new Error(
        `${getSourceName(source)} is a public source and does not require credentials.`,
      )
    }

    if (
      !(await encryptionIsAvailable())
    ) {
      throw new Error(
        "Secure credential encryption is unavailable.",
      )
    }

    const record =
      await readCredentialRecord()

    const existingRecord =
      record.sources[source]

    let existingCredentials = {}

    if (
      sourceIsConfigured(
        source,
        existingRecord,
      )
    ) {
      existingCredentials =
        await decryptSourceCredentials(
          source,
          existingRecord,
        )
    }

    const credentials =
      source === "reed"
        ? await saveReedCredentials(
            existingCredentials,
            payload,
          )
        : source === "jooble"
          ? await saveJoobleCredentials(
              existingCredentials,
              payload,
            )
          : await saveAdzunaCredentials(
              existingCredentials,
              payload,
            )

    const encryptedCredentials = {}

    for (
      const [
        field,
        value,
      ] of Object.entries(
        credentials,
      )
    ) {
      encryptedCredentials[field] =
        await encryptCredential(
          value,
        )
    }

    const now =
      new Date().toISOString()

    record.sources[source] = {
      credentials:
        encryptedCredentials,

      savedAt: now,

      lastTest:
        existingRecord?.lastTest ||
        null,
    }

    await writeCredentialRecord(
      record,
    )

    /*
     * Credentials changed, so remove any cached searches
     * created with the previous connection.
     */
    for (
      const cachePath
      of [
        getCachePath(),
        getProviderFeedCachePath(),
      ]
    ) {
      try {
        await fileSystem.unlink(
          cachePath,
        )
      } catch (error) {
        if (
          error?.code !== "ENOENT"
        ) {
          throw error
        }
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | IPC handlers
  |--------------------------------------------------------------------------
  */

  ipcMain.handle(
    "job-sources:get-status",
    async () => {
      try {
        return {
          ok: true,
          ...(await buildStatus()),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            friendlyError(error),
        }
      }
    },
  )

  ipcMain.handle(
    "job-sources:save",
    async (
      _event,
      payload = {},
    ) => {
      try {
        const source =
          normaliseSource(
            payload.source,
          )

        await saveSourceCredentials(
          source,
          payload,
        )

        let testResult = null

        if (
          payload.test !== false
        ) {
          testResult =
            await testStoredSource(
              source,
            )
        }

        return {
          ok: true,
          saved: true,

          test:
            testResult,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            friendlyError(error),
        }
      }
    },
  )

  ipcMain.handle(
    "job-sources:test",
    async (
      _event,
      sourceValue,
    ) => {
      try {
        const source =
          normaliseSource(
            sourceValue,
          )

        const testResult =
          await testStoredSource(
            source,
          )

        return {
          ok:
            testResult.ok,

          test:
            testResult,

          error:
            testResult.error ||
            "",

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            friendlyError(error),

          status:
            await buildStatus(),
        }
      }
    },
  )

  ipcMain.handle(
    "job-sources:remove",
    async (
      _event,
      sourceValue,
    ) => {
      try {
        const source =
          normaliseSource(
            sourceValue,
          )

        const provider =
          getBuiltInJobProvider(
            source,
          )

        if (
          provider?.removable ===
          false
        ) {
          throw new Error(
            `${getSourceName(source)} is a built-in public source and has no stored credentials to remove.`,
          )
        }

        const record =
          await readCredentialRecord()

        delete record.sources[source]

        await writeCredentialRecord(
          record,
        )

        for (
          const cachePath
          of [
            getCachePath(),
            getProviderFeedCachePath(),
          ]
        ) {
          try {
            await fileSystem.unlink(
              cachePath,
            )
          } catch (error) {
            if (
              error?.code !== "ENOENT"
            ) {
              throw error
            }
          }
        }

        return {
          ok: true,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            friendlyError(error),
        }
      }
    },
  )

  ipcMain.handle(
    "job-sources:clear-cache",
    async () => {
      try {
        for (
          const cachePath
          of [
            getCachePath(),
            getProviderFeedCachePath(),
          ]
        ) {
          try {
            await fileSystem.unlink(
              cachePath,
            )
          } catch (error) {
            if (
              error?.code !== "ENOENT"
            ) {
              throw error
            }
          }
        }

        return {
          ok: true,

          status:
            await buildStatus(),
        }
      } catch (error) {
        return {
          ok: false,

          error:
            friendlyError(error),
        }
      }
    },
  )
}

module.exports = {
  registerJobSources,
}

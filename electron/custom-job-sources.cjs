const { randomUUID } = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const {
  assertTrustedIpcSender,
  cleanSingleLine,
  parseHttpsUrl,
  secureFetchJson,
  validateFieldPath,
  validateHeaderName,
  validateParameterName,
} = require("./custom-job-source-security.cjs")

const fileSystem = fs.promises

const MAX_CONNECTORS = 10
const MAX_RESULTS_PER_REQUEST = 50
const CUSTOM_SOURCE_PREFIX = "custom:"

const AUTHENTICATION_TYPES = new Set([
  "none",
  "bearer",
  "header",
  "query",
])

const REQUEST_METHODS = new Set([
  "GET",
  "POST",
])

const FIELD_ALIASES = {
  id: [
    "id",
    "jobid",
    "job_id",
    "jobkey",
    "job_key",
    "uuid",
    "slug",
    "reference",
  ],
  title: [
    "title",
    "jobtitle",
    "job_title",
    "position",
    "positiontitle",
    "position_title",
    "vacancy",
    "vacancyname",
    "vacancy_name",
    "role",
    "name",
  ],
  company: [
    "company",
    "companyname",
    "company_name",
    "employer",
    "employername",
    "employer_name",
    "organisation",
    "organization",
  ],
  location: [
    "location",
    "joblocation",
    "job_location",
    "candidate_required_location",
    "city",
    "region",
    "country",
  ],
  description: [
    "description",
    "jobdescription",
    "job_description",
    "content",
    "body",
    "details",
    "summary",
    "snippet",
  ],
  url: [
    "url",
    "joburl",
    "job_url",
    "applyurl",
    "apply_url",
    "applicationurl",
    "application_url",
    "redirect_url",
    "link",
  ],
  postedAt: [
    "postedat",
    "posted_at",
    "dateposted",
    "date_posted",
    "published",
    "publishedat",
    "published_at",
    "publication_date",
    "createdat",
    "created_at",
    "pubdate",
  ],
  salaryText: [
    "salary",
    "salarytext",
    "salary_text",
    "salaryrange",
    "salary_range",
    "compensation",
    "pay",
  ],
  remote: [
    "remote",
    "isremote",
    "is_remote",
    "remoteallowed",
    "remote_allowed",
    "workfromhome",
    "work_from_home",
  ],
  contractType: [
    "jobtype",
    "job_type",
    "employmenttype",
    "employment_type",
    "contracttype",
    "contract_type",
    "type",
  ],
}

const EMPTY_MAPPING = {
  id: "",
  title: "",
  company: "",
  location: "",
  description: "",
  url: "",
  postedAt: "",
  salaryText: "",
  remote: "",
  contractType: "",
}

const OPTIONAL_SEARCH_PARAMETERS = [
  {
    payloadField: "keywordParameter",
    connectorField: "keywords",
    label: "Keyword parameter name",
  },
  {
    payloadField: "locationParameter",
    connectorField: "location",
    label: "Location parameter name",
  },
  {
    payloadField: "pageParameter",
    connectorField: "page",
    label: "Page parameter name",
  },
  {
    payloadField: "limitParameter",
    connectorField: "limit",
    label: "Result-limit parameter name",
  },
]

function normaliseOptionalSearchParameters(payload = {}) {
  return Object.fromEntries(
    OPTIONAL_SEARCH_PARAMETERS.map(
      ({
        payloadField,
        connectorField,
        label,
      }) => {
        const suppliedValue =
          Object.prototype.hasOwnProperty.call(
            payload,
            payloadField,
          )
            ? payload[payloadField]
            : ""

        return [
          connectorField,
          validateParameterName(
            suppliedValue ?? "",
            label,
          ),
        ]
      },
    ),
  )
}

function createCapabilityProbeQuery() {
  /*
   * Capability detection must not invent filter values.
   * Some APIs accept only predefined taxonomy slugs for
   * location or category parameters, so a generic value
   * such as "United Kingdom" can be rejected even when
   * the connector mapping itself is correct.
   *
   * Start with an unfiltered, tiny request. The provider
   * may still receive a mapped page or result-limit value,
   * but optional keyword and location filters remain absent.
   */
  return {
    keywords: "",
    location: "",
    page: 1,
    resultsPerSource: 3,
  }
}

function findRejectedSearchParameter(errorValue) {
  const message = String(errorValue || "")
  const quotedMatch = message.match(
    /unexpected\s+parameter\s*['"]([^'"]+)['"]/i,
  )
  const plainMatch = message.match(
    /unexpected\s+parameter\s+([a-z0-9_.-]+)/i,
  )

  return cleanSingleLine(
    quotedMatch?.[1] ||
      plainMatch?.[1] ||
      "",
    128,
  )
}

function removeRejectedSearchParameter(
  searchParameters = {},
  errorValue = "",
) {
  const rejectedParameter =
    findRejectedSearchParameter(
      errorValue,
    )
  const nextSearchParameters = {
    keywords: String(
      searchParameters.keywords ||
        "",
    ),
    location: String(
      searchParameters.location ||
        "",
    ),
    page: String(
      searchParameters.page ||
        "",
    ),
    limit: String(
      searchParameters.limit ||
        "",
    ),
  }

  if (!rejectedParameter) {
    return {
      searchParameters:
        nextSearchParameters,
      rejectedParameter:
        "",
      removedField:
        "",
    }
  }

  const rejectedToken =
    rejectedParameter.toLowerCase()
  const removedEntry =
    Object.entries(
      nextSearchParameters,
    ).find(
      ([, parameterName]) =>
        parameterName
          .toLowerCase() ===
        rejectedToken,
    )

  if (!removedEntry) {
    return {
      searchParameters:
        nextSearchParameters,
      rejectedParameter,
      removedField:
        "",
    }
  }

  const [removedField] =
    removedEntry

  nextSearchParameters[
    removedField
  ] = ""

  return {
    searchParameters:
      nextSearchParameters,
    rejectedParameter,
    removedField,
  }
}

function findRejectedSearchParameterValue(errorValue) {
  const message = String(errorValue || "")
  const patterns = [
    /invalid\s+['"]([^'"]+)['"]\s+value/i,
    /invalid\s+([a-z0-9_.-]+)\s+value/i,
    /invalid\s+value\s+for\s+['"]?([a-z0-9_.-]+)/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)

    if (match?.[1]) {
      return cleanSingleLine(
        match[1],
        128,
      )
    }
  }

  return ""
}

function findMappedSearchFieldWithRejectedValue(
  searchParameters = {},
  errorValue = "",
) {
  const rejectedParameter =
    findRejectedSearchParameterValue(
      errorValue,
    )

  if (!rejectedParameter) {
    return {
      rejectedParameter: "",
      rejectedField: "",
    }
  }

  const rejectedToken =
    rejectedParameter.toLowerCase()
  const rejectedEntry =
    Object.entries(
      searchParameters || {},
    ).find(
      ([, parameterName]) =>
        String(parameterName || "")
          .toLowerCase() ===
        rejectedToken,
    )

  return {
    rejectedParameter,
    rejectedField:
      rejectedEntry?.[0] || "",
  }
}

function buildStrictLocationSkipNotice(
  sourceName,
  location,
) {
  const safeSourceName =
    cleanSingleLine(
      sourceName || "Custom job source",
      160,
    ) || "Custom job source"
  const safeLocation =
    cleanSingleLine(
      location,
      240,
    )

  return `Skipped for “${safeLocation}”. ${safeSourceName}'s location filter accepts predefined provider values rather than ordinary place names. Use a supported region code from that API's documentation or leave Location blank.`
}

function getPathValue(value, fieldPath) {
  /*
   * A blank mapping means the optional field is not mapped. Returning the
   * whole untrusted job object made blank Location/Remote mappings flow into
   * text conversion. Sanitised API objects intentionally have no prototype,
   * so that conversion throws “Cannot convert object to primitive value”.
   */
  if (!fieldPath) {
    return undefined
  }

  const parts =
    String(fieldPath)
      .split(".")

  if (
    parts.some(
      (part) =>
        [
          "__proto__",
          "constructor",
          "prototype",
        ].includes(
          part.toLowerCase(),
        ),
    )
  ) {
    return undefined
  }

  return parts.reduce(
    (current, key) =>
      current &&
      typeof current ===
        "object" &&
      Object.prototype.hasOwnProperty.call(
        current,
        key,
      )
        ? current[key]
        : undefined,
    value,
  )
}

function isCustomSourceId(value) {
  return /^custom:[0-9a-f-]{36}$/i.test(
    String(value || "").trim(),
  )
}

function createCustomJobSourceService({
  app,
  getErrorMessage,
}) {
  const {
    safeStorage,
  } = require("electron")

  const requestLocks = new Map()

  function friendlyError(error) {
    return typeof getErrorMessage === "function"
      ? getErrorMessage(error)
      : error?.message || "An unknown error occurred."
  }

  function getStorageFolder() {
    return path.join(
      app.getPath("userData"),
      "job-sources",
    )
  }

  function getStoragePath() {
    return path.join(
      getStorageFolder(),
      "custom-connectors.json",
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

  async function readRecord() {
    await ensureStorage()

    try {
      const parsed = JSON.parse(
        await fileSystem.readFile(
          getStoragePath(),
          "utf8",
        ),
      )

      const connectors =
        Array.isArray(parsed?.connectors)
          ? parsed.connectors.flatMap(
              (connector) => {
                try {
                  const safeConnector =
                    normaliseStoredConnector(
                      connector,
                    )

                  return safeConnector
                    ? [safeConnector]
                    : []
                } catch {
                  return []
                }
              },
            )
          : []

      return {
        version: 1,
        connectors,
      }
    } catch {
      return {
        version: 1,
        connectors: [],
      }
    }
  }

  async function writeRecord(record) {
    await ensureStorage()

    const temporaryPath = `${getStoragePath()}.tmp`
    const serialised = JSON.stringify(
      {
        version: 1,
        connectors: Array.isArray(record?.connectors)
          ? record.connectors
          : [],
      },
      null,
      2,
    )

    await fileSystem.writeFile(
      temporaryPath,
      serialised,
      {
        encoding: "utf8",
        mode: 0o600,
      },
    )

    await fileSystem.rename(
      temporaryPath,
      getStoragePath(),
    )
  }

  async function getEncryptionMode() {
    if (
      typeof safeStorage.isAsyncEncryptionAvailable === "function"
    ) {
      try {
        if (await safeStorage.isAsyncEncryptionAvailable()) {
          return "async"
        }
      } catch {
        // Fall back to the synchronous OS-backed API.
      }
    }

    return safeStorage.isEncryptionAvailable()
      ? "sync"
      : ""
  }

  async function encryptSecret(value) {
    const secret = String(value || "").trim()

    if (!secret) {
      return null
    }

    const mode = await getEncryptionMode()

    if (!mode) {
      throw new Error(
        "Secure operating-system encryption is unavailable. BreakVeil did not save the API key.",
      )
    }

    if (
      mode === "async" &&
      typeof safeStorage.encryptStringAsync === "function"
    ) {
      const encrypted = await safeStorage.encryptStringAsync(secret)

      return {
        mode,
        data: encrypted.toString("base64"),
      }
    }

    return {
      mode: "sync",
      data: safeStorage
        .encryptString(secret)
        .toString("base64"),
    }
  }

  async function decryptSecret(encryptedSecret) {
    if (!encryptedSecret?.data) {
      return ""
    }

    const encryptedBuffer = Buffer.from(
      encryptedSecret.data,
      "base64",
    )

    if (
      encryptedSecret.mode === "async" &&
      typeof safeStorage.decryptStringAsync === "function"
    ) {
      const result = await safeStorage.decryptStringAsync(encryptedBuffer)
      return result?.result || ""
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Secure operating-system decryption is unavailable.",
      )
    }

    return safeStorage.decryptString(encryptedBuffer)
  }

  function normaliseStoredTest(rawTest) {
    if (
      !rawTest ||
      typeof rawTest !==
        "object" ||
      Array.isArray(rawTest)
    ) {
      return null
    }

    const mapping =
      normaliseMapping({
        mapping:
          rawTest.mapping ||
          {},
      })
    const capabilities =
      Object.fromEntries(
        Object.entries(
          rawTest.capabilities ||
          {},
        )
          .slice(0, 30)
          .map(
            ([key, value]) => [
              cleanSingleLine(
                key,
                80,
              ),
              value === true,
            ],
          ),
      )

    return {
      ok:
        rawTest.ok === true,
      testedAt:
        cleanSingleLine(
          rawTest.testedAt,
          80,
        ),
      message:
        cleanSingleLine(
          rawTest.message,
          1000,
        ),
      error:
        cleanSingleLine(
          rawTest.error,
          1000,
        ),
      approvedHostname:
        cleanSingleLine(
          rawTest.approvedHostname,
          255,
        ),
      responseBytes:
        Math.max(
          0,
          Number(
            rawTest.responseBytes ||
            0,
          ),
        ),
      resultCount:
        Math.max(
          0,
          Number(
            rawTest.resultCount ||
            0,
          ),
        ),
      resultsPath:
        validateFieldPath(
          rawTest.resultsPath ||
            "",
          "Results array path",
        ),
      mapping,
      capabilities,
      readyForActivation:
        rawTest.readyForActivation ===
        true,
      security: {
        https:
          rawTest.security?.https ===
          true,
        hostnameApproved:
          rawTest.security
            ?.hostnameApproved ===
          true,
        privateNetworksBlocked:
          rawTest.security
            ?.privateNetworksBlocked ===
          true,
        redirectPolicy:
          cleanSingleLine(
            rawTest.security
              ?.redirectPolicy,
            80,
          ),
        responseSizeLimited:
          rawTest.security
            ?.responseSizeLimited ===
          true,
        executableContentBlocked:
          rawTest.security
            ?.executableContentBlocked ===
          true,
        credentialsRedacted:
          rawTest.security
            ?.credentialsRedacted ===
          true,
      },
    }
  }

  function normaliseStoredConnector(rawConnector) {
    if (
      !rawConnector ||
      !isCustomSourceId(
        rawConnector.id,
      )
    ) {
      return null
    }

    const searchUrl =
      parseHttpsUrl(
        rawConnector.searchUrl,
        "API URL",
      )
    assertUrlDoesNotContainSecret(
      searchUrl,
    )

    const method =
      String(
        rawConnector.method ||
        "GET",
      ).toUpperCase()

    if (!REQUEST_METHODS.has(method)) {
      return null
    }

    const authenticationType =
      String(
        rawConnector.authentication
          ?.type ||
        "none",
      ).toLowerCase()

    if (
      !AUTHENTICATION_TYPES.has(
        authenticationType,
      )
    ) {
      return null
    }

    let authenticationName = ""

    if (
      authenticationType ===
      "header"
    ) {
      authenticationName =
        validateHeaderName(
          rawConnector.authentication
            ?.name ||
          "X-API-Key",
        )
    } else if (
      authenticationType ===
      "query"
    ) {
      authenticationName =
        validateParameterName(
          rawConnector.authentication
            ?.name ||
          "api_key",
          "API-key parameter name",
          {
            required: true,
          },
        )
    }

    const encryptedSecret =
      rawConnector.authentication
        ?.encryptedSecret
    const safeEncryptedSecret =
      encryptedSecret &&
      ["sync", "async"].includes(
        encryptedSecret.mode,
      ) &&
      typeof encryptedSecret.data ===
        "string" &&
      encryptedSecret.data.length <=
        20_000
        ? {
            mode:
              encryptedSecret.mode,
            data:
              encryptedSecret.data,
          }
        : null

    const parameterSource =
      rawConnector.searchParameters ||
      {}
    const storedSearchParameters = {
      keywords:
        validateParameterName(
          parameterSource.keywords ||
            "",
          "Keyword parameter name",
        ),
      location:
        validateParameterName(
          parameterSource.location ||
            "",
          "Location parameter name",
        ),
      page:
        validateParameterName(
          parameterSource.page ||
            "",
          "Page parameter name",
        ),
      limit:
        validateParameterName(
          parameterSource.limit ||
            "",
          "Result-limit parameter name",
        ),
    }
    const repairedSearchParameters =
      rawConnector.active === true
        ? {
            searchParameters:
              storedSearchParameters,
          }
        : removeRejectedSearchParameter(
            storedSearchParameters,
            rawConnector.lastTest
              ?.error ||
              "",
          )
    const searchParameters =
      repairedSearchParameters
        .searchParameters
    const mapping =
      normaliseMapping({
        mapping:
          rawConnector.mapping ||
          {},
      })
    const capabilities =
      Object.fromEntries(
        Object.entries(
          rawConnector.capabilities ||
          {},
        )
          .slice(0, 30)
          .map(
            ([key, value]) => [
              cleanSingleLine(
                key,
                80,
              ),
              value === true,
            ],
          ),
      )

    return {
      id:
        rawConnector.id,
      name:
        cleanSingleLine(
          rawConnector.name,
          60,
        ) ||
        "Custom Job Source",
      searchUrl:
        searchUrl.toString(),
      documentationUrl:
        rawConnector.documentationUrl
          ? normaliseDocumentationUrl(
              rawConnector.documentationUrl,
            )
          : "",
      approvedHostname:
        searchUrl.hostname.toLowerCase(),
      method,
      authentication: {
        type:
          authenticationType,
        name:
          authenticationName,
        encryptedSecret:
          safeEncryptedSecret,
      },
      searchParameters,
      resultsPath:
        validateFieldPath(
          rawConnector.resultsPath ||
            "",
          "Results array path",
        ),
      mapping,
      active:
        rawConnector.active ===
        true,
      autoDiscoveryEnabled:
        rawConnector.autoDiscoveryEnabled ===
        true,
      securityState:
        [
          "quarantine",
          "review",
          "approved",
        ].includes(
          rawConnector.securityState,
        )
          ? rawConnector.securityState
          : "quarantine",
      createdAt:
        cleanSingleLine(
          rawConnector.createdAt,
          80,
        ),
      updatedAt:
        cleanSingleLine(
          rawConnector.updatedAt,
          80,
        ),
      lastTest:
        normaliseStoredTest(
          rawConnector.lastTest,
        ),
      capabilities,
    }
  }

  function normaliseAuthentication(payload = {}) {
    const type = String(payload.authType || "none")
      .trim()
      .toLowerCase()

    if (!AUTHENTICATION_TYPES.has(type)) {
      throw new Error("Select a supported authentication method.")
    }

    let name = ""

    if (type === "header") {
      name = validateHeaderName(
        payload.authName || "X-API-Key",
      )
    } else if (type === "query") {
      name = validateParameterName(
        payload.authName || "api_key",
        "API-key parameter name",
        {
          required: true,
        },
      )
    }

    return {
      type,
      name,
    }
  }

  function normaliseSearchParameters(payload = {}) {
    return normaliseOptionalSearchParameters(
      payload,
    )
  }

  function normaliseMapping(payload = {}) {
    const mappingPayload = payload.mapping || payload
    const mapping = {}

    for (const fieldName of Object.keys(EMPTY_MAPPING)) {
      mapping[fieldName] = validateFieldPath(
        mappingPayload?.[fieldName] || "",
        `${fieldName} field mapping`,
      )
    }

    return mapping
  }

  function normaliseDocumentationUrl(value) {
    const rawValue = cleanSingleLine(value, 2048)

    if (!rawValue) {
      return ""
    }

    return parseHttpsUrl(rawValue, "Documentation URL").toString()
  }

  function assertUrlDoesNotContainSecret(searchUrl) {
    const secretParameterNames =
      new Set([
        "key",
        "apikey",
        "appkey",
        "accesskey",
        "token",
        "accesstoken",
        "authtoken",
        "secret",
        "clientsecret",
        "password",
        "passwd",
        "authorization",
        "auth",
      ])

    for (
      const [parameterName, parameterValue]
      of searchUrl.searchParams.entries()
    ) {
      const normalisedName =
        String(parameterName || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")

      if (
        parameterValue &&
        secretParameterNames.has(
          normalisedName,
        )
      ) {
        throw new Error(
          "The API URL appears to contain a secret. Remove it from the URL and use BreakVeil's encrypted authentication fields instead.",
        )
      }
    }
  }

  function normaliseConnectorPayload(payload = {}, existingConnector = null) {
    const name = cleanSingleLine(payload.name, 60)

    if (name.length < 2) {
      throw new Error("Enter a name for the custom job source.")
    }

    const searchUrl = parseHttpsUrl(
      payload.searchUrl,
      "API URL",
    )

    assertUrlDoesNotContainSecret(searchUrl)

    const method = String(payload.method || "GET")
      .trim()
      .toUpperCase()

    if (!REQUEST_METHODS.has(method)) {
      throw new Error("Custom connectors may only use GET or POST.")
    }

    const authentication = normaliseAuthentication(payload)
    const secret = String(payload.secret || "").trim()

    if (
      secret.length > 4096 ||
      /[\u0000-\u001f\u007f]/.test(
        secret,
      )
    ) {
      throw new Error(
        "The API key or token contains unsupported control characters.",
      )
    }

    if (
      authentication.type !== "none" &&
      !secret &&
      !existingConnector?.authentication?.encryptedSecret?.data
    ) {
      throw new Error("Enter the API key or token for this connector.")
    }

    const resultsPath = validateFieldPath(
      payload.resultsPath || "",
      "Results array path",
    )

    return {
      name,
      searchUrl: searchUrl.toString(),
      documentationUrl: normaliseDocumentationUrl(
        payload.documentationUrl,
      ),
      approvedHostname: searchUrl.hostname.toLowerCase(),
      method,
      authentication,
      searchParameters: normaliseSearchParameters(payload),
      resultsPath,
      mapping: normaliseMapping(payload),
      secret,
    }
  }

  function publicConnector(connector) {
    return {
      id: connector.id,
      source: connector.id,
      name: connector.name,
      searchUrl: connector.searchUrl,
      documentationUrl: connector.documentationUrl || "",
      approvedHostname: connector.approvedHostname,
      method: connector.method,
      authentication: {
        type: connector.authentication?.type || "none",
        name: connector.authentication?.name || "",
        hasSecret: Boolean(
          connector.authentication?.encryptedSecret?.data,
        ),
      },
      searchParameters: {
        ...(connector.searchParameters || {}),
      },
      resultsPath: connector.resultsPath || "",
      mapping: {
        ...EMPTY_MAPPING,
        ...(connector.mapping || {}),
      },
      active: connector.active === true,
      autoDiscoveryEnabled: connector.autoDiscoveryEnabled === true,
      securityState: connector.securityState || "quarantine",
      createdAt: connector.createdAt || "",
      updatedAt: connector.updatedAt || "",
      lastTest: connector.lastTest || null,
      capabilities: {
        ...(connector.capabilities || {}),
      },
    }
  }

  function buildSourceStatus(connector) {
    const publicValue = publicConnector(connector)

    return {
      source: connector.id,
      name: connector.name,
      connectionMode: "custom",
      custom: true,
      removable: true,
      configured:
        connector.active === true &&
        connector.securityState === "approved" &&
        connector.lastTest?.ok === true,
      autoDiscoveryDefault: false,
      autoDiscoveryEnabled:
        connector.autoDiscoveryEnabled === true,
      descriptionSource:
        connector.capabilities?.fullDescription
          ? "custom-api-full"
          : "custom-api-snippet",
      capabilities: {
        ...(connector.capabilities || {}),
      },
      savedAt: connector.updatedAt || connector.createdAt || "",
      lastTest: connector.lastTest || null,
      security: {
        state: connector.securityState || "quarantine",
        approvedHostname: connector.approvedHostname,
        httpsOnly: true,
        privateNetworksBlocked: true,
        responseLimitMb: 5,
        timeoutSeconds: 15,
        redirectPolicy: "same-host-only",
      },
      customConnector: publicValue,
      health: null,
    }
  }

  async function listConnectors() {
    const record = await readRecord()
    return record.connectors.map(publicConnector)
  }

  async function getStatuses() {
    const record = await readRecord()

    return record.connectors.reduce((statuses, connector) => {
      statuses[connector.id] = buildSourceStatus(connector)
      return statuses
    }, {})
  }

  async function getConnector(sourceId) {
    if (!isCustomSourceId(sourceId)) {
      return null
    }

    const record = await readRecord()

    return (
      record.connectors.find(
        (connector) => connector.id === sourceId,
      ) || null
    )
  }

  async function getSourceName(sourceId) {
    return (await getConnector(sourceId))?.name || "Custom Job Source"
  }

  function flattenObjectPaths(value, prefix = "", depth = 0, output = []) {
    if (
      depth > 3 ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return output
    }

    for (const [key, childValue] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        continue
      }

      const nextPath = prefix
        ? `${prefix}.${key}`
        : key

      if (
        childValue === null ||
        ["string", "number", "boolean"].includes(typeof childValue)
      ) {
        output.push({
          path: nextPath,
          key,
          value: childValue,
        })
      } else if (
        childValue &&
        typeof childValue === "object" &&
        !Array.isArray(childValue)
      ) {
        flattenObjectPaths(
          childValue,
          nextPath,
          depth + 1,
          output,
        )
      }
    }

    return output
  }

  function aliasScore(candidate, aliases) {
    const normalisedKey = String(candidate?.key || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
    const normalisedPath = String(candidate?.path || "")
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, "")

    let bestScore = 0

    for (const alias of aliases) {
      const safeAlias = alias.toLowerCase()

      if (normalisedKey === safeAlias) {
        bestScore = Math.max(bestScore, 100)
      } else if (normalisedPath.endsWith(`.${safeAlias}`)) {
        bestScore = Math.max(bestScore, 90)
      } else if (normalisedKey.includes(safeAlias)) {
        bestScore = Math.max(bestScore, 65)
      }
    }

    return bestScore
  }

  function detectMapping(sampleJob) {
    const candidates = flattenObjectPaths(sampleJob)
    const mapping = {
      ...EMPTY_MAPPING,
    }

    for (const [fieldName, aliases] of Object.entries(FIELD_ALIASES)) {
      const ranked = candidates
        .map((candidate) => ({
          ...candidate,
          score: aliasScore(candidate, aliases),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((first, second) => second.score - first.score)

      mapping[fieldName] = ranked[0]?.path || ""
    }

    return mapping
  }

  function scoreCandidateArray(items, pathValue) {
    if (!Array.isArray(items) || items.length === 0) {
      return -1
    }

    const sample = items.find(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    )

    if (!sample) {
      return -1
    }

    const detected = detectMapping(sample)
    let score = 10

    if (detected.title) score += 35
    if (detected.url) score += 25
    if (detected.company) score += 10
    if (detected.description) score += 10
    if (detected.location) score += 5
    if (/jobs|results|vacancies|positions|data/i.test(pathValue)) score += 12

    return score
  }

  function findCandidateArrays(value, prefix = "", depth = 0, output = []) {
    if (depth > 4 || !value || typeof value !== "object") {
      return output
    }

    if (Array.isArray(value)) {
      output.push({
        path: prefix,
        items: value,
        score: scoreCandidateArray(value, prefix),
      })
      return output
    }

    for (const [key, childValue] of Object.entries(value)) {
      const nextPath = prefix
        ? `${prefix}.${key}`
        : key

      if (Array.isArray(childValue)) {
        output.push({
          path: nextPath,
          items: childValue,
          score: scoreCandidateArray(childValue, nextPath),
        })
      } else if (
        childValue &&
        typeof childValue === "object"
      ) {
        findCandidateArrays(
          childValue,
          nextPath,
          depth + 1,
          output,
        )
      }
    }

    return output
  }

  function getResultsArray(responseData, configuredPath = "") {
    if (configuredPath) {
      const configuredValue = getPathValue(
        responseData,
        configuredPath,
      )

      if (!Array.isArray(configuredValue)) {
        throw new Error(
          "The configured results path did not point to an array of jobs.",
        )
      }

      return {
        path: configuredPath,
        items: configuredValue,
        detected: false,
      }
    }

    const candidates = findCandidateArrays(responseData)
      .filter((candidate) => candidate.score >= 0)
      .sort((first, second) => second.score - first.score)

    if (!candidates.length) {
      throw new Error(
        "BreakVeil could not find a job-results array in the JSON response.",
      )
    }

    return {
      path: candidates[0].path,
      items: candidates[0].items,
      detected: true,
    }
  }

  function cleanDescription(value) {
    return String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 50_000)
  }

  function cleanText(value, maximumLength = 2000) {
    return cleanDescription(value)
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, maximumLength)
  }

  function safeExternalUrl(value) {
    const rawValue = cleanSingleLine(value, 2048)

    if (!rawValue) {
      return ""
    }

    try {
      const parsed = new URL(rawValue)
      return parsed.protocol === "https:"
        ? parsed.toString()
        : ""
    } catch {
      return ""
    }
  }

  function normaliseDate(value) {
    if (!value) {
      return ""
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
      ? ""
      : parsed.toISOString()
  }

  function parseBoolean(value) {
    if (typeof value === "boolean") {
      return value
    }

    const safeValue = String(value || "").trim().toLowerCase()
    return ["true", "1", "yes", "remote"].includes(safeValue)
  }

  function buildCapabilities(jobs, mapping) {
    const descriptions = jobs
      .slice(0, 5)
      .map((job) => cleanDescription(getPathValue(job, mapping.description)))
      .filter(Boolean)

    const hasFullDescription = descriptions.some(
      (description) =>
        description.length >= 800 &&
        !/(?:\.{3}|…)$/.test(description),
    )

    return {
      search: true,
      locationFiltering: Boolean(mapping.location),
      pagination: false,
      salary: Boolean(mapping.salaryText),
      remote: Boolean(mapping.remote),
      fullDescription: hasFullDescription,
      detailLookup: false,
      applicationUrl: Boolean(mapping.url),
      postedDate: Boolean(mapping.postedAt),
      company: Boolean(mapping.company),
    }
  }

  async function buildRequest(connector, secret, query) {
    const requestUrl = new URL(connector.searchUrl)
    const requestValues = {}
    const parameters = connector.searchParameters || {}

    if (parameters.keywords && query.keywords) {
      requestValues[parameters.keywords] = query.keywords
    }

    if (parameters.location && query.location) {
      requestValues[parameters.location] = query.location
    }

    if (parameters.page) {
      requestValues[parameters.page] = String(query.page || 1)
    }

    if (parameters.limit) {
      requestValues[parameters.limit] = String(
        Math.min(
          MAX_RESULTS_PER_REQUEST,
          Math.max(1, Number(query.resultsPerSource || 25)),
        ),
      )
    }

    const authentication = connector.authentication || {
      type: "none",
      name: "",
    }
    const headers = {}

    if (authentication.type === "bearer") {
      headers.Authorization = `Bearer ${secret}`
    } else if (authentication.type === "header") {
      headers[authentication.name] = secret
    } else if (authentication.type === "query") {
      requestUrl.searchParams.set(authentication.name, secret)
    }

    let body

    if (connector.method === "POST") {
      headers["Content-Type"] = "application/json"
      body = JSON.stringify(requestValues)
    } else {
      for (const [key, value] of Object.entries(requestValues)) {
        requestUrl.searchParams.set(key, value)
      }
    }

    return {
      requestUrl: requestUrl.toString(),
      method: connector.method,
      headers,
      body,
    }
  }

  async function executeConnectorRequest(connector, query) {
    const secret = await decryptSecret(
      connector.authentication?.encryptedSecret,
    )
    const request = await buildRequest(
      connector,
      secret,
      query,
    )

    return secureFetchJson({
      ...request,
      approvedHostname: connector.approvedHostname,
      sourceName: connector.name,
      secrets: [secret],
    })
  }

  async function testConnectorRecord(connector) {
    const testedAt = new Date().toISOString()
    let connectorForTest = {
      ...connector,
      searchParameters: {
        ...(connector.searchParameters || {}),
      },
    }
    const removedParameters = []
    let response = null

    for (
      let attempt = 0;
      attempt <= OPTIONAL_SEARCH_PARAMETERS.length;
      attempt += 1
    ) {
      try {
        response = await executeConnectorRequest(
          connectorForTest,
          createCapabilityProbeQuery(),
        )

        break
      } catch (error) {
        const repaired =
          removeRejectedSearchParameter(
            connectorForTest.searchParameters,
            friendlyError(error),
          )

        if (
          repaired.removedField &&
          !removedParameters.includes(
            repaired.rejectedParameter
              .toLowerCase(),
          )
        ) {
          removedParameters.push(
            repaired.rejectedParameter
              .toLowerCase(),
          )
          connectorForTest = {
            ...connectorForTest,
            searchParameters:
              repaired.searchParameters,
          }
          continue
        }

        return {
          ok: false,
          testedAt,
          error: friendlyError(error),
          readyForActivation: false,
          searchParameters: {
            ...connectorForTest.searchParameters,
          },
        }
      }
    }

    if (!response) {
      return {
        ok: false,
        testedAt,
        error:
          "The API rejected too many optional search parameters. Review the advanced parameter mapping and try again.",
        readyForActivation: false,
        searchParameters: {
          ...connectorForTest.searchParameters,
        },
      }
    }

    try {
      const results = getResultsArray(
        response.data,
        connectorForTest.resultsPath,
      )
      const sampleJobs = results.items
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item),
        )
        .slice(0, 5)

      if (!sampleJobs.length) {
        throw new Error(
          "The API responded safely, but the results array did not contain any job objects.",
        )
      }

      const detectedMapping = detectMapping(sampleJobs[0])
      const mapping = Object.fromEntries(
        Object.keys(EMPTY_MAPPING).map((fieldName) => [
          fieldName,
          connectorForTest.mapping?.[fieldName] || detectedMapping[fieldName] || "",
        ]),
      )
      const capabilities = buildCapabilities(sampleJobs, mapping)
      const readyForActivation = Boolean(
        mapping.title &&
        mapping.url,
      )
      const adjustmentMessage =
        removedParameters.length > 0
          ? ` BreakVeil safely removed unsupported optional parameter${removedParameters.length === 1 ? "" : "s"}: ${removedParameters.join(", ")}.`
          : ""

      return {
        ok: true,
        testedAt,
        message: readyForActivation
          ? `Security checks passed. ${sampleJobs.length} sample job${sampleJobs.length === 1 ? " was" : "s were"} inspected safely.${adjustmentMessage}`
          : `Security checks passed, but title and application URL mappings must be confirmed before activation.${adjustmentMessage}`,
        approvedHostname: response.hostname,
        responseBytes: response.responseBytes,
        resultCount: sampleJobs.length,
        resultsPath: results.path,
        mapping,
        capabilities,
        readyForActivation,
        searchParameters: {
          ...connectorForTest.searchParameters,
        },
        removedParameters: [
          ...removedParameters,
        ],
        security: {
          https: true,
          hostnameApproved: true,
          privateNetworksBlocked: true,
          redirectPolicy: "same-host-only",
          responseSizeLimited: true,
          executableContentBlocked: true,
          credentialsRedacted: true,
        },
      }
    } catch (error) {
      return {
        ok: false,
        testedAt,
        error: friendlyError(error),
        readyForActivation: false,
        searchParameters: {
          ...connectorForTest.searchParameters,
        },
      }
    }
  }

  async function saveAndTest(payload = {}) {
    const record = await readRecord()
    const requestedId = String(payload.id || "").trim()
    const existingIndex = requestedId
      ? record.connectors.findIndex(
          (connector) => connector.id === requestedId,
        )
      : -1
    const existingConnector = existingIndex >= 0
      ? record.connectors[existingIndex]
      : null

    if (!existingConnector && record.connectors.length >= MAX_CONNECTORS) {
      throw new Error(
        `BreakVeil allows up to ${MAX_CONNECTORS} custom connectors at one time.`,
      )
    }

    const normalised = normaliseConnectorPayload(
      payload,
      existingConnector,
    )
    const now = new Date().toISOString()
    const encryptedSecret = normalised.secret
      ? await encryptSecret(normalised.secret)
      : existingConnector?.authentication?.encryptedSecret || null
    const connector = {
      id: existingConnector?.id || `${CUSTOM_SOURCE_PREFIX}${randomUUID()}`,
      name: normalised.name,
      searchUrl: normalised.searchUrl,
      documentationUrl: normalised.documentationUrl,
      approvedHostname: normalised.approvedHostname,
      method: normalised.method,
      authentication: {
        ...normalised.authentication,
        encryptedSecret,
      },
      searchParameters: normalised.searchParameters,
      resultsPath: normalised.resultsPath,
      mapping: normalised.mapping,
      active: false,
      autoDiscoveryEnabled: false,
      securityState: "quarantine",
      createdAt: existingConnector?.createdAt || now,
      updatedAt: now,
      lastTest: null,
      capabilities: {},
    }

    const testResult = await testConnectorRecord(connector)

    connector.lastTest = testResult
    connector.searchParameters = {
      ...connector.searchParameters,
      ...(testResult.searchParameters || {}),
    }
    connector.resultsPath = testResult.resultsPath || connector.resultsPath
    connector.mapping = {
      ...EMPTY_MAPPING,
      ...(testResult.mapping || connector.mapping || {}),
    }
    connector.capabilities = {
      ...(testResult.capabilities || {}),
    }
    connector.securityState = testResult.ok
      ? "review"
      : "quarantine"
    connector.updatedAt = new Date().toISOString()

    if (existingIndex >= 0) {
      record.connectors[existingIndex] = connector
    } else {
      record.connectors.push(connector)
    }

    await writeRecord(record)

    return {
      connector: publicConnector(connector),
      test: testResult,
    }
  }

  async function retest(sourceId) {
    const record = await readRecord()
    const index = record.connectors.findIndex(
      (connector) => connector.id === sourceId,
    )

    if (index < 0) {
      throw new Error("The custom connector could not be found.")
    }

    const connector = {
      ...record.connectors[index],
      active: false,
      autoDiscoveryEnabled: false,
      securityState: "quarantine",
    }
    const testResult = await testConnectorRecord(connector)

    connector.lastTest = testResult
    connector.searchParameters = {
      ...connector.searchParameters,
      ...(testResult.searchParameters || {}),
    }
    connector.resultsPath = testResult.resultsPath || connector.resultsPath
    connector.mapping = {
      ...EMPTY_MAPPING,
      ...(testResult.mapping || connector.mapping || {}),
    }
    connector.capabilities = {
      ...(testResult.capabilities || {}),
    }
    connector.securityState = testResult.ok
      ? "review"
      : "quarantine"
    connector.updatedAt = new Date().toISOString()
    record.connectors[index] = connector

    await writeRecord(record)

    return {
      connector: publicConnector(connector),
      test: testResult,
    }
  }

  async function activate(sourceId) {
    const record = await readRecord()
    const index = record.connectors.findIndex(
      (connector) => connector.id === sourceId,
    )

    if (index < 0) {
      throw new Error("The custom connector could not be found.")
    }

    const connector = record.connectors[index]

    if (!connector.lastTest?.ok) {
      throw new Error("This connector must pass its security test before activation.")
    }

    if (!connector.lastTest?.readyForActivation) {
      throw new Error(
        "Confirm the title and application URL field mappings, then save and test the connector again.",
      )
    }

    connector.active = true
    connector.securityState = "approved"
    connector.updatedAt = new Date().toISOString()
    record.connectors[index] = connector

    await writeRecord(record)

    return publicConnector(connector)
  }

  async function setPermissions(sourceId, changes = {}) {
    const record = await readRecord()
    const index = record.connectors.findIndex(
      (connector) => connector.id === sourceId,
    )

    if (index < 0) {
      throw new Error("The custom connector could not be found.")
    }

    const connector = record.connectors[index]

    if (changes.active === false) {
      connector.active = false
      connector.autoDiscoveryEnabled = false
    } else if (changes.active === true) {
      if (
        !connector.lastTest?.ok ||
        !connector.lastTest?.readyForActivation
      ) {
        throw new Error("This connector must pass review before it can be enabled.")
      }

      connector.active = true
      connector.securityState = "approved"
    }

    if (changes.autoDiscoveryEnabled !== undefined) {
      if (!connector.active && changes.autoDiscoveryEnabled === true) {
        throw new Error("Enable the connector before allowing automatic discovery.")
      }

      connector.autoDiscoveryEnabled = changes.autoDiscoveryEnabled === true
    }

    connector.updatedAt = new Date().toISOString()
    record.connectors[index] = connector
    await writeRecord(record)

    return publicConnector(connector)
  }

  async function remove(sourceId) {
    const record = await readRecord()
    const previousLength = record.connectors.length

    record.connectors = record.connectors.filter(
      (connector) => connector.id !== sourceId,
    )

    if (record.connectors.length === previousLength) {
      throw new Error("The custom connector could not be found.")
    }

    await writeRecord(record)
  }

  function normaliseCustomJob(rawJob, connector, index) {
    const mapping = connector.mapping || EMPTY_MAPPING
    const providerId = cleanText(
      getPathValue(rawJob, mapping.id),
      300,
    ) || `${index + 1}`
    const title = cleanText(
      getPathValue(rawJob, mapping.title),
      500,
    )
    const company = cleanText(
      getPathValue(rawJob, mapping.company),
      500,
    )
    const location = cleanText(
      getPathValue(rawJob, mapping.location),
      500,
    )
    const description = cleanDescription(
      getPathValue(rawJob, mapping.description),
    )
    const applyUrl = safeExternalUrl(
      getPathValue(rawJob, mapping.url),
    )
    const salaryText = cleanText(
      getPathValue(rawJob, mapping.salaryText),
      500,
    )
    const contractType = cleanText(
      getPathValue(rawJob, mapping.contractType),
      200,
    )
    const remoteValue = getPathValue(rawJob, mapping.remote)
    const isRemote = parseBoolean(remoteValue) ||
      /\bremote\b|work from home|home[- ]based/i.test(
        `${location} ${title} ${description.slice(0, 1200)}`,
      )
    const postedAt = normaliseDate(
      getPathValue(rawJob, mapping.postedAt),
    )

    if (!title || !applyUrl) {
      return null
    }

    return {
      id: `${connector.id}:${providerId}`,
      providerId,
      source: connector.id,
      sourceName: connector.name,
      provider: connector.name,
      title,
      company,
      location,
      description,
      descriptionSource: connector.capabilities?.fullDescription
        ? "api-full"
        : "provider-snippet",
      salaryMin: null,
      salaryMax: null,
      salaryText,
      currency: "",
      contractType,
      workType: isRemote ? "Remote" : "",
      postedAt,
      expiresAt: "",
      url: applyUrl,
      applyUrl,
      isRemote,
      sourceQuality: connector.capabilities?.fullDescription
        ? "full-description"
        : "provider-snippet",
      sourceQualityLabel: connector.capabilities?.fullDescription
        ? "Full description"
        : "Description snippet",
      sourceListings: [
        {
          source: connector.id,
          sourceName: connector.name,
          providerId,
          url: applyUrl,
        },
      ],
      sources: [connector.id],
      sourceNames: [connector.name],
      duplicateCount: 1,
      meta: {
        providerId,
        customConnector: true,
        approvedHostname: connector.approvedHostname,
      },
    }
  }

  async function searchSource(sourceId, query) {
    const connector = await getConnector(sourceId)

    if (!connector) {
      throw new Error("The custom connector could not be found.")
    }

    if (
      !connector.active ||
      connector.securityState !== "approved" ||
      !connector.lastTest?.ok
    ) {
      throw new Error(`${connector.name} is still in quarantine.`)
    }

    if (
      query.requestMode === "automatic" &&
      connector.autoDiscoveryEnabled !== true
    ) {
      return {
        source: connector.id,
        sourceName: connector.name,
        jobs: [],
        returned: 0,
        available: 0,
        skipped: true,
        skippedReason:
          "Automatic Discovery permission is disabled for this custom source.",
      }
    }

    if (requestLocks.has(sourceId)) {
      await requestLocks.get(sourceId)
    }

    let releaseLock
    const lock = new Promise((resolve) => {
      releaseLock = resolve
    })
    requestLocks.set(sourceId, lock)

    try {
      let response

      try {
        response = await executeConnectorRequest(
          connector,
          query,
        )
      } catch (error) {
        const rejectedValue =
          findMappedSearchFieldWithRejectedValue(
            connector.searchParameters,
            friendlyError(error),
          )

        if (
          rejectedValue.rejectedField ===
            "location" &&
          query.location
        ) {
          return {
            source: connector.id,
            sourceName: connector.name,
            jobs: [],
            returned: 0,
            available: 0,
            skipped: true,
            notice:
              buildStrictLocationSkipNotice(
                connector.name,
                query.location,
              ),
          }
        }

        throw error
      }

      const results = getResultsArray(
        response.data,
        connector.resultsPath,
      )
      const jobs = results.items
        .slice(0, MAX_RESULTS_PER_REQUEST)
        .map((rawJob, index) =>
          normaliseCustomJob(
            rawJob,
            connector,
            index,
          ),
        )
        .filter(Boolean)
        .slice(0, query.resultsPerSource)

      return {
        source: connector.id,
        sourceName: connector.name,
        jobs,
        returned: jobs.length,
        available: results.items.length,
      }
    } finally {
      requestLocks.delete(sourceId)
      releaseLock()
    }
  }

  function registerIpc(ipcMain) {
    ipcMain.handle(
      "custom-job-sources:list",
      async (event) => {
        try {
          assertTrustedIpcSender(event)

          return {
            ok: true,
            connectors: await listConnectors(),
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
          }
        }
      },
    )

    ipcMain.handle(
      "custom-job-sources:save-and-test",
      async (event, payload = {}) => {
        try {
          assertTrustedIpcSender(event)
          const result = await saveAndTest(payload)

          return {
            ok: result.test?.ok === true,
            ...result,
            connectors: await listConnectors(),
            error: result.test?.error || "",
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            connectors: await listConnectors(),
          }
        }
      },
    )

    ipcMain.handle(
      "custom-job-sources:retest",
      async (event, sourceId) => {
        try {
          assertTrustedIpcSender(event)
          const result = await retest(sourceId)

          return {
            ok: result.test?.ok === true,
            ...result,
            connectors: await listConnectors(),
            error: result.test?.error || "",
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            connectors: await listConnectors(),
          }
        }
      },
    )

    ipcMain.handle(
      "custom-job-sources:activate",
      async (event, sourceId) => {
        try {
          assertTrustedIpcSender(event)

          return {
            ok: true,
            connector: await activate(sourceId),
            connectors: await listConnectors(),
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            connectors: await listConnectors(),
          }
        }
      },
    )

    ipcMain.handle(
      "custom-job-sources:set-permissions",
      async (event, sourceId, changes = {}) => {
        try {
          assertTrustedIpcSender(event)

          return {
            ok: true,
            connector: await setPermissions(sourceId, changes),
            connectors: await listConnectors(),
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            connectors: await listConnectors(),
          }
        }
      },
    )

    ipcMain.handle(
      "custom-job-sources:remove",
      async (event, sourceId) => {
        try {
          assertTrustedIpcSender(event)
          await remove(sourceId)

          return {
            ok: true,
            connectors: await listConnectors(),
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            connectors: await listConnectors(),
          }
        }
      },
    )
  }

  return {
    getSourceName,
    getStatuses,
    isCustomSourceId,
    listConnectors,
    registerIpc,
    searchSource,
  }
}

module.exports = {
  createCustomJobSourceService,
  isCustomSourceId,
  __testing: {
    createCapabilityProbeQuery,
    buildStrictLocationSkipNotice,
    findMappedSearchFieldWithRejectedValue,
    findRejectedSearchParameter,
    findRejectedSearchParameterValue,
    getPathValue,
    normaliseOptionalSearchParameters,
    removeRejectedSearchParameter,
  },
}

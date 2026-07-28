const { safeStorage } = require("electron")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { deduplicateJobs } = require("./job-duplicate-detection.cjs")
const {
  parseRetryAfter,
  nextRetryAt,
  refreshDecision,
  cacheTtlMs,
} = require("./job-refresh-policy.cjs")

const fileSystem = fs.promises

const {
  getBuiltInJobProviderIds,
  getSourceNamesMap,
  providerRequiresCredentials,
} = require("./job-provider-registry.cjs")

const CACHE_STALE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 50
const REQUEST_TIMEOUT_MS = 30 * 1000
const FULL_DESCRIPTION_ENRICHMENT_VERSION = 5
const REED_DETAIL_CONCURRENCY = 5


const ARBEITNOW_ALLOWED_LOCATION_TERMS = [
  "germany",
  "deutschland",
  "europe",
  "european",
  "international",
  "berlin",
  "munich",
  "munchen",
  "hamburg",
  "frankfurt",
  "cologne",
  "koln",
  "dusseldorf",
  "stuttgart",
  "leipzig",
  "dortmund",
  "dresden",
  "bremen",
  "nuremberg",
  "nurnberg",
  "hanover",
  "hannover",
  "bonn",
  "essen",
  "potsdam",
  "augsburg",
  "karlsruhe",
]

const ARBEITNOW_BROAD_LOCATION_TERMS = [
  "germany",
  "deutschland",
  "europe",
  "european",
  "international",
]

const ARBEITNOW_GERMAN_WORDS = new Set([
  "und",
  "oder",
  "aber",
  "fur",
  "mit",
  "von",
  "zum",
  "zur",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "einem",
  "einen",
  "eines",
  "wir",
  "sie",
  "du",
  "dein",
  "deine",
  "unser",
  "unsere",
  "sich",
  "nicht",
  "auch",
  "als",
  "bei",
  "werden",
  "wird",
  "sind",
  "ist",
  "haben",
  "hat",
  "kann",
  "konnen",
  "sowie",
  "uber",
  "nach",
  "vor",
  "durch",
  "gegen",
  "ohne",
  "zwischen",
  "diese",
  "dieser",
  "dieses",
  "ihre",
  "ihren",
  "ihrem",
  "ihres",
  "ihnen",
  "dich",
  "uns",
  "euch",
  "gerne",
  "freuen",
  "bewerbung",
  "aufgaben",
  "anforderungen",
  "kenntnisse",
  "erfahrung",
  "unternehmen",
  "stelle",
  "stellenangebot",
  "arbeitsplatz",
  "arbeitszeit",
  "vergutung",
  "ausbildung",
  "studium",
  "berufserfahrung",
  "verantwortung",
  "tatigkeiten",
  "teamfahigkeit",
  "deutschkenntnisse",
])

const ARBEITNOW_ENGLISH_WORDS = new Set([
  "and",
  "or",
  "but",
  "with",
  "from",
  "into",
  "within",
  "about",
  "the",
  "a",
  "an",
  "we",
  "you",
  "your",
  "our",
  "they",
  "their",
  "is",
  "are",
  "will",
  "would",
  "have",
  "has",
  "can",
  "should",
  "this",
  "that",
  "these",
  "those",
  "role",
  "team",
  "experience",
  "skills",
  "requirements",
  "responsibilities",
  "candidate",
  "company",
  "opportunity",
  "apply",
  "application",
  "work",
  "working",
  "job",
  "position",
  "support",
  "business",
  "customers",
  "people",
  "looking",
  "join",
])

const REMOTE_SOURCE_ALLOWED_LOCATION_TERMS = [
  "remote",
  "work from home",
  "home based",
  "home-based",
  "anywhere",
  "worldwide",
  "global",
  "international",
  "uk",
  "united kingdom",
  "great britain",
  "britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "europe",
  "european",
  "emea",
  "usa",
  "united states",
  "north america",
  "canada",
  "latam",
  "latin america",
  "apac",
  "asia pacific",
  "australia",
  "new zealand",
]

const REMOTE_SOURCE_BROAD_LOCATION_TERMS = [
  "remote",
  "work from home",
  "home based",
  "home-based",
  "anywhere",
  "worldwide",
  "global",
  "international",
]

const PROVIDER_FEED_CACHE_TTLS = {
  jobicy: 60 * 60 * 1000,
  remotive: 6 * 60 * 60 * 1000,
}

const PROVIDER_FEED_STALE_RETENTION_MS =
  2 * 24 * 60 * 60 * 1000


function registerJobSearchEngine({
  app,
  ipcMain,
  getErrorMessage,
  customJobSources,
  directEmployerSources,
}) {
  const sourceNames =
    getSourceNamesMap()

  const providerFeedRequests =
    new Map()

  function friendlyError(error) {
    return typeof getErrorMessage === "function"
      ? getErrorMessage(error)
      : error?.message || "An unknown error occurred."
  }


  function createSearchError(
    message,
    {
      failureType = "provider",
      retryable = true,
      statusCode = 0,
      retryAfterAt = "",
    } = {},
  ) {
    const error =
      new Error(
        message,
      )

    error.failureType =
      failureType

    error.retryable =
      retryable

    error.statusCode =
      statusCode

    error.retryAfterAt =
      retryAfterAt

    return error
  }

  function classifySearchError(
    error,
    sourceName =
      "Job source",
  ) {
    const message =
      friendlyError(
        error,
      )

    if (
      error?.failureType
    ) {
      return {
        failureType:
          error.failureType,

        retryable:
          error.retryable !==
          false,

        statusCode:
          Number(
            error.statusCode ||
            0,
          ),

        retryAfterAt:
          String(error.retryAfterAt || ""),

        message,
      }
    }

    const causeCode =
      String(
        error?.cause?.code ||
        error?.code ||
        "",
      ).toUpperCase()

    const normalisedMessage =
      message.toLowerCase()

    if (
      [
        "ENOTFOUND",
        "EAI_AGAIN",
        "ECONNREFUSED",
        "ECONNRESET",
        "ENETUNREACH",
        "EHOSTUNREACH",
        "ETIMEDOUT",
      ].includes(
        causeCode,
      ) ||
      normalisedMessage.includes(
        "fetch failed",
      ) ||
      normalisedMessage.includes(
        "network",
      ) ||
      normalisedMessage.includes(
        "internet",
      )
    ) {
      return {
        failureType:
          "network",

        retryable:
          true,

        statusCode:
          0,

        message:
          `${sourceName} could not be reached. Check the internet connection and try again.`,
      }
    }

    if (
      normalisedMessage.includes(
        "did not respond within",
      ) ||
      normalisedMessage.includes(
        "timed out",
      )
    ) {
      return {
        failureType:
          "timeout",

        retryable:
          true,

        statusCode:
          0,

        message,
      }
    }

    if (
      normalisedMessage.includes(
        "rejected the saved credentials",
      ) ||
      normalisedMessage.includes(
        "not connected",
      )
    ) {
      return {
        failureType:
          "authentication",

        retryable:
          false,

        statusCode:
          Number(
            error?.statusCode ||
            0,
          ),

        message,
      }
    }

    if (
      normalisedMessage.includes(
        "rate limit",
      ) ||
      normalisedMessage.includes(
        "error 429",
      )
    ) {
      return {
        failureType:
          "rate-limit",

        retryable:
          true,

        statusCode:
          429,

        message,
      }
    }

    return {
      failureType:
        "provider",

      retryable:
        true,

      statusCode:
        Number(
          error?.statusCode ||
          0,
        ),

      retryAfterAt:
        String(error?.retryAfterAt || ""),

      message,
    }
  }

  function getHealthState(
    providerResult,
  ) {
    if (
      providerResult.ok
    ) {
      return "available"
    }

    if (
      providerResult.failureType ===
      "authentication"
    ) {
      return "credentials"
    }

    if (
      providerResult.failureType ===
      "rate-limit"
    ) {
      return "rate-limited"
    }

    if (
      [
        "network",
        "timeout",
      ].includes(
        providerResult.failureType,
      )
    ) {
      return "offline"
    }

    return "unavailable"
  }

  async function updateSourceHealth(
    providerResults,
  ) {
    const previous =
      await readJson(
        getHealthPath(),
        {
          version:
            1,

          sources:
            {},
        },
      )

    const next = {
      version:
        1,

      updatedAt:
        new Date()
          .toISOString(),

      sources: {
        ...(previous
          ?.sources ||
          {}),
      },
    }

    for (
      const result
      of providerResults
    ) {
      if (result.deferred) {
        continue
      }
      const previousSource =
        next.sources[
          result.source
        ] ||
        {}

      const attemptedAt =
        new Date()
          .toISOString()

      const consecutiveFailures = result.ok
        ? 0
        : Math.max(0, Number(previousSource.consecutiveFailures || 0)) + 1

      const retryAt = result.ok
        ? ""
        : nextRetryAt({
            failureType: result.failureType || "provider",
            consecutiveFailures,
            retryAfterAt: result.retryAfterAt,
            attemptedAt: Date.parse(attemptedAt),
          })

      next.sources[
        result.source
      ] = {
        source:
          result.source,

        sourceName:
          result.sourceName,

        status:
          getHealthState(
            result,
          ),

        lastAttemptAt:
          attemptedAt,

        lastSuccessAt:
          result.ok
            ? attemptedAt
            : previousSource
                .lastSuccessAt ||
              "",

        lastFailureAt:
          result.ok
            ? previousSource
                .lastFailureAt ||
              ""
            : attemptedAt,

        consecutiveFailures,

        failureType:
          result.ok
            ? ""
            : result.failureType ||
              "provider",

        retryable:
          result.ok
            ? true
            : result.retryable !==
              false,

        retryAt,

        statusCode:
          Number(result.statusCode || 0),

        message:
          result.ok
            ? `${result.sourceName} completed the latest search.`
            : result.error ||
              `${result.sourceName} did not complete the latest search.`,

        returned:
          Number(
            result.returned ||
            0,
          ),

        available:
          Number(
            result.available ||
            0,
          ),
      }
    }

    await writeJson(
      getHealthPath(),
      next,
    )

    return next
  }

  function getStorageFolder() {
    return path.join(app.getPath("userData"), "job-sources")
  }

  function getCredentialsPath() {
    return path.join(getStorageFolder(), "credentials.json")
  }

  function getCachePath() {
    return path.join(getStorageFolder(), "search-cache.json")
  }

  function getProviderFeedCachePath() {
    return path.join(getStorageFolder(), "provider-feed-cache.json")
  }

  function getHealthPath() {
    return path.join(getStorageFolder(), "source-health.json")
  }

  async function ensureStorage() {
    await fileSystem.mkdir(getStorageFolder(), { recursive: true })
  }

  async function readJson(filePath, fallback) {
    await ensureStorage()

    try {
      return JSON.parse(await fileSystem.readFile(filePath, "utf8"))
    } catch {
      return fallback
    }
  }

  async function writeJson(filePath, value) {
    await ensureStorage()
    await fileSystem.writeFile(filePath, JSON.stringify(value, null, 2), "utf8")
  }

  async function getProviderFeed(
    source,
    fetcher,
  ) {
    const now =
      Date.now()

    const cache =
      await readJson(
        getProviderFeedCachePath(),
        {
          version: 1,
          entries: {},
        },
      )

    const entry =
      cache?.entries?.[source]

    const expiresAt =
      new Date(
        entry?.expiresAt ||
        0,
      ).getTime()

    if (
      entry?.payload &&
      Number.isFinite(
        expiresAt,
      ) &&
      expiresAt > now
    ) {
      return {
        payload:
          entry.payload,
        cacheState:
          "fresh",
      }
    }

    if (
      providerFeedRequests.has(
        source,
      )
    ) {
      return providerFeedRequests.get(
        source,
      )
    }

    const requestPromise =
      (async () => {
        try {
          const payload =
            await fetcher()

          const ttl =
            PROVIDER_FEED_CACHE_TTLS[
              source
            ] ||
            60 * 60 * 1000

          const latestCache =
            await readJson(
              getProviderFeedCachePath(),
              {
                version: 1,
                entries: {},
              },
            )

          const fetchedAt =
            new Date()
              .toISOString()

          const nextCache = {
            version: 1,
            entries: {
              ...(latestCache?.entries || {}),
              [source]: {
                fetchedAt,
                expiresAt:
                  new Date(
                    Date.now() + ttl,
                  ).toISOString(),
                staleUntil:
                  new Date(
                    Date.now() +
                      PROVIDER_FEED_STALE_RETENTION_MS,
                  ).toISOString(),
                payload,
              },
            },
          }

          await writeJson(
            getProviderFeedCachePath(),
            nextCache,
          )

          return {
            payload,
            cacheState:
              "network",
          }
        } catch (error) {
          const staleUntil =
            new Date(
              entry?.staleUntil ||
              0,
            ).getTime()

          if (
            entry?.payload &&
            Number.isFinite(
              staleUntil,
            ) &&
            staleUntil > now
          ) {
            return {
              payload:
                entry.payload,
              cacheState:
                "stale",
              cacheWarning:
                friendlyError(
                  error,
                ),
            }
          }

          throw error
        } finally {
          providerFeedRequests.delete(
            source,
          )
        }
      })()

    providerFeedRequests.set(
      source,
      requestPromise,
    )

    return requestPromise
  }

  function cleanText(value) {
    return String(value || "")
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
      .replace(/&#x2022;|&bull;/gi, "•")
      .replace(/\r/g, "")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  function normaliseToken(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  }


  function normaliseComparableText(
    value,
  ) {
    return cleanText(
      value,
    )
      .toLowerCase()
      .normalize(
        "NFD",
      )
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /ß/g,
        "ss",
      )
      .replace(
        /[^a-z0-9]+/g,
        " ",
      )
      .trim()
  }

  function arbeitnowLocationIsEligible(
    location,
  ) {
    const locationToken =
      normaliseComparableText(
        location,
      )

    if (!locationToken) {
      return true
    }

    return ARBEITNOW_ALLOWED_LOCATION_TERMS.some(
      (term) =>
        locationToken.includes(
          term,
        ),
    )
  }

  function arbeitnowLocationIsBroad(
    location,
  ) {
    const locationToken =
      normaliseComparableText(
        location,
      )

    return ARBEITNOW_BROAD_LOCATION_TERMS.some(
      (term) =>
        locationToken.includes(
          term,
        ),
    )
  }

  function countKnownLanguageWords(
    text,
    dictionary,
  ) {
    return normaliseComparableText(
      text,
    )
      .split(
        " ",
      )
      .filter(
        Boolean,
      )
      .reduce(
        (count, word) =>
          count +
          (dictionary.has(
            word,
          )
            ? 1
            : 0),
        0,
      )
  }

  function arbeitnowJobLooksEnglish(
    job,
  ) {
    const sample =
      [
        job?.title,
        job?.description,
        job?.category,
        job?.contractType,
      ]
        .filter(
          Boolean,
        )
        .join(
          " ",
        )
        .slice(
          0,
          16000,
        )

    if (!sample) {
      return false
    }

    const comparableSample =
      normaliseComparableText(
        sample,
      )

    let germanScore =
      countKnownLanguageWords(
        sample,
        ARBEITNOW_GERMAN_WORDS,
      )

    let englishScore =
      countKnownLanguageWords(
        sample,
        ARBEITNOW_ENGLISH_WORDS,
      )

    const germanPhrases = [
      "wir suchen",
      "deine aufgaben",
      "ihre aufgaben",
      "das bringst du mit",
      "das bringen sie mit",
      "uber uns",
      "uber dich",
      "wir bieten",
      "freuen uns auf deine bewerbung",
      "freuen uns auf ihre bewerbung",
      "gute deutschkenntnisse",
      "sehr gute deutschkenntnisse",
    ]

    const englishPhrases = [
      "we are looking",
      "you will",
      "your responsibilities",
      "what you will do",
      "about the role",
      "what we offer",
      "join our team",
      "apply now",
      "job description",
      "the ideal candidate",
    ]

    germanScore +=
      germanPhrases.filter(
        (phrase) =>
          comparableSample.includes(
            phrase,
          ),
      ).length *
      4

    englishScore +=
      englishPhrases.filter(
        (phrase) =>
          comparableSample.includes(
            phrase,
          ),
      ).length *
      3

    if (
      /[äöüß]/i.test(
        sample,
      )
    ) {
      germanScore +=
        2
    }

    const titleToken =
      normaliseComparableText(
        job?.title,
      )

    if (
      [
        "sachbearbeiter",
        "kaufmann",
        "kauffrau",
        "mitarbeiter",
        "fachkraft",
        "ausbildung",
        "werkstudent",
        "buchhalter",
        "steuerfachangestellte",
        "vertriebsmitarbeiter",
      ].some(
        (term) =>
          titleToken.includes(
            term,
          ),
      )
    ) {
      germanScore +=
        5
    }

    return !(
      germanScore >=
        6 &&
      germanScore >
        englishScore *
          1.2
    )
  }

  function remoteSourceLocationIsEligible(
    location,
  ) {
    const locationToken =
      normaliseComparableText(
        location,
      )

    if (!locationToken) {
      return true
    }

    return REMOTE_SOURCE_ALLOWED_LOCATION_TERMS.some(
      (term) =>
        locationToken.includes(
          term,
        ),
    )
  }

  function remoteSourceLocationIsBroad(
    location,
  ) {
    const locationToken =
      normaliseComparableText(
        location,
      )

    if (!locationToken) {
      return true
    }

    return REMOTE_SOURCE_BROAD_LOCATION_TERMS.some(
      (term) =>
        locationToken.includes(
          term,
        ),
    )
  }

  function remoteJobMatchesLocation(
    candidateLocation,
    requestedLocation,
  ) {
    if (
      remoteSourceLocationIsBroad(
        requestedLocation,
      )
    ) {
      return true
    }

    const candidateToken =
      normaliseComparableText(
        candidateLocation,
      )

    const requestedToken =
      normaliseComparableText(
        requestedLocation,
      )

    if (!candidateToken) {
      return false
    }

    if (
      [
        "worldwide",
        "anywhere",
        "global",
        "international",
        "all locations",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    ) {
      return true
    }

    if (
      requestedToken.includes(
        "united kingdom",
      ) ||
      requestedToken === "uk" ||
      requestedToken.includes(
        "great britain",
      ) ||
      requestedToken === "britain" ||
      requestedToken.includes(
        "england",
      ) ||
      requestedToken.includes(
        "scotland",
      ) ||
      requestedToken.includes(
        "wales",
      ) ||
      requestedToken.includes(
        "northern ireland",
      )
    ) {
      return [
        "united kingdom",
        "uk",
        "great britain",
        "britain",
        "england",
        "scotland",
        "wales",
        "northern ireland",
        "europe",
        "european",
        "emea",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    if (
      requestedToken.includes(
        "europe",
      )
    ) {
      return [
        "europe",
        "european",
        "emea",
        "united kingdom",
        "uk",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    if (
      requestedToken.includes(
        "emea",
      )
    ) {
      return [
        "emea",
        "europe",
        "middle east",
        "africa",
        "united kingdom",
        "uk",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    if (
      requestedToken.includes(
        "united states",
      ) ||
      requestedToken === "usa" ||
      requestedToken.includes(
        "north america",
      )
    ) {
      return [
        "united states",
        "usa",
        "north america",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    if (
      requestedToken.includes(
        "canada",
      )
    ) {
      return [
        "canada",
        "north america",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    if (
      requestedToken.includes(
        "latam",
      ) ||
      requestedToken.includes(
        "latin america",
      )
    ) {
      return [
        "latam",
        "latin america",
        "south america",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    if (
      requestedToken.includes(
        "apac",
      ) ||
      requestedToken.includes(
        "asia pacific",
      ) ||
      requestedToken.includes(
        "australia",
      ) ||
      requestedToken.includes(
        "new zealand",
      )
    ) {
      return [
        "apac",
        "asia pacific",
        "australia",
        "new zealand",
        "asia",
      ].some(
        (term) =>
          candidateToken.includes(
            term,
          ),
      )
    }

    return candidateToken.includes(
      requestedToken,
    )
  }

  function jobMatchesKeywords(
    job,
    keywords,
  ) {
    const keywordTokens =
      normaliseToken(
        keywords,
      )
        .split(
          " ",
        )
        .filter(
          (token) =>
            token.length > 1,
        )

    if (
      keywordTokens.length ===
      0
    ) {
      return true
    }

    const haystack =
      normaliseToken(
        [
          job?.title,
          job?.company,
          job?.description,
          job?.category,
          job?.contractType,
          job?.workType,
        ]
          .filter(
            Boolean,
          )
          .join(
            " ",
          ),
      )

    return keywordTokens.every(
      (token) =>
        haystack.includes(
          token,
        ),
    )
  }

  function jobMatchesSalary(
    job,
    query,
  ) {
    if (
      query.minimumSalary ===
        null &&
      query.maximumSalary ===
        null
    ) {
      return true
    }

    const minimum =
      toNumber(
        job?.salaryMin,
      )

    const maximum =
      toNumber(
        job?.salaryMax,
      )

    if (
      minimum === null &&
      maximum === null
    ) {
      return false
    }

    if (
      query.minimumSalary !==
        null &&
      maximum !== null &&
      maximum <
        query.minimumSalary
    ) {
      return false
    }

    if (
      query.maximumSalary !==
        null &&
      minimum !== null &&
      minimum >
        query.maximumSalary
    ) {
      return false
    }

    return true
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  function clampInteger(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(String(value), 10)

    if (!Number.isFinite(parsed)) {
      return fallback
    }

    return Math.min(maximum, Math.max(minimum, parsed))
  }

  function normaliseDate(value) {
  const rawValue =
    String(value || "").trim()

  if (!rawValue) {
    return ""
  }

  /*
   * Reed may return dates in British DD/MM/YYYY format.
   * JavaScript otherwise reads ambiguous slash dates as
   * MM/DD/YYYY, reversing the day and month.
   */
  const britishDateMatch =
    rawValue.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    )

  if (britishDateMatch) {
    const day =
      Number(britishDateMatch[1])

    const month =
      Number(britishDateMatch[2])

    const year =
      Number(britishDateMatch[3])

    const hour =
      britishDateMatch[4]
        ? Number(britishDateMatch[4])
        : 12

    const minute =
      britishDateMatch[5]
        ? Number(britishDateMatch[5])
        : 0

    const second =
      britishDateMatch[6]
        ? Number(britishDateMatch[6])
        : 0

    const parsedDate =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          hour,
          minute,
          second,
        ),
      )

    const validDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day

    return validDate
      ? parsedDate.toISOString()
      : ""
  }

  /*
   * Adzuna and other providers normally return ISO dates,
   * which JavaScript can safely parse directly.
   */
  const parsedDate =
    new Date(rawValue)

  return Number.isNaN(
    parsedDate.getTime(),
  )
    ? ""
    : parsedDate.toISOString()
}

  function normaliseUnixTimestamp(
    value,
  ) {
    const parsedValue =
      Number(value)

    if (
      !Number.isFinite(
        parsedValue,
      )
    ) {
      return normaliseDate(
        value,
      )
    }

    const milliseconds =
      parsedValue <
      100000000000
        ? parsedValue *
          1000
        : parsedValue

    const parsedDate =
      new Date(
        milliseconds,
      )

    return Number.isNaN(
      parsedDate.getTime(),
    )
      ? ""
      : parsedDate.toISOString()
  }

  function normaliseUrl(value) {
    const safeValue = String(value || "").trim()

    if (!safeValue) {
      return ""
    }

    try {
      const parsed = new URL(safeValue)
      return ["http:", "https:"].includes(parsed.protocol)
        ? parsed.toString()
        : ""
    } catch {
      return ""
    }
  }

  function detectRemote(...values) {
    const text = values.map((value) => cleanText(value).toLowerCase()).join(" ")

    return ["remote", "work from home", "home based", "home-based"].some(
      (phrase) => text.includes(phrase),
    )
  }

  function formatSalary(minimum, maximum, currency = "GBP") {
    const min = toNumber(minimum)
    const max = toNumber(maximum)

    if (min === null && max === null) {
      return ""
    }

    const formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
      maximumFractionDigits: 0,
    })

    if (min !== null && max !== null) {
      return min === max
        ? formatter.format(min)
        : `${formatter.format(min)} – ${formatter.format(max)}`
    }

    return min !== null
      ? `From ${formatter.format(min)}`
      : `Up to ${formatter.format(max)}`
  }

  async function decryptCredential(encryptedRecord) {
    if (!encryptedRecord?.data) {
      return ""
    }

    const buffer = Buffer.from(encryptedRecord.data, "base64")

    if (
      encryptedRecord.mode === "async" &&
      typeof safeStorage.decryptStringAsync === "function"
    ) {
      const decrypted = await safeStorage.decryptStringAsync(buffer)
      return decrypted.result || ""
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Secure credential decryption is unavailable.")
    }

    return safeStorage.decryptString(buffer)
  }

  async function getCredentials(source) {
    const record = await readJson(getCredentialsPath(), { sources: {} })
    const sourceRecord = record?.sources?.[source]

    if (source === "reed") {
      const apiKey = await decryptCredential(sourceRecord?.credentials?.apiKey)

      if (!apiKey) {
        throw new Error("Reed is not connected.")
      }

      return { apiKey }
    }

    if (source === "adzuna") {
      const appId = await decryptCredential(sourceRecord?.credentials?.appId)
      const appKey = await decryptCredential(sourceRecord?.credentials?.appKey)

      if (!appId || !appKey) {
        throw new Error("Adzuna is not connected.")
      }

      return { appId, appKey }
    }

    if (source === "jooble") {
      const apiKey = await decryptCredential(
        sourceRecord?.credentials?.apiKey,
      )

      if (!apiKey) {
        throw new Error("Jooble is not connected.")
      }

      return { apiKey }
    }

    if (
      getBuiltInJobProviderIds().includes(
        source,
      ) &&
      !providerRequiresCredentials(
        source,
      )
    ) {
      return {}
    }

    throw new Error("The selected job source is not supported.")
  }

  async function fetchJson(
    requestUrl,
    options,
    sourceName,
  ) {
    const controller =
      new AbortController()

    const timeoutId =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS,
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

      let responseData =
        {}

      if (
        responseText
      ) {
        try {
          responseData =
            JSON.parse(
              responseText,
            )
        } catch {
          responseData =
            {}
        }
      }

      if (
        !response.ok
      ) {
        const detail =
          responseData
            ?.error ||
          responseData
            ?.message ||
          ""

        const suffix =
          detail
            ? `: ${detail}`
            : "."

        if (
          response.status ===
            401 ||
          response.status ===
            403
        ) {
          throw createSearchError(
            `${sourceName} rejected the saved credentials.`,
            {
              failureType:
                "authentication",

              retryable:
                false,

              statusCode:
                response.status,
            },
          )
        }

        if (
          response.status ===
          429
        ) {
          const retryAfterTimestamp = parseRetryAfter(
            response.headers.get("retry-after"),
          )
          throw createSearchError(
            `${sourceName} reached its request limit. Try again later.`,
            {
              failureType:
                "rate-limit",

              retryable:
                true,

              statusCode:
                response.status,

              retryAfterAt:
                retryAfterTimestamp
                  ? new Date(retryAfterTimestamp).toISOString()
                  : "",
            },
          )
        }

        throw createSearchError(
          `${sourceName} returned error ${response.status}${suffix}`,
          {
            failureType:
              response.status >=
              500
                ? "provider"
                : "request",

            retryable:
              response.status >=
                500 ||
              response.status ===
                408,

            statusCode:
              response.status,
          },
        )
      }

      return responseData
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        throw createSearchError(
          `${sourceName} did not respond within 30 seconds.`,
          {
            failureType:
              "timeout",

            retryable:
              true,
          },
        )
      }

      if (
        error?.failureType
      ) {
        throw error
      }

      const classified =
        classifySearchError(
          error,
          sourceName,
        )

      throw createSearchError(
        classified.message,
        classified,
      )
    } finally {
      clearTimeout(
        timeoutId,
      )
    }
  }

  function normaliseSearchRequest(payload = {}) {
    const supportedSources =
      getBuiltInJobProviderIds()
    const requestedSources = Array.isArray(payload.sources)
      ? payload.sources
      : supportedSources

    const sources = [...new Set(
      requestedSources
        .map((source) => String(source || "").toLowerCase())
        .filter(
          (source) =>
            supportedSources.includes(source) ||
            customJobSources?.isCustomSourceId(source) ||
            directEmployerSources?.isDirectEmployerSourceId(source),
        ),
    )]

    if (sources.length === 0) {
      throw new Error("Select at least one connected job source.")
    }

    const keywords = cleanText(payload.keywords)
    const location = cleanText(payload.location)

    if (!keywords && !location) {
      throw new Error("Enter a job title, keyword or location before searching.")
    }

    let minimumSalary = toNumber(payload.minimumSalary)
    let maximumSalary = toNumber(payload.maximumSalary)

    if (
      minimumSalary !== null &&
      maximumSalary !== null &&
      minimumSalary > maximumSalary
    ) {
      ;[minimumSalary, maximumSalary] = [maximumSalary, minimumSalary]
    }

    return {
      keywords,
      location,
      distance: clampInteger(payload.distance, 15, 1, 100),
      minimumSalary,
      maximumSalary,
      permanent: payload.permanent === true,
      contract: payload.contract === true,
      temporary: payload.temporary === true,
      fullTime: payload.fullTime === true,
      partTime: payload.partTime === true,
      postedWithinDays: clampInteger(payload.postedWithinDays, 0, 0, 30),
      resultsPerSource: clampInteger(payload.resultsPerSource, 25, 1, 50),
      page: clampInteger(payload.page, 1, 1, 20),
      requestMode:
        payload.requestMode === "automatic"
          ? "automatic"
          : "manual",
      sources,
    }
  }

  function looksTruncatedDescription(value) {
    const text =
      cleanText(
        value,
      )

    if (!text) {
      return true
    }

    return (
      text.length < 900 ||
      /^(?:\.{3}|…)/.test(text) ||
      /(?:\.{3}|…)$/.test(text)
    )
  }

  async function mapWithConcurrency(
    items,
    concurrency,
    worker,
  ) {
    const results =
      new Array(
        items.length,
      )

    let nextIndex =
      0

    async function runWorker() {
      while (
        nextIndex <
        items.length
      ) {
        const currentIndex =
          nextIndex

        nextIndex +=
          1

        results[
          currentIndex
        ] =
          await worker(
            items[
              currentIndex
            ],
            currentIndex,
          )
      }
    }

    const workerCount =
      Math.min(
        Math.max(
          1,
          concurrency,
        ),
        items.length,
      )

    await Promise.all(
      Array.from(
        {
          length:
            workerCount,
        },
        () =>
          runWorker(),
      ),
    )

    return results
  }

  async function enrichReedSearchResults(
    rawJobs,
    credentials,
  ) {
    const authentication =
      Buffer
        .from(
          `${credentials.apiKey}:`,
        )
        .toString(
          "base64",
        )

    return mapWithConcurrency(
      rawJobs,
      REED_DETAIL_CONCURRENCY,
      async (
        rawJob,
      ) => {
        const providerId =
          String(
            rawJob?.jobId ||
              rawJob?.id ||
              "",
          ).trim()

        const searchDescription =
          cleanText(
            rawJob?.jobDescription ||
              rawJob?.description,
          )

        if (
          !providerId ||
          !looksTruncatedDescription(
            searchDescription,
          )
        ) {
          return {
            ...rawJob,

            __descriptionSource:
              "search",

            __descriptionIsSnippet:
              false,
          }
        }

        try {
          const details =
            await fetchJson(
              `https://www.reed.co.uk/api/1.0/jobs/${encodeURIComponent(providerId)}`,
              {
                method:
                  "GET",

                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Basic ${authentication}`,
                },
              },
              "Reed",
            )

          const detailedDescription =
            cleanText(
              details?.jobDescription ||
                details?.description,
            )

          if (
            detailedDescription &&
            (
              detailedDescription.length >
                searchDescription.length ||
              !looksTruncatedDescription(
                detailedDescription,
              )
            )
          ) {
            return {
              ...rawJob,
              ...details,

              jobId:
                providerId,

              __descriptionSource:
                "details",

              __descriptionIsSnippet:
                false,
            }
          }
        } catch {
          /*
           * A failed detail request should not discard
           * an otherwise valid Reed search result.
           */
        }

        return {
          ...rawJob,

          __descriptionSource:
            "search",

          __descriptionIsSnippet:
            looksTruncatedDescription(
              searchDescription,
            ),
        }
      },
    )
  }

  function normaliseReedJob(rawJob) {
    const providerId = String(rawJob?.jobId || rawJob?.id || "").trim()
    const title = cleanText(rawJob?.jobTitle || rawJob?.title)
    const company = cleanText(rawJob?.employerName || rawJob?.company)
    const location = cleanText(rawJob?.locationName || rawJob?.location)
    const description = cleanText(rawJob?.jobDescription || rawJob?.description)
    const salaryMin = toNumber(
      rawJob?.yearlyMinimumSalary ?? rawJob?.minimumSalary,
    )
    const salaryMax = toNumber(
      rawJob?.yearlyMaximumSalary ?? rawJob?.maximumSalary,
    )
    const currency = cleanText(rawJob?.currency) || "GBP"
    const sourceUrl = normaliseUrl(rawJob?.jobUrl || rawJob?.url)
    const applyUrl = normaliseUrl(
      rawJob?.externalUrl || rawJob?.jobUrl || rawJob?.url,
    )
    const contractType = cleanText(rawJob?.contractType)
    const workType = cleanText(rawJob?.jobType)

    return {
      id: `reed:${providerId}`,
      providerId,
      source: "reed",
      sourceName: "Reed",
      title,
      company,
      location,
      description,
      descriptionIsSnippet:
        Boolean(
          rawJob?.__descriptionIsSnippet,
        ),
      descriptionSource:
        cleanText(
          rawJob?.__descriptionSource,
        ) ||
        "search",
      descriptionNotice:
        rawJob?.__descriptionIsSnippet
          ? "Reed returned a shortened search summary because the detailed advert could not be loaded."
          : "",
      salaryMin,
      salaryMax,
      salaryCurrency: currency,
      salaryPeriod: cleanText(rawJob?.salaryType) || "year",
      salaryPredicted: false,
      salaryText: formatSalary(salaryMin, salaryMax, currency),
      contractType,
      workType,
      category: "",
      postedAt: normaliseDate(
        rawJob?.date || rawJob?.datePosted || rawJob?.postedDate,
      ),
      expiresAt: normaliseDate(rawJob?.expirationDate),
      url: sourceUrl || applyUrl,
      applyUrl: applyUrl || sourceUrl,
      latitude: null,
      longitude: null,
      isRemote: detectRemote(title, location, description),
      attribution: {
        label: "Job on Reed",
        provider: "Reed",
        url: sourceUrl || applyUrl,
      },
      sources: ["reed"],
      sourceNames: ["Reed"],
      sourceListings: [
        {
          source: "reed",
          sourceName: "Reed",
          providerId,
          url: sourceUrl || applyUrl,
          applyUrl: applyUrl || sourceUrl,
        },
      ],
      duplicateCount: 1,
    }
  }

  function normaliseAdzunaJob(rawJob) {
    const providerId = String(rawJob?.id || "").trim()
    const title = cleanText(rawJob?.title)
    const company = cleanText(rawJob?.company?.display_name)
    const location = cleanText(
      rawJob?.location?.display_name || rawJob?.location,
    )
    const description = cleanText(rawJob?.description)
    const salaryMin = toNumber(rawJob?.salary_min)
    const salaryMax = toNumber(rawJob?.salary_max)
    const sourceUrl = normaliseUrl(rawJob?.redirect_url)
    const contractType = cleanText(rawJob?.contract_type).replace(/_/g, " ")
    const workType = cleanText(rawJob?.contract_time).replace(/_/g, " ")

    return {
      id: `adzuna:${providerId}`,
      providerId,
      source: "adzuna",
      sourceName: "Adzuna",
      title,
      company,
      location,
      description,
      descriptionIsSnippet:
        true,
      descriptionSource:
        "provider-snippet",
      descriptionNotice:
        "Adzuna's public search API supplies a shortened description summary. Open the original listing or paste the full advert before running detailed analysis.",
      salaryMin,
      salaryMax,
      salaryCurrency: "GBP",
      salaryPeriod: "year",
      salaryPredicted: rawJob?.salary_is_predicted === 1,
      salaryText: formatSalary(salaryMin, salaryMax, "GBP"),
      contractType,
      workType,
      category: cleanText(rawJob?.category?.label),
      postedAt: normaliseDate(rawJob?.created),
      expiresAt: "",
      url: sourceUrl,
      applyUrl: sourceUrl,
      latitude: toNumber(rawJob?.latitude),
      longitude: toNumber(rawJob?.longitude),
      isRemote: detectRemote(title, location, description),
      attribution: {
        label: "Jobs by Adzuna",
        provider: "Adzuna",
        url: "https://www.adzuna.co.uk/",
      },
      sources: ["adzuna"],
      sourceNames: ["Adzuna"],
      sourceListings: [
        {
          source: "adzuna",
          sourceName: "Adzuna",
          providerId,
          url: sourceUrl,
          applyUrl: sourceUrl,
        },
      ],
      duplicateCount: 1,
    }
  }

  function normaliseJoobleJob(
    rawJob,
  ) {
    const providerId =
      String(
        rawJob?.id ||
        "",
      ).trim()

    const title =
      cleanText(
        rawJob?.title,
      )

    const company =
      cleanText(
        rawJob?.company,
      )

    const location =
      cleanText(
        rawJob?.location,
      )

    const description =
      cleanText(
        rawJob?.snippet,
      )

    const sourceUrl =
      normaliseUrl(
        rawJob?.link,
      )

    const workType =
      cleanText(
        rawJob?.type,
      )

    const salaryText =
      cleanText(
        rawJob?.salary,
      )

    return {
      id:
        `jooble:${providerId}`,

      providerId,

      source:
        "jooble",

      sourceName:
        "Jooble",

      title,
      company,
      location,
      description,

      descriptionIsSnippet:
        true,

      descriptionSource:
        "provider-snippet",

      descriptionNotice:
        "Jooble's REST API supplies a job-description snippet. Open the original listing or paste the full advert before running detailed analysis.",

      salaryMin:
        null,

      salaryMax:
        null,

      salaryCurrency:
        "GBP",

      salaryPeriod:
        "",

      salaryPredicted:
        false,

      salaryText,

      contractType:
        workType,

      workType,

      category:
        cleanText(
          rawJob?.source,
        ),

      postedAt:
        normaliseDate(
          rawJob?.updated,
        ),

      expiresAt:
        "",

      url:
        sourceUrl,

      applyUrl:
        sourceUrl,

      latitude:
        null,

      longitude:
        null,

      isRemote:
        detectRemote(
          title,
          location,
          description,
          workType,
        ),

      attribution: {
        label:
          "Job via Jooble",

        provider:
          "Jooble",

        url:
          "https://jooble.org/",
      },

      sources: [
        "jooble",
      ],

      sourceNames: [
        "Jooble",
      ],

      sourceListings: [
        {
          source:
            "jooble",

          sourceName:
            "Jooble",

          providerId,

          url:
            sourceUrl,

          applyUrl:
            sourceUrl,
        },
      ],

      duplicateCount:
        1,
    }
  }

  function normaliseArbeitnowJob(
    rawJob,
  ) {
    const providerId =
      String(
        rawJob?.slug ||
          rawJob?.id ||
          rawJob?.url ||
          "",
      ).trim()

    const title =
      cleanText(
        rawJob?.title,
      )

    const company =
      cleanText(
        rawJob?.company_name,
      )

    const location =
      cleanText(
        rawJob?.location,
      )

    const description =
      cleanText(
        rawJob?.description,
      )

    const sourceUrl =
      normaliseUrl(
        rawJob?.url,
      )

    const tags =
      Array.isArray(
        rawJob?.tags,
      )
        ? rawJob.tags
            .map(
              cleanText,
            )
            .filter(
              Boolean,
            )
        : []

    const jobTypes =
      Array.isArray(
        rawJob?.job_types,
      )
        ? rawJob.job_types
            .map(
              cleanText,
            )
            .filter(
              Boolean,
            )
        : []

    const isRemote =
      rawJob?.remote ===
        true ||
      detectRemote(
        title,
        location,
        description,
        tags.join(
          " ",
        ),
      )

    return {
      id:
        `arbeitnow:${providerId}`,

      providerId,

      source:
        "arbeitnow",

      sourceName:
        "Arbeitnow (Germany)",

      title,
      company,
      location,
      description,

      descriptionIsSnippet:
        false,

      descriptionSource:
        "provider-full",

      descriptionNotice:
        "Arbeitnow supplied the full vacancy description through its public API.",

      salaryMin:
        null,

      salaryMax:
        null,

      salaryCurrency:
        "EUR",

      salaryPeriod:
        "",

      salaryPredicted:
        false,

      salaryText:
        "",

      contractType:
        jobTypes.join(
          ", ",
        ),

      workType:
        isRemote
          ? "Remote"
          : "",

      category:
        tags.join(
          ", ",
        ),

      postedAt:
        normaliseUnixTimestamp(
          rawJob?.created_at,
        ),

      expiresAt:
        "",

      url:
        sourceUrl,

      applyUrl:
        sourceUrl,

      latitude:
        null,

      longitude:
        null,

      isRemote,

      attribution: {
        label:
          "Job on Arbeitnow",

        provider:
          "Arbeitnow",

        url:
          sourceUrl ||
          "https://www.arbeitnow.com/",
      },

      sources: [
        "arbeitnow",
      ],

      sourceNames: [
        "Arbeitnow (Germany)",
      ],

      sourceListings: [
        {
          source:
            "arbeitnow",

          sourceName:
            "Arbeitnow (Germany)",

          providerId,

          url:
            sourceUrl,

          applyUrl:
            sourceUrl,
        },
      ],

      duplicateCount:
        1,
    }
  }

  function normaliseJobicyJob(
    rawJob,
  ) {
    const providerId =
      String(
        rawJob?.id ||
        rawJob?.url ||
        "",
      ).trim()

    const title =
      cleanText(
        rawJob?.jobTitle,
      )

    const company =
      cleanText(
        rawJob?.companyName,
      )

    const location =
      cleanText(
        rawJob?.jobGeo,
      ) ||
      "Remote"

    const description =
      cleanText(
        rawJob?.jobDescription ||
        rawJob?.jobExcerpt,
      )

    const sourceUrl =
      normaliseUrl(
        rawJob?.url,
      )

    const salaryMin =
      toNumber(
        rawJob?.salaryMin,
      )

    const salaryMax =
      toNumber(
        rawJob?.salaryMax,
      )

    const rawCurrency =
      cleanText(
        rawJob?.salaryCurrency,
      ).toUpperCase()

    const salaryCurrency =
      /^[A-Z]{3}$/.test(
        rawCurrency,
      )
        ? rawCurrency
        : "USD"

    const salaryPeriod =
      cleanText(
        rawJob?.salaryPeriod,
      )

    const salaryText =
      salaryMin !== null ||
      salaryMax !== null
        ? [
            formatSalary(
              salaryMin,
              salaryMax,
              salaryCurrency,
            ),
            salaryPeriod,
          ]
            .filter(
              Boolean,
            )
            .join(
              " / ",
            )
        : ""

    return {
      id:
        `jobicy:${providerId}`,

      providerId,

      source:
        "jobicy",

      sourceName:
        "Jobicy (Remote)",

      title,
      company,
      location,
      description,

      descriptionIsSnippet:
        false,

      descriptionSource:
        "provider-full",

      descriptionNotice:
        "Jobicy supplied the full remote vacancy description through its public API.",

      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      salaryPredicted:
        false,
      salaryText,

      contractType:
        cleanText(
          rawJob?.jobType,
        ),

      workType:
        "Remote",

      category:
        cleanText(
          rawJob?.jobIndustry,
        ),

      postedAt:
        normaliseDate(
          rawJob?.pubDate,
        ),

      expiresAt:
        "",

      url:
        sourceUrl,

      applyUrl:
        sourceUrl,

      latitude:
        null,

      longitude:
        null,

      isRemote:
        true,

      attribution: {
        label:
          "Job via Jobicy",

        provider:
          "Jobicy",

        url:
          sourceUrl ||
          "https://jobicy.com/",
      },

      sources: [
        "jobicy",
      ],

      sourceNames: [
        "Jobicy (Remote)",
      ],

      sourceListings: [
        {
          source:
            "jobicy",

          sourceName:
            "Jobicy (Remote)",

          providerId,

          url:
            sourceUrl,

          applyUrl:
            sourceUrl,
        },
      ],

      duplicateCount:
        1,
    }
  }

  function normaliseRemotiveJob(
    rawJob,
  ) {
    const providerId =
      String(
        rawJob?.id ||
        rawJob?.url ||
        "",
      ).trim()

    const title =
      cleanText(
        rawJob?.title,
      )

    const company =
      cleanText(
        rawJob?.company_name,
      )

    const location =
      cleanText(
        rawJob?.candidate_required_location,
      ) ||
      "Worldwide"

    const description =
      cleanText(
        rawJob?.description,
      )

    const sourceUrl =
      normaliseUrl(
        rawJob?.url,
      )

    return {
      id:
        `remotive:${providerId}`,

      providerId,

      source:
        "remotive",

      sourceName:
        "Remotive (Remote)",

      title,
      company,
      location,
      description,

      descriptionIsSnippet:
        false,

      descriptionSource:
        "provider-full",

      descriptionNotice:
        "Remotive supplied the full vacancy description. Public API listings are delayed by 24 hours.",

      salaryMin:
        null,

      salaryMax:
        null,

      salaryCurrency:
        "USD",

      salaryPeriod:
        "",

      salaryPredicted:
        false,

      salaryText:
        cleanText(
          rawJob?.salary,
        ),

      contractType:
        cleanText(
          rawJob?.job_type,
        ).replace(
          /_/g,
          " ",
        ),

      workType:
        "Remote",

      category:
        cleanText(
          rawJob?.category,
        ),

      postedAt:
        normaliseDate(
          rawJob?.publication_date,
        ),

      expiresAt:
        "",

      url:
        sourceUrl,

      applyUrl:
        sourceUrl,

      latitude:
        null,

      longitude:
        null,

      isRemote:
        true,

      attribution: {
        label:
          "Job via Remotive",

        provider:
          "Remotive",

        url:
          sourceUrl ||
          "https://remotive.com/remote-jobs",
      },

      sources: [
        "remotive",
      ],

      sourceNames: [
        "Remotive (Remote)",
      ],

      sourceListings: [
        {
          source:
            "remotive",

          sourceName:
            "Remotive (Remote)",

          providerId,

          url:
            sourceUrl,

          applyUrl:
            sourceUrl,
        },
      ],

      duplicateCount:
        1,
    }
  }

  function joobleRadiusFromMiles(
    miles,
  ) {
    const kilometres =
      Math.max(
        0,
        Number(
          miles ||
          0,
        ) *
          1.609344,
      )

    const allowed = [
      0,
      4,
      8,
      16,
      26,
      40,
      80,
    ]

    return (
      allowed.find(
        (radius) =>
          radius >=
          kilometres,
      ) ??
      80
    )
  }

  function matchesSelectedTypes(job, query) {
    const contractSelections = [
      query.permanent ? "permanent" : "",
      query.contract ? "contract" : "",
      query.temporary ? "temporary" : "",
    ].filter(Boolean)

    const workSelections = [
      query.fullTime ? "full time" : "",
      query.partTime ? "part time" : "",
    ].filter(Boolean)

    const contractType = normaliseToken(job.contractType)
    const workType = normaliseToken(job.workType)

    if (
      contractSelections.length > 0 &&
      contractType &&
      !contractSelections.some((selection) => contractType.includes(selection))
    ) {
      return false
    }

    if (
      workSelections.length > 0 &&
      workType &&
      !workSelections.some((selection) => workType.includes(selection))
    ) {
      return false
    }

    if (query.postedWithinDays > 0 && job.postedAt) {
      const postedTime = new Date(job.postedAt).getTime()
      const earliestAllowed =
        Date.now() - query.postedWithinDays * 24 * 60 * 60 * 1000

      if (Number.isFinite(postedTime) && postedTime < earliestAllowed) {
        return false
      }
    }

    return true
  }

  async function searchReed(credentials, query) {
    const parameters = new URLSearchParams()

    if (query.keywords) parameters.set("keywords", query.keywords)

    if (query.location) {
      parameters.set("locationName", query.location)
      parameters.set("distanceFromLocation", String(query.distance))
    }

    if (query.minimumSalary !== null) {
      parameters.set("minimumSalary", String(query.minimumSalary))
    }

    if (query.maximumSalary !== null) {
      parameters.set("maximumSalary", String(query.maximumSalary))
    }

    const selectedContractCount = [
      query.permanent,
      query.contract,
      query.temporary,
    ].filter(Boolean).length

    if (selectedContractCount === 1) {
      if (query.permanent) parameters.set("permanent", "true")
      if (query.contract) parameters.set("contract", "true")
      if (query.temporary) parameters.set("temp", "true")
    }

    const selectedWorkCount = [query.fullTime, query.partTime].filter(Boolean)
      .length

    if (selectedWorkCount === 1) {
      if (query.fullTime) parameters.set("fullTime", "true")
      if (query.partTime) parameters.set("partTime", "true")
    }

    parameters.set("resultsToTake", String(query.resultsPerSource))
    parameters.set(
      "resultsToSkip",
      String((query.page - 1) * query.resultsPerSource),
    )

    const authentication = Buffer.from(`${credentials.apiKey}:`).toString(
      "base64",
    )

    const response = await fetchJson(
      `https://www.reed.co.uk/api/1.0/search?${parameters.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authentication}`,
        },
      },
      "Reed",
    )

    const rawJobs =
      Array.isArray(
        response?.results,
      )
        ? response.results
        : []

    const enrichedRawJobs =
      await enrichReedSearchResults(
        rawJobs,
        credentials,
      )

    const jobs =
      enrichedRawJobs
        .map(
          normaliseReedJob,
        )
        .filter(
          (job) =>
            matchesSelectedTypes(
              job,
              query,
            ),
        )

    return {
      source: "reed",
      sourceName: "Reed",
      jobs,
      returned: jobs.length,
      available: toNumber(response?.totalResults) ?? jobs.length,
    }
  }

  async function searchAdzuna(credentials, query) {
    const requestUrl = new URL(
      `https://api.adzuna.com/v1/api/jobs/gb/search/${query.page}`,
    )

    requestUrl.searchParams.set("app_id", credentials.appId)
    requestUrl.searchParams.set("app_key", credentials.appKey)
    requestUrl.searchParams.set(
      "results_per_page",
      String(query.resultsPerSource),
    )
    requestUrl.searchParams.set("content-type", "application/json")

    if (query.keywords) requestUrl.searchParams.set("what", query.keywords)

    if (query.location) {
      requestUrl.searchParams.set("where", query.location)
      requestUrl.searchParams.set("distance", String(query.distance))
    }

    if (query.minimumSalary !== null) {
      requestUrl.searchParams.set("salary_min", String(query.minimumSalary))
    }

    if (query.maximumSalary !== null) {
      requestUrl.searchParams.set("salary_max", String(query.maximumSalary))
    }

    const selectedContractCount = [
      query.permanent,
      query.contract,
      query.temporary,
    ].filter(Boolean).length

    if (selectedContractCount === 1) {
      if (query.permanent) requestUrl.searchParams.set("permanent", "1")
      if (query.contract) requestUrl.searchParams.set("contract", "1")
    }

    const selectedWorkCount = [query.fullTime, query.partTime].filter(Boolean)
      .length

    if (selectedWorkCount === 1) {
      if (query.fullTime) requestUrl.searchParams.set("full_time", "1")
      if (query.partTime) requestUrl.searchParams.set("part_time", "1")
    }

    if (query.postedWithinDays > 0) {
      requestUrl.searchParams.set(
        "max_days_old",
        String(query.postedWithinDays),
      )
    }

    const response = await fetchJson(
      requestUrl.toString(),
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      "Adzuna",
    )

    const jobs = (Array.isArray(response?.results) ? response.results : [])
      .map(normaliseAdzunaJob)
      .filter((job) => matchesSelectedTypes(job, query))

    return {
      source: "adzuna",
      sourceName: "Adzuna",
      jobs,
      returned: jobs.length,
      available: toNumber(response?.count) ?? jobs.length,
    }
  }

  async function searchJooble(
    credentials,
    query,
  ) {
    const requestBody = {
      keywords:
        query.keywords ||
        "",

      location:
        query.location ||
        "",

      page:
        String(
          query.page,
        ),

      ResultOnPage:
        String(
          query.resultsPerSource,
        ),

      companysearch:
        "false",
    }

    if (
      query.location
    ) {
      requestBody.radius =
        String(
          joobleRadiusFromMiles(
            query.distance,
          ),
        )
    }

    if (
      query.minimumSalary !==
      null
    ) {
      requestBody.salary =
        Math.max(
          0,
          Math.round(
            query.minimumSalary,
          ),
        )
    }

    const response =
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
            JSON.stringify(
              requestBody,
            ),
        },

        "Jooble",
      )

    const jobs =
      (
        Array.isArray(
          response?.jobs,
        )
          ? response.jobs
          : []
      )
        .map(
          normaliseJoobleJob,
        )
        .filter(
          (job) =>
            matchesSelectedTypes(
              job,
              query,
            ),
        )

    return {
      source:
        "jooble",

      sourceName:
        "Jooble",

      jobs,

      returned:
        jobs.length,

      available:
        toNumber(
          response?.totalCount,
        ) ??
        jobs.length,
    }
  }

  async function searchArbeitnow(
    _credentials,
    query,
  ) {
    if (
      !arbeitnowLocationIsEligible(
        query.location,
      )
    ) {
      return {
        source:
          "arbeitnow",

        sourceName:
          "Arbeitnow (Germany)",

        jobs:
          [],

        returned:
          0,

        available:
          0,

        skipped:
          true,

        notice:
          `Skipped for “${query.location}”. Arbeitnow is Germany-focused and is only used when the location is blank or refers to Germany, Europe or International searches.`,

        filteredLanguageCount:
          0,
      }
    }

    const resultsPerPage =
      Math.max(
        1,
        query.resultsPerSource,
      )

    const globalOffset =
      (query.page - 1) *
      resultsPerPage

    const apiPage =
      Math.floor(
        globalOffset /
          100,
      ) +
      1

    const pageOffset =
      globalOffset %
      100

    const requestUrl =
      new URL(
        "https://www.arbeitnow.com/api/job-board-api",
      )

    const searchTerms =
      [
        query.keywords,
        arbeitnowLocationIsBroad(
          query.location,
        )
          ? ""
          : query.location,
      ]
        .filter(
          Boolean,
        )
        .join(
          " ",
        )

    if (searchTerms) {
      requestUrl.searchParams.set(
        "q",
        searchTerms,
      )
    }

    requestUrl.searchParams.set(
      "page",
      String(
        apiPage,
      ),
    )

    const response =
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

    const rawJobs =
      Array.isArray(
        response?.data,
      )
        ? response.data
        : []

    const typeCompatibleJobs =
      rawJobs
        .map(
          normaliseArbeitnowJob,
        )
        .filter(
          (job) =>
            matchesSelectedTypes(
              job,
              query,
            ),
        )

    const compatibleJobs =
      typeCompatibleJobs.filter(
        arbeitnowJobLooksEnglish,
      )

    const filteredLanguageCount =
      Math.max(
        0,
        typeCompatibleJobs.length -
          compatibleJobs.length,
      )

    const jobs =
      compatibleJobs.slice(
        pageOffset,
        pageOffset +
          resultsPerPage,
      )

    const apiPageStart =
      (apiPage - 1) *
      100

    const knownAvailable =
      apiPageStart +
      compatibleJobs.length

    const hasMore =
      Boolean(
        response?.links?.next,
      ) ||
      compatibleJobs.length >
        pageOffset +
          resultsPerPage

    return {
      source:
        "arbeitnow",

      sourceName:
        "Arbeitnow (Germany)",

      jobs,

      returned:
        jobs.length,

      available:
        hasMore
          ? Math.max(
              knownAvailable +
                1,
              globalOffset +
                jobs.length +
                1,
            )
          : Math.max(
              knownAvailable,
              globalOffset +
                jobs.length,
            ),

      skipped:
        false,

      notice:
        filteredLanguageCount >
          0
          ? `${filteredLanguageCount} likely German-language listing${filteredLanguageCount === 1 ? " was" : "s were"} hidden. Arbeitnow is Germany-focused and BreakVeil only keeps likely English listings.`
          : "Germany-focused source. BreakVeil kept likely English-language listings only.",

      filteredLanguageCount,
    }
  }

  async function searchJobicy(
    _credentials,
    query,
  ) {
    if (
      !remoteSourceLocationIsEligible(
        query.location,
      )
    ) {
      return {
        source:
          "jobicy",

        sourceName:
          "Jobicy (Remote)",

        jobs:
          [],

        returned:
          0,

        available:
          0,

        skipped:
          true,

        notice:
          `Skipped for “${query.location}”. Jobicy is a remote-only source; use Remote, UK, Europe, EMEA, Worldwide or another supported broad region.`,
      }
    }

    const feed =
      await getProviderFeed(
        "jobicy",
        async () => {
          const requestUrl =
            new URL(
              "https://jobicy.com/api/v2/remote-jobs",
            )

          requestUrl.searchParams.set(
            "count",
            "100",
          )

          return fetchJson(
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
        },
      )

    const allJobs =
      (
        Array.isArray(
          feed.payload?.jobs,
        )
          ? feed.payload.jobs
          : []
      )
        .map(
          normaliseJobicyJob,
        )
        .filter(
          (job) =>
            jobMatchesKeywords(
              job,
              query.keywords,
            ) &&
            remoteJobMatchesLocation(
              job.location,
              query.location,
            ) &&
            matchesSelectedTypes(
              job,
              query,
            ) &&
            jobMatchesSalary(
              job,
              query,
            ),
        )

    const offset =
      (query.page - 1) *
      query.resultsPerSource

    const jobs =
      allJobs.slice(
        offset,
        offset +
          query.resultsPerSource,
      )

    const cacheNotice =
      feed.cacheState ===
        "stale"
        ? " A retained feed was used because the live endpoint could not be reached."
        : feed.cacheState ===
            "fresh"
          ? " The shared feed cache was reused to avoid unnecessary requests."
          : ""

    return {
      source:
        "jobicy",

      sourceName:
        "Jobicy (Remote)",

      jobs,

      returned:
        jobs.length,

      available:
        allJobs.length,

      skipped:
        false,

      notice:
        `Remote-only public source. Jobicy publishes API listings with an intentional delay and BreakVeil refreshes its shared feed no more than once per hour.${cacheNotice}`,
    }
  }

  async function searchRemotive(
    _credentials,
    query,
  ) {
    if (
      !remoteSourceLocationIsEligible(
        query.location,
      )
    ) {
      return {
        source:
          "remotive",

        sourceName:
          "Remotive (Remote)",

        jobs:
          [],

        returned:
          0,

        available:
          0,

        skipped:
          true,

        notice:
          `Skipped for “${query.location}”. Remotive is a remote-only source; use Remote, UK, Europe, EMEA, Worldwide or another supported broad region.`,
      }
    }

    const feed =
      await getProviderFeed(
        "remotive",
        async () => {
          const requestUrl =
            new URL(
              "https://remotive.com/api/remote-jobs",
            )

          requestUrl.searchParams.set(
            "limit",
            "1000",
          )

          return fetchJson(
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
        },
      )

    const allJobs =
      (
        Array.isArray(
          feed.payload?.jobs,
        )
          ? feed.payload.jobs
          : []
      )
        .map(
          normaliseRemotiveJob,
        )
        .filter(
          (job) =>
            jobMatchesKeywords(
              job,
              query.keywords,
            ) &&
            remoteJobMatchesLocation(
              job.location,
              query.location,
            ) &&
            matchesSelectedTypes(
              job,
              query,
            ) &&
            jobMatchesSalary(
              job,
              query,
            ),
        )

    const offset =
      (query.page - 1) *
      query.resultsPerSource

    const jobs =
      allJobs.slice(
        offset,
        offset +
          query.resultsPerSource,
      )

    const cacheNotice =
      feed.cacheState ===
        "stale"
        ? " A retained feed was used because the live endpoint could not be reached."
        : feed.cacheState ===
            "fresh"
          ? " The shared feed cache was reused to respect Remotive's request guidance."
          : ""

    return {
      source:
        "remotive",

      sourceName:
        "Remotive (Remote)",

      jobs,

      returned:
        jobs.length,

      available:
        allJobs.length,

      skipped:
        false,

      notice:
        `Remote-only public source. Remotive listings are delayed by 24 hours, retain visible attribution and refresh through BreakVeil at most once every six hours.${cacheNotice}`,
    }
  }

  function sortJobs(jobs) {
    return [...jobs].sort((first, second) => {
      const firstTime = new Date(first.postedAt || 0).getTime()
      const secondTime = new Date(second.postedAt || 0).getTime()

      if (
        Number.isFinite(firstTime) &&
        Number.isFinite(secondTime) &&
        firstTime !== secondTime
      ) {
        return secondTime - firstTime
      }

      return first.title.localeCompare(second.title)
    })
  }

  async function searchSource(source, query) {
    if (
      customJobSources?.isCustomSourceId(
        source,
      )
    ) {
      return customJobSources.searchSource(
        source,
        query,
      )
    }

    if (
      directEmployerSources?.isDirectEmployerSourceId(
        source,
      )
    ) {
      return directEmployerSources.searchSource(
        source,
        query,
      )
    }

    const credentials = await getCredentials(source)

    if (source === "reed") {
      return searchReed(
        credentials,
        query,
      )
    }

    if (source === "adzuna") {
      return searchAdzuna(
        credentials,
        query,
      )
    }

    if (source === "jooble") {
      return searchJooble(
        credentials,
        query,
      )
    }

    if (source === "arbeitnow") {
      return searchArbeitnow(
        credentials,
        query,
      )
    }

    if (source === "jobicy") {
      return searchJobicy(
        credentials,
        query,
      )
    }

    if (source === "remotive") {
      return searchRemotive(
        credentials,
        query,
      )
    }

    throw new Error(
      "The selected job source is not supported.",
    )
  }

  async function runCombinedSearch(
    query,
    { forceRefresh = false } = {},
  ) {
    const healthRecord = await readJson(
      getHealthPath(),
      { version: 1, sources: {} },
    )

    const providerResults =
      await Promise.all(
        query.sources.map(
          async (
            source,
          ) => {
            let sourceName = sourceNames[source] || "Job Source"
            if (customJobSources?.isCustomSourceId(source)) {
              sourceName = await customJobSources.getSourceName(source)
            } else if (directEmployerSources?.isDirectEmployerSourceId(source)) {
              sourceName = await directEmployerSources.getSourceName(source)
            }

            const decision = refreshDecision({
              source,
              health: healthRecord?.sources?.[source],
              forceRefresh:
                forceRefresh && query.requestMode === "manual",
            })

            if (!decision.allowed) {
              return {
                ok: false,
                deferred: true,
                skipped: true,
                source,
                sourceName,
                jobs: [],
                returned: 0,
                available: 0,
                failureType: decision.reason,
                retryAt: decision.retryAt,
                retryable: true,
                notice: decision.reason === "rate-limit"
                  ? `${sourceName} reached its request allowance and is resting before BreakVeil tries again.`
                  : `${sourceName} is resting briefly before BreakVeil tries again.`,
              }
            }

            try {
              return {
                ok:
                  true,

                ...(await searchSource(
                  source,
                  query,
                )),
              }
            } catch (error) {
              const classified =
                classifySearchError(
                  error,
                  sourceName,
                )

              const retryAt = nextRetryAt({
                failureType: classified.failureType,
                consecutiveFailures:
                  Number(healthRecord?.sources?.[source]?.consecutiveFailures || 0) + 1,
                retryAfterAt: classified.retryAfterAt,
              })

              return {
                ok:
                  false,

                source,

                sourceName,

                jobs:
                  [],

                returned:
                  0,

                available:
                  0,

                error:
                  classified.message,

                failureType:
                  classified.failureType,

                retryable:
                  classified.retryable,

                statusCode:
                  classified.statusCode,

                retryAfterAt:
                  classified.retryAfterAt || "",

                retryAt,
              }
            }
          },
        ),
      )

    await updateSourceHealth(
      providerResults,
    )

    const successful =
      providerResults.filter(
        (result) =>
          result.ok,
      )

    const failed =
      providerResults.filter(
        (result) =>
          !result.ok && !result.deferred,
      )

    const deferred = providerResults.filter((result) => result.deferred)

    const rawJobs =
      successful.flatMap(
        (result) =>
          result.jobs,
      )

    const jobs =
      sortJobs(
        deduplicateJobs(
          rawJobs,
        ),
      )

    const allFailed =
      successful.length ===
      0

    const allDeferred = deferred.length === providerResults.length

    const networkState =
      allDeferred
        ? "waiting"
        : allFailed &&
      failed.length >
        0 &&
      failed.every(
        (result) =>
          [
            "network",
            "timeout",
          ].includes(
            result.failureType,
          ),
      )
        ? "offline"
        : failed.length >
            0
          ? "degraded"
          : "online"

    return {
      query,

      searchedAt:
        new Date()
          .toISOString(),

      jobs,

      total:
        jobs.length,

      rawTotal:
        rawJobs.length,

      duplicatesRemoved:
        Math.max(
          0,
          rawJobs.length -
            jobs.length,
        ),

      successfulProviderCount:
        successful.length,

      failedProviderCount:
        failed.length,

      allFailed,

      partial:
        successful.length > 0 &&
        (failed.length > 0 || deferred.length > 0),

      allDeferred,

      deferredCount:
        deferred.length,

      cacheEligible:
        failed.length === 0 && deferred.length === 0,

      networkState,

      providers:
        providerResults.map(
          (result) => ({
            source:
              result.source,

            sourceName:
              result.sourceName,

            ok:
              result.ok,

            returned:
              result.returned,

            available:
              result.available,

            error:
              result.error ||
              "",

            failureType:
              result.failureType ||
              "",

            retryable:
              result.retryable !==
              false,

            statusCode:
              Number(
                result.statusCode ||
                0,
              ),

            skipped:
              result.skipped ===
              true,

            deferred:
              result.deferred === true,

            retryAt:
              result.retryAt || "",

            notice:
              result.notice ||
              "",

            filteredLanguageCount:
              Number(
                result.filteredLanguageCount ||
                0,
              ),
          }),
        ),

      errors:
        failed.map(
          (result) => ({
            source:
              result.source,

            sourceName:
              result.sourceName,

            error:
              result.error,

            failureType:
              result.failureType,

            retryable:
              result.retryable !==
              false,

            statusCode:
              Number(
                result.statusCode ||
                0,
              ),
          }),
        ),

      attribution: {
        reed: {
          label:
            "Jobs on Reed",

          url:
            "https://www.reed.co.uk/jobs",
        },

        adzuna: {
          label:
            "Jobs by Adzuna",

          url:
            "https://www.adzuna.co.uk/",
        },

        jooble: {
          label:
            "Jobs via Jooble",

          url:
            "https://jooble.org/",
        },

        arbeitnow: {
          label:
            "English-friendly jobs in Germany via Arbeitnow",

          url:
            "https://www.arbeitnow.com/",
        },

        jobicy: {
          label:
            "Remote jobs via Jobicy",

          url:
            "https://jobicy.com/",
        },

        remotive: {
          label:
            "Remote jobs via Remotive",

          url:
            "https://remotive.com/remote-jobs",
        },
      },
    }
  }

  function buildCacheKey(
    query,
  ) {
    return crypto
      .createHash(
        "sha256",
      )
      .update(
        JSON.stringify({
          version:
            FULL_DESCRIPTION_ENRICHMENT_VERSION,

          query,
        }),
      )
      .digest(
        "hex",
      )
  }

  async function readRetainedCacheEntries() {
    const cache =
      await readJson(
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
      (
        Array.isArray(
          cache?.entries,
        )
          ? cache.entries
          : []
      )
        .filter(
          (entry) => {
            const createdAt =
              new Date(
                entry?.createdAt ||
                0,
              ).getTime()

            const staleUntil =
              new Date(
                entry?.staleUntil ||
                (
                  Number.isFinite(
                    createdAt,
                  )
                    ? new Date(
                        createdAt +
                          CACHE_STALE_RETENTION_MS,
                      ).toISOString()
                    : 0
                ),
              ).getTime()

            return (
              Number.isFinite(
                staleUntil,
              ) &&
              staleUntil >
                now
            )
          },
        )
        .sort(
          (
            first,
            second,
          ) =>
            new Date(
              second.createdAt ||
              0,
            ).getTime() -
            new Date(
              first.createdAt ||
              0,
            ).getTime(),
        )
        .slice(
          0,
          MAX_CACHE_ENTRIES,
        )

    if (
      entries.length !==
      (
        cache?.entries ||
        []
      ).length
    ) {
      await writeJson(
        getCachePath(),
        {
          version:
            2,

          entries,
        },
      )
    }

    return entries
  }

  async function getFreshCachedResult(
    cacheKey,
  ) {
    const now =
      Date.now()

    const entries =
      await readRetainedCacheEntries()

    return (
      entries.find(
        (entry) => {
          const expiresAt =
            new Date(
              entry?.expiresAt ||
              0,
            ).getTime()

          return (
            entry.key ===
              cacheKey &&
            entry.freshEligible !==
              false &&
            Number.isFinite(
              expiresAt,
            ) &&
            expiresAt >
              now
          )
        },
      ) ||
      null
    )
  }

  async function getFallbackCachedResult(
    cacheKey,
  ) {
    const entries =
      await readRetainedCacheEntries()

    return (
      entries.find(
        (entry) =>
          entry.key ===
          cacheKey,
      ) ||
      null
    )
  }

  async function saveCachedResult(
    cacheKey,
    query,
    result,
    {
      freshEligible =
        true,
    } = {},
  ) {
    const entries =
      await readRetainedCacheEntries()

    const createdAt =
      new Date()

    const newEntry = {
      key:
        cacheKey,

      query,

      createdAt:
        createdAt
          .toISOString(),

      expiresAt:
        new Date(
          createdAt.getTime() +
          cacheTtlMs(query.sources),
        ).toISOString(),

      staleUntil:
        new Date(
          createdAt.getTime() +
          CACHE_STALE_RETENTION_MS,
        ).toISOString(),

      freshEligible,

      partial:
        Boolean(
          result.partial,
        ),

      result,
    }

    await writeJson(
      getCachePath(),
      {
        version:
          2,

        entries: [
          newEntry,

          ...entries.filter(
            (entry) =>
              entry.key !==
              cacheKey,
          ),
        ].slice(
          0,
          MAX_CACHE_ENTRIES,
        ),
      },
    )

    return newEntry
  }

  function buildFailureMessage(
    result,
  ) {
    return (
      result.errors
        .map(
          (entry) =>
            `${entry.sourceName}: ${entry.error}`,
        )
        .join(
          " ",
        ) ||
      "No connected job source completed the search."
    )
  }

  ipcMain.handle(
    "job-sources:search",
    async (
      _event,
      payload =
        {},
    ) => {
      try {
        const query =
          normaliseSearchRequest(
            payload,
          )

        const cacheKey =
          buildCacheKey(
            query,
          )

        if (
          payload.forceRefresh !==
          true
        ) {
          const cachedEntry =
            await getFreshCachedResult(
              cacheKey,
            )

          if (
            cachedEntry
          ) {
            return {
              ok:
                true,

              cached:
                true,

              stale:
                false,

              fallback:
                false,

              cacheCreatedAt:
                cachedEntry.createdAt,

              cacheExpiresAt:
                cachedEntry.expiresAt,

              cacheStaleUntil:
                cachedEntry.staleUntil,

              networkState:
                "cached",

              ...cachedEntry.result,
            }
          }
        }

        const result =
          await runCombinedSearch(
            query,
            {
              forceRefresh: payload.forceRefresh === true,
            },
          )

        if (
          !result.allFailed
        ) {
          const cacheEntry =
            await saveCachedResult(
              cacheKey,
              query,
              result,
              {
                freshEligible:
                  result.cacheEligible !== false,
              },
            )

          return {
            ok:
              true,

            cached:
              false,

            stale:
              false,

            fallback:
              false,

            cacheCreatedAt:
              cacheEntry.createdAt,

            cacheExpiresAt:
              cacheEntry.expiresAt,

            cacheStaleUntil:
              cacheEntry.staleUntil,

            ...result,
          }
        }

        const fallbackEntry =
          await getFallbackCachedResult(
            cacheKey,
          )

        if (
          fallbackEntry
        ) {
          return {
            ok:
              true,

            cached:
              true,

            stale:
              true,

            fallback:
              true,

            partial:
              Boolean(
                fallbackEntry.result
                  ?.partial,
              ),

            networkState:
              result.networkState,

            cacheCreatedAt:
              fallbackEntry.createdAt,

            cacheExpiresAt:
              fallbackEntry.expiresAt,

            cacheStaleUntil:
              fallbackEntry.staleUntil,

            fallbackReason:
              buildFailureMessage(
                result,
              ),

            providerFailures:
              result.errors,

            providers:
              result.providers,

            errors:
              result.errors,

            jobs:
              Array.isArray(
                fallbackEntry.result
                  ?.jobs,
              )
                ? fallbackEntry.result.jobs
                : [],

            total:
              Number(
                fallbackEntry.result
                  ?.total ||
                0,
              ),

            rawTotal:
              Number(
                fallbackEntry.result
                  ?.rawTotal ||
                0,
              ),

            duplicatesRemoved:
              Number(
                fallbackEntry.result
                  ?.duplicatesRemoved ||
                0,
              ),

            query,

            searchedAt:
              result.searchedAt,

            cachedSearchedAt:
              fallbackEntry.result
                ?.searchedAt ||
              fallbackEntry.createdAt,

            attribution:
              fallbackEntry.result
                ?.attribution ||
              result.attribution,
          }
        }

        if (result.allDeferred) {
          return {
            ok: true,
            cached: false,
            stale: false,
            fallback: false,
            ...result,
          }
        }

        return {
          ok:
            false,

          cached:
            false,

          stale:
            false,

          fallback:
            false,

          jobs:
            [],

          total:
            0,

          networkState:
            result.networkState,

          failureType:
            result.errors[0]
              ?.failureType ||
            "provider",

          retryable:
            result.errors.some(
              (entry) =>
                entry.retryable !==
                false,
            ),

          providers:
            result.providers,

          errors:
            result.errors,

          error:
            buildFailureMessage(
              result,
            ),
        }
      } catch (error) {
        const classified =
          classifySearchError(
            error,
            "Job search",
          )

        return {
          ok:
            false,

          cached:
            false,

          stale:
            false,

          fallback:
            false,

          jobs:
            [],

          total:
            0,

          networkState:
            [
              "network",
              "timeout",
            ].includes(
              classified.failureType,
            )
              ? "offline"
              : "unavailable",

          failureType:
            classified.failureType,

          retryable:
            classified.retryable,

          providers:
            [],

          errors:
            [],

          error:
            classified.message,
        }
      }
    },
  )

}

module.exports = {
  registerJobSearchEngine,
}

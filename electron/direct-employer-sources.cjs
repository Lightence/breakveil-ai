const { randomUUID } = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const {
  assertTrustedIpcSender,
  cleanSingleLine,
} = require("./custom-job-source-security.cjs")

const fileSystem = fs.promises

const SOURCE_PREFIX = "employer:"
const MAX_EMPLOYERS = 30
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15 * 1000
const MAX_LISTINGS_PER_FEED = 250
const GREENHOUSE_DETAIL_CONCURRENCY = 4
const SMARTRECRUITERS_DETAIL_CONCURRENCY = 4
const MAX_DETAIL_CANDIDATES = 50
const FEED_CACHE_TTL_MS = 15 * 60 * 1000
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000

const PLATFORM_NAMES = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  smartrecruiters: "SmartRecruiters",
}

function isDirectEmployerSourceId(value) {
  return /^employer:[0-9a-f-]{36}$/i.test(
    String(value || "").trim(),
  )
}

const HTML_ENTITY_VALUES = {
  amp: "&",
  apos: "'",
  bull: "•",
  copy: "©",
  euro: "€",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  pound: "£",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  times: "×",
  trade: "™",
}

function decodeHtmlEntities(value) {
  return String(value || "").replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]+));/gi,
    (match, decimalValue, hexadecimalValue, namedValue) => {
      if (decimalValue) {
        const codePoint = Number.parseInt(decimalValue, 10)

        return Number.isSafeInteger(codePoint) && codePoint > 0
          ? String.fromCodePoint(codePoint)
          : match
      }

      if (hexadecimalValue) {
        const codePoint = Number.parseInt(hexadecimalValue, 16)

        return Number.isSafeInteger(codePoint) && codePoint > 0
          ? String.fromCodePoint(codePoint)
          : match
      }

      return HTML_ENTITY_VALUES[String(namedValue || "").toLowerCase()] ?? match
    },
  )
}

function cleanText(value) {
  let text = String(value || "")

  /*
   * Some ATS feeds, including Greenhouse, return descriptions whose HTML is
   * entity-encoded one or more times. Decode a small, bounded number of times
   * before removing markup so tags never appear as literal text in BreakVeil.
   */
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeHtmlEntities(text)

    if (decoded === text) {
      break
    }

    text = decoded
  }

  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x2022;|&bull;/gi, "•")
    .replace(/&nbsp;|&#160;/gi, " ")
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

function normaliseUrl(value) {
  const safeValue = String(value || "").trim()

  if (!safeValue) {
    return ""
  }

  try {
    const parsed = new URL(safeValue)
    return parsed.protocol === "https:" ? parsed.toString() : ""
  } catch {
    return ""
  }
}

function normaliseDate(value) {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString()
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatSalary(minimum, maximum, currency = "GBP", interval = "") {
  const min = toNumber(minimum)
  const max = toNumber(maximum)

  if (min === null && max === null) {
    return ""
  }

  let formattedMin = ""
  let formattedMax = ""

  try {
    const formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: String(currency || "GBP").toUpperCase(),
      maximumFractionDigits: 0,
    })

    formattedMin = min === null ? "" : formatter.format(min)
    formattedMax = max === null ? "" : formatter.format(max)
  } catch {
    formattedMin = min === null ? "" : String(min)
    formattedMax = max === null ? "" : String(max)
  }

  const range =
    formattedMin && formattedMax
      ? `${formattedMin} – ${formattedMax}`
      : formattedMin
        ? `From ${formattedMin}`
        : `Up to ${formattedMax}`

  return interval ? `${range} ${interval}` : range
}

function detectRemote(...values) {
  const text = values
    .map((value) => cleanText(value).toLowerCase())
    .join(" ")

  return [
    "remote",
    "work from home",
    "home based",
    "home-based",
    "distributed",
  ].some((phrase) => text.includes(phrase))
}

function safeIdentifier(value, label) {
  const identifier = String(value || "").trim()

  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(identifier)) {
    throw new Error(`${label} could not be recognised from that careers link.`)
  }

  return identifier
}

function normaliseCareersBoardUrl(value) {
  let parsed

  try {
    parsed = new URL(String(value || "").trim())
  } catch {
    throw new Error("Enter a valid employer careers-board link.")
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Direct employer links must use HTTPS.")
  }

  if (parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    throw new Error("The careers link contains unsupported connection details.")
  }

  const hostname = parsed.hostname.toLowerCase()
  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (
    [
      "boards.greenhouse.io",
      "job-boards.greenhouse.io",
    ].includes(hostname)
  ) {
    return {
      platform: "greenhouse",
      identifier: safeIdentifier(segments[0], "Greenhouse board token"),
      region: "global",
      careersUrl: parsed.toString(),
    }
  }

  if (hostname === "jobs.lever.co" || hostname === "jobs.eu.lever.co") {
    return {
      platform: "lever",
      identifier: safeIdentifier(segments[0], "Lever site name"),
      region: hostname === "jobs.eu.lever.co" ? "eu" : "global",
      careersUrl: parsed.toString(),
    }
  }

  if (hostname === "careers.smartrecruiters.com") {
    return {
      platform: "smartrecruiters",
      identifier: safeIdentifier(
        segments[0],
        "SmartRecruiters company identifier",
      ),
      region: "global",
      careersUrl: parsed.toString(),
    }
  }

  throw new Error(
    "This careers link is not a supported Greenhouse, Lever or SmartRecruiters board.",
  )
}

function createDirectEmployerSourceService({
  app,
  getErrorMessage,
}) {
  const requestLocks = new Map()
  const feedCache = new Map()
  const detailCache = new Map()

  function friendlyError(error) {
    return typeof getErrorMessage === "function"
      ? getErrorMessage(error)
      : error?.message || "An unknown error occurred."
  }

  function getStorageFolder() {
    return path.join(app.getPath("userData"), "job-sources")
  }

  function getStoragePath() {
    return path.join(getStorageFolder(), "direct-employers.json")
  }

  async function ensureStorage() {
    await fileSystem.mkdir(getStorageFolder(), { recursive: true })
  }

  async function readRecord() {
    await ensureStorage()

    try {
      const parsed = JSON.parse(
        await fileSystem.readFile(getStoragePath(), "utf8"),
      )

      return {
        version: Number(parsed?.version || 1),
        employers: Array.isArray(parsed?.employers)
          ? parsed.employers
          : [],
      }
    } catch {
      return {
        version: 1,
        employers: [],
      }
    }
  }

  async function writeRecord(record) {
    await ensureStorage()
    await fileSystem.writeFile(
      getStoragePath(),
      JSON.stringify(record, null, 2),
      "utf8",
    )
  }

  function publicEmployer(employer) {
    return {
      id: employer.id,
      name: employer.name,
      sourceName: employer.sourceName,
      platform: employer.platform,
      platformName: PLATFORM_NAMES[employer.platform] || employer.platform,
      identifier: employer.identifier,
      region: employer.region,
      careersUrl: employer.careersUrl,
      enabled: employer.enabled !== false,
      autoDiscoveryEnabled: employer.autoDiscoveryEnabled === true,
      savedAt: employer.savedAt || "",
      updatedAt: employer.updatedAt || "",
      lastTest: employer.lastTest || null,
    }
  }

  async function listEmployers() {
    const record = await readRecord()
    return record.employers.map(publicEmployer)
  }

  async function getEmployer(sourceId) {
    const record = await readRecord()
    return record.employers.find((item) => item.id === sourceId) || null
  }

  async function getSourceName(sourceId) {
    const employer = await getEmployer(sourceId)
    return employer?.sourceName || employer?.name || "Direct Employer"
  }

  async function getStatuses() {
    const employers = await listEmployers()

    return employers.reduce((statuses, employer) => {
      statuses[employer.id] = {
        source: employer.id,
        name: employer.sourceName,
        configured: employer.enabled && employer.lastTest?.ok === true,
        connectionMode: "direct-employer",
        directEmployer: true,
        removable: true,
        platform: employer.platform,
        platformName: employer.platformName,
        companyName: employer.name,
        careersUrl: employer.careersUrl,
        enabled: employer.enabled,
        autoDiscoveryEnabled: employer.autoDiscoveryEnabled,
        savedAt: employer.savedAt,
        lastTest: employer.lastTest,
        health: null,
      }

      return statuses
    }, {})
  }

  async function fetchJson(requestUrl, sourceName) {
    const parsed = new URL(requestUrl)

    if (parsed.protocol !== "https:") {
      throw new Error(`${sourceName} attempted an insecure request.`)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "BreakVeilAI/0.3 DirectEmployerFeed",
        },
      })

      if (response.status >= 300 && response.status < 400) {
        throw new Error(`${sourceName} returned an unexpected redirect.`)
      }

      const contentLength = Number(response.headers.get("content-length") || 0)

      if (contentLength > MAX_RESPONSE_BYTES) {
        throw new Error(`${sourceName} returned more data than BreakVeil allows.`)
      }

      const responseText = await response.text()

      if (Buffer.byteLength(responseText, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error(`${sourceName} returned more data than BreakVeil allows.`)
      }

      let responseData

      try {
        responseData = responseText ? JSON.parse(responseText) : null
      } catch {
        throw new Error(`${sourceName} did not return valid JSON.`)
      }

      if (!response.ok) {
        const detail = cleanSingleLine(
          responseData?.message ||
            responseData?.error ||
            "",
          240,
        )

        throw new Error(
          `${sourceName} returned error ${response.status}${detail ? `: ${detail}` : "."}`,
        )
      }

      return responseData
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`${sourceName} did not respond within 15 seconds.`)
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function getGreenhouseListUrl(employer) {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      employer.identifier,
    )}/jobs`
  }

  function getGreenhouseDetailUrl(employer, postingId) {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      employer.identifier,
    )}/jobs/${encodeURIComponent(postingId)}`
  }

  function getLeverUrl(employer) {
    const apiHost = employer.region === "eu"
      ? "api.eu.lever.co"
      : "api.lever.co"

    return `https://${apiHost}/v0/postings/${encodeURIComponent(
      employer.identifier,
    )}?mode=json&limit=${MAX_LISTINGS_PER_FEED}`
  }

  function getSmartRecruitersUrl(employer) {
    return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(
      employer.identifier,
    )}/postings?limit=100&offset=0`
  }

  async function fetchEmployerListings(
    employer,
    {
      forceRefresh = false,
    } = {},
  ) {
    const cached = feedCache.get(employer.id)

    if (
      !forceRefresh &&
      cached &&
      cached.expiresAt > Date.now()
    ) {
      return cached.listings
    }

    const sourceName = employer.sourceName || employer.name
    let listings

    if (employer.platform === "greenhouse") {
      /*
       * Greenhouse can return every full job description in one response when
       * content=true. Large employers can legitimately exceed BreakVeil's
       * response-size safety limit, so the feed request intentionally retrieves
       * lightweight listing summaries. Full descriptions are fetched later only
       * for the small set of vacancies relevant to the user's search.
       */
      const payload = await fetchJson(
        getGreenhouseListUrl(employer),
        sourceName,
      )
      listings = Array.isArray(payload?.jobs) ? payload.jobs : []
    }
    else if (employer.platform === "lever") {
      const payload = await fetchJson(getLeverUrl(employer), sourceName)
      listings = Array.isArray(payload) ? payload : []
    }
    else if (employer.platform === "smartrecruiters") {
      const payload = await fetchJson(
        getSmartRecruitersUrl(employer),
        sourceName,
      )
      listings = Array.isArray(payload?.content) ? payload.content : []
    }
    else {
      throw new Error("The direct-employer platform is not supported.")
    }

    const safeListings = listings.slice(0, MAX_LISTINGS_PER_FEED)
    feedCache.set(employer.id, {
      expiresAt: Date.now() + FEED_CACHE_TTL_MS,
      listings: safeListings,
    })

    return safeListings
  }

  function greenhouseJob(rawJob, employer) {
    const providerId = String(rawJob?.id || "").trim()
    const title = cleanText(rawJob?.title)
    const location = cleanText(rawJob?.location?.name)
    const description = cleanText(rawJob?.content)
    const applyUrl = normaliseUrl(rawJob?.absolute_url)
    const departments = Array.isArray(rawJob?.departments)
      ? rawJob.departments.map((item) => cleanText(item?.name)).filter(Boolean)
      : []

    return buildJob({
      employer,
      providerId,
      title,
      location,
      description,
      applyUrl,
      postedAt: rawJob?.updated_at,
      contractType: "",
      salaryText: "",
      isRemote: detectRemote(location, title, description),
      department: departments.join(", "),
    })
  }

  function leverDescription(rawJob) {
    const listSections = Array.isArray(rawJob?.lists)
      ? rawJob.lists
          .map((section) => {
            const heading = cleanText(section?.text)
            const content = cleanText(section?.content)
            return [heading, content].filter(Boolean).join("\n")
          })
          .filter(Boolean)
      : []

    return [
      cleanText(rawJob?.descriptionPlain || rawJob?.description),
      ...listSections,
      cleanText(rawJob?.additionalPlain || rawJob?.additional),
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  function leverJob(rawJob, employer) {
    const providerId = String(rawJob?.id || "").trim()
    const categories = rawJob?.categories || {}
    const location = cleanText(categories?.location || rawJob?.workplaceType)
    const description = leverDescription(rawJob)
    const applyUrl = normaliseUrl(rawJob?.hostedUrl || rawJob?.applyUrl)
    const salaryRange = rawJob?.salaryRange || {}
    const salaryText =
      cleanText(rawJob?.salaryDescriptionPlain) ||
      formatSalary(
        salaryRange?.min,
        salaryRange?.max,
        salaryRange?.currency,
        salaryRange?.interval,
      )

    return buildJob({
      employer,
      providerId,
      title: cleanText(rawJob?.text),
      location,
      description,
      applyUrl,
      postedAt: rawJob?.createdAt,
      contractType: cleanText(categories?.commitment),
      salaryText,
      isRemote:
        String(rawJob?.workplaceType || "").toLowerCase() === "remote" ||
        detectRemote(location, rawJob?.text, description),
      department: cleanText(categories?.team || categories?.department),
    })
  }

  function smartRecruitersLocation(location = {}) {
    return [
      cleanText(location?.city),
      cleanText(location?.region),
      cleanText(location?.country),
    ]
      .filter(Boolean)
      .join(", ")
  }

  function smartRecruitersDescription(rawJob) {
    const sections = rawJob?.jobAd?.sections || rawJob?.sections || {}

    if (Array.isArray(sections)) {
      return sections
        .map((section) =>
          [cleanText(section?.title), cleanText(section?.text)].filter(Boolean).join("\n"),
        )
        .filter(Boolean)
        .join("\n\n")
    }

    return Object.values(sections || {})
      .map((section) => cleanText(section?.text || section))
      .filter(Boolean)
      .join("\n\n")
  }

  function smartRecruitersSalary(rawJob) {
    const compensation = rawJob?.compensation || rawJob?.jobAd?.compensation

    if (!compensation) {
      return ""
    }

    return (
      cleanText(compensation?.description) ||
      formatSalary(
        compensation?.minimum || compensation?.min,
        compensation?.maximum || compensation?.max,
        compensation?.currency,
        compensation?.frequency || compensation?.interval,
      )
    )
  }

  function smartRecruitersJob(rawJob, employer) {
    const providerId = String(rawJob?.uuid || rawJob?.id || "").trim()
    const location = smartRecruitersLocation(rawJob?.location)
    const description = smartRecruitersDescription(rawJob)
    const applyUrl = normaliseUrl(
      rawJob?.applyUrl ||
        rawJob?.jobAd?.applyUrl ||
        `https://jobs.smartrecruiters.com/${encodeURIComponent(
          employer.identifier,
        )}/${encodeURIComponent(providerId)}`,
    )

    return buildJob({
      employer,
      providerId,
      title: cleanText(rawJob?.name),
      location,
      description,
      applyUrl,
      postedAt: rawJob?.releasedDate,
      contractType: cleanText(rawJob?.typeOfEmployment?.label),
      salaryText: smartRecruitersSalary(rawJob),
      isRemote:
        rawJob?.location?.remote === true ||
        rawJob?.location?.hybrid === true ||
        detectRemote(location, rawJob?.name, description),
      department: cleanText(rawJob?.department?.label),
    })
  }

  function buildJob({
    employer,
    providerId,
    title,
    location,
    description,
    applyUrl,
    postedAt,
    contractType,
    salaryText,
    isRemote,
    department,
  }) {
    if (!providerId || !title || !applyUrl) {
      return null
    }

    return {
      id: `${employer.id}:${providerId}`,
      providerId,
      source: employer.id,
      sourceName: employer.sourceName,
      provider: employer.sourceName,
      title,
      company: employer.name,
      location,
      description,
      descriptionSource: description ? "api-full" : "provider-snippet",
      salaryMin: null,
      salaryMax: null,
      salaryText,
      currency: "",
      contractType,
      workType: isRemote ? "Remote" : "",
      postedAt: normaliseDate(postedAt),
      expiresAt: "",
      url: applyUrl,
      applyUrl,
      isRemote: Boolean(isRemote),
      sourceQuality: description ? "full-description" : "provider-snippet",
      sourceQualityLabel: description ? "Full description" : "Description snippet",
      sourceListings: [
        {
          source: employer.id,
          sourceName: employer.sourceName,
          providerId,
          url: applyUrl,
        },
      ],
      sources: [employer.id],
      sourceNames: [employer.sourceName],
      duplicateCount: 1,
      meta: {
        providerId,
        directEmployer: true,
        platform: employer.platform,
        platformName: PLATFORM_NAMES[employer.platform],
        department,
        careersUrl: employer.careersUrl,
      },
    }
  }

  function normaliseListings(rawListings, employer) {
    return rawListings
      .slice(0, MAX_LISTINGS_PER_FEED)
      .map((rawJob) => {
        if (employer.platform === "greenhouse") {
          return greenhouseJob(rawJob, employer)
        }

        if (employer.platform === "lever") {
          return leverJob(rawJob, employer)
        }

        return smartRecruitersJob(rawJob, employer)
      })
      .filter(Boolean)
  }

  async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length)
    let nextIndex = 0

    async function runWorker() {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(concurrency, items.length) },
        () => runWorker(),
      ),
    )

    return results
  }

  async function enrichGreenhouseListings(rawListings, employer) {
    const candidates = rawListings.slice(0, MAX_DETAIL_CANDIDATES)

    return mapWithConcurrency(
      candidates,
      GREENHOUSE_DETAIL_CONCURRENCY,
      async (rawJob) => {
        const postingId = String(rawJob?.id || "").trim()

        if (!postingId) {
          return rawJob
        }

        const cacheKey = `${employer.id}:greenhouse:${postingId}`
        const cached = detailCache.get(cacheKey)

        if (cached && cached.expiresAt > Date.now()) {
          return {
            ...rawJob,
            ...(cached.detail || {}),
          }
        }

        try {
          const detail = await fetchJson(
            getGreenhouseDetailUrl(employer, postingId),
            employer.sourceName,
          )

          detailCache.set(cacheKey, {
            expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
            detail,
          })

          return {
            ...rawJob,
            ...(detail || {}),
          }
        } catch {
          /*
           * A single removed or temporarily unavailable vacancy must not make
           * the employer feed fail. The summary remains usable and clearly
           * carries no full description.
           */
          return rawJob
        }
      },
    )
  }

  async function enrichSmartRecruitersListings(rawListings, employer) {
    const candidates = rawListings.slice(0, 50)

    return mapWithConcurrency(
      candidates,
      SMARTRECRUITERS_DETAIL_CONCURRENCY,
      async (rawJob) => {
        const postingId = String(rawJob?.uuid || rawJob?.id || "").trim()

        if (!postingId) {
          return rawJob
        }

        const cacheKey = `${employer.id}:${postingId}`
        const cached = detailCache.get(cacheKey)

        if (cached && cached.expiresAt > Date.now()) {
          return {
            ...rawJob,
            ...(cached.detail || {}),
          }
        }

        try {
          const detail = await fetchJson(
            `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(
              employer.identifier,
            )}/postings/${encodeURIComponent(postingId)}`,
            employer.sourceName,
          )

          detailCache.set(cacheKey, {
            expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
            detail,
          })

          return {
            ...rawJob,
            ...(detail || {}),
          }
        } catch {
          return rawJob
        }
      },
    )
  }

  function matchesQuery(
    job,
    query,
    {
      ignoreKeywords = false,
    } = {},
  ) {
    const keywordToken = normaliseToken(query.keywords)
    const locationToken = normaliseToken(query.location)

    if (keywordToken && !ignoreKeywords) {
      const haystack = normaliseToken(
        [
          job.title,
          job.company,
          job.location,
          job.description,
          job.contractType,
          job.meta?.department,
        ].join(" "),
      )

      const words = keywordToken.split(" ").filter(Boolean)

      if (!words.every((word) => haystack.includes(word))) {
        return false
      }
    }

    if (locationToken) {
      const remoteSearch = [
        "remote",
        "work from home",
        "home based",
      ].some((phrase) => locationToken.includes(phrase))

      if (remoteSearch) {
        if (!job.isRemote) {
          return false
        }
      } else {
        const locationHaystack = normaliseToken(
          `${job.location} ${job.description}`,
        )

        if (!locationHaystack.includes(locationToken)) {
          return false
        }
      }
    }

    const contractSelections = [
      query.permanent ? "permanent" : "",
      query.contract ? "contract" : "",
      query.temporary ? "temporary" : "",
    ].filter(Boolean)

    if (
      contractSelections.length > 0 &&
      job.contractType &&
      !contractSelections.some((selection) =>
        normaliseToken(job.contractType).includes(selection),
      )
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

  function selectGreenhouseDetailCandidates(
    rawListings,
    employer,
    query,
  ) {
    const summaries = normaliseListings(rawListings, employer)
    const eligible = summaries.filter((job) =>
      matchesQuery(job, query, {
        ignoreKeywords: true,
      }),
    )
    const keywordMatches = eligible.filter((job) =>
      matchesQuery(job, query),
    )
    const desiredCount = Math.min(
      MAX_DETAIL_CANDIDATES,
      Math.max(
        Number(query.resultsPerSource || 0) * 2,
        20,
      ),
    )
    const selectedJobs = (
      keywordMatches.length > 0
        ? keywordMatches
        : eligible
    ).slice(0, desiredCount)
    const selectedIds = new Set(
      selectedJobs.map((job) => job.providerId),
    )

    return rawListings.filter((rawJob) =>
      selectedIds.has(String(rawJob?.id || "").trim()),
    )
  }

  async function testEmployer(employer) {
    const rawListings = await fetchEmployerListings(
      employer,
      {
        forceRefresh: true,
      },
    )
    const normalised = normaliseListings(rawListings, employer)

    if (rawListings.length > 0 && normalised.length === 0) {
      throw new Error(
        `${employer.sourceName} returned jobs, but BreakVeil could not read their required fields.`,
      )
    }

    return {
      ok: true,
      testedAt: new Date().toISOString(),
      available: rawListings.length,
      message: `${employer.sourceName} connected successfully. ${rawListings.length} published vacancy${rawListings.length === 1 ? "" : "ies"} detected.`,
    }
  }

  async function addAndTest(payload = {}) {
    const record = await readRecord()

    if (record.employers.length >= MAX_EMPLOYERS) {
      throw new Error(`BreakVeil supports up to ${MAX_EMPLOYERS} direct employers.`)
    }

    const name = cleanSingleLine(payload.name, 80)

    if (!name) {
      throw new Error("Enter the employer name.")
    }

    const board = normaliseCareersBoardUrl(payload.careersUrl)
    const duplicate = record.employers.find(
      (item) =>
        item.platform === board.platform &&
        item.identifier.toLowerCase() === board.identifier.toLowerCase() &&
        item.region === board.region,
    )

    if (duplicate) {
      throw new Error(`${duplicate.name} is already on the employer watchlist.`)
    }

    const now = new Date().toISOString()
    const employer = {
      id: `${SOURCE_PREFIX}${randomUUID()}`,
      name,
      sourceName: `${name} Careers`,
      platform: board.platform,
      identifier: board.identifier,
      region: board.region,
      careersUrl: board.careersUrl,
      enabled: true,
      autoDiscoveryEnabled: false,
      savedAt: now,
      updatedAt: now,
      lastTest: null,
    }

    employer.lastTest = await testEmployer(employer)
    record.employers.push(employer)
    await writeRecord(record)

    return publicEmployer(employer)
  }

  async function retest(sourceId) {
    const record = await readRecord()
    const employer = record.employers.find((item) => item.id === sourceId)

    if (!employer) {
      throw new Error("The direct employer could not be found.")
    }

    try {
      employer.lastTest = await testEmployer(employer)
    } catch (error) {
      employer.lastTest = {
        ok: false,
        testedAt: new Date().toISOString(),
        error: friendlyError(error),
      }
    }

    employer.updatedAt = new Date().toISOString()
    await writeRecord(record)
    return publicEmployer(employer)
  }

  async function setPermissions(sourceId, changes = {}) {
    const record = await readRecord()
    const employer = record.employers.find((item) => item.id === sourceId)

    if (!employer) {
      throw new Error("The direct employer could not be found.")
    }

    if (Object.prototype.hasOwnProperty.call(changes, "enabled")) {
      employer.enabled = changes.enabled === true
    }

    if (Object.prototype.hasOwnProperty.call(changes, "autoDiscoveryEnabled")) {
      employer.autoDiscoveryEnabled = changes.autoDiscoveryEnabled === true
    }

    employer.updatedAt = new Date().toISOString()
    await writeRecord(record)
    return publicEmployer(employer)
  }

  async function remove(sourceId) {
    const record = await readRecord()
    const nextEmployers = record.employers.filter((item) => item.id !== sourceId)

    if (nextEmployers.length === record.employers.length) {
      throw new Error("The direct employer could not be found.")
    }

    await writeRecord({
      ...record,
      employers: nextEmployers,
    })

    feedCache.delete(sourceId)

    for (const key of detailCache.keys()) {
      if (key.startsWith(`${sourceId}:`)) {
        detailCache.delete(key)
      }
    }
  }

  async function searchSource(sourceId, query) {
    const employer = await getEmployer(sourceId)

    if (!employer) {
      throw new Error("The direct employer could not be found.")
    }

    if (!employer.enabled || !employer.lastTest?.ok) {
      return {
        source: employer.id,
        sourceName: employer.sourceName,
        jobs: [],
        returned: 0,
        available: 0,
        skipped: true,
        skippedReason: "This direct employer is disabled or needs a successful retest.",
      }
    }

    if (
      query.requestMode === "automatic" &&
      employer.autoDiscoveryEnabled !== true
    ) {
      return {
        source: employer.id,
        sourceName: employer.sourceName,
        jobs: [],
        returned: 0,
        available: 0,
        skipped: true,
        skippedReason:
          "Automatic Discovery permission is disabled for this employer.",
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
      let rawListings = await fetchEmployerListings(employer)

      if (employer.platform === "greenhouse") {
        rawListings = selectGreenhouseDetailCandidates(
          rawListings,
          employer,
          query,
        )
        rawListings = await enrichGreenhouseListings(
          rawListings,
          employer,
        )
      }

      if (employer.platform === "smartrecruiters") {
        const roughJobs = normaliseListings(rawListings, employer)
          .filter((job) => matchesQuery(job, query))
          .slice(0, Math.max(query.resultsPerSource, 10))

        const allowedIds = new Set(roughJobs.map((job) => job.providerId))
        rawListings = rawListings.filter((rawJob) =>
          allowedIds.has(String(rawJob?.uuid || rawJob?.id || "").trim()),
        )
        rawListings = await enrichSmartRecruitersListings(rawListings, employer)
      }

      const matchingJobs = normaliseListings(rawListings, employer)
        .filter((job) => matchesQuery(job, query))

      return {
        source: employer.id,
        sourceName: employer.sourceName,
        jobs: matchingJobs.slice(0, query.resultsPerSource),
        returned: Math.min(matchingJobs.length, query.resultsPerSource),
        available: matchingJobs.length,
      }
    } finally {
      requestLocks.delete(sourceId)
      releaseLock()
    }
  }

  function registerIpc(ipcMain) {
    ipcMain.handle("direct-employer-sources:list", async (event) => {
      try {
        assertTrustedIpcSender(event)
        return {
          ok: true,
          employers: await listEmployers(),
        }
      } catch (error) {
        return {
          ok: false,
          error: friendlyError(error),
        }
      }
    })

    ipcMain.handle(
      "direct-employer-sources:add-and-test",
      async (event, payload = {}) => {
        try {
          assertTrustedIpcSender(event)
          const employer = await addAndTest(payload)
          return {
            ok: true,
            employer,
            employers: await listEmployers(),
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            employers: await listEmployers(),
          }
        }
      },
    )

    ipcMain.handle("direct-employer-sources:retest", async (event, sourceId) => {
      try {
        assertTrustedIpcSender(event)
        const employer = await retest(sourceId)
        return {
          ok: employer.lastTest?.ok === true,
          employer,
          employers: await listEmployers(),
          error: employer.lastTest?.error || "",
        }
      } catch (error) {
        return {
          ok: false,
          error: friendlyError(error),
          employers: await listEmployers(),
        }
      }
    })

    ipcMain.handle(
      "direct-employer-sources:set-permissions",
      async (event, sourceId, changes = {}) => {
        try {
          assertTrustedIpcSender(event)
          const employer = await setPermissions(sourceId, changes)
          return {
            ok: true,
            employer,
            employers: await listEmployers(),
          }
        } catch (error) {
          return {
            ok: false,
            error: friendlyError(error),
            employers: await listEmployers(),
          }
        }
      },
    )

    ipcMain.handle("direct-employer-sources:remove", async (event, sourceId) => {
      try {
        assertTrustedIpcSender(event)
        await remove(sourceId)
        return {
          ok: true,
          employers: await listEmployers(),
        }
      } catch (error) {
        return {
          ok: false,
          error: friendlyError(error),
          employers: await listEmployers(),
        }
      }
    })
  }

  return {
    getSourceName,
    getStatuses,
    isDirectEmployerSourceId,
    listEmployers,
    registerIpc,
    searchSource,
  }
}

module.exports = {
  createDirectEmployerSourceService,
  isDirectEmployerSourceId,
  __testing: {
    cleanText,
    normaliseCareersBoardUrl,
  },
}

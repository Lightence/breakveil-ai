const { safeStorage } = require("electron")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const fileSystem = fs.promises
const REQUEST_TIMEOUT_MS = 20 * 1000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 40

function registerCompanyResearch({
  app,
  ipcMain,
  getErrorMessage,
}) {
  const friendlyError = (error) =>
    typeof getErrorMessage === "function"
      ? getErrorMessage(error)
      : error?.message || "An unknown company-research error occurred."

  const cleanText = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, " ")
      .trim()

  const titleCase = (value) =>
    cleanText(value)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())

  const getStorageFolder = () =>
    path.join(app.getPath("userData"), "company-research")

  const getCredentialsPath = () =>
    path.join(getStorageFolder(), "credentials.json")

  const getCachePath = () =>
    path.join(getStorageFolder(), "research-cache.json")

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

    const temporaryPath =
      `${filePath}.tmp-${process.pid}-${Date.now()}`

    await fileSystem.writeFile(
      temporaryPath,
      JSON.stringify(value, null, 2),
      "utf8",
    )

    try {
      await fileSystem.rename(temporaryPath, filePath)
    } catch {
      await fileSystem.copyFile(temporaryPath, filePath)
      await fileSystem.unlink(temporaryPath)
    }
  }

  function encryptionAvailable() {
    try {
      return Boolean(safeStorage.isEncryptionAvailable())
    } catch {
      return false
    }
  }

  async function encryptString(value) {
    const safeValue = cleanText(value)

    if (!safeValue) {
      return null
    }

    if (!encryptionAvailable()) {
      throw new Error(
        "Secure credential encryption is unavailable on this computer.",
      )
    }

    if (
      typeof safeStorage.encryptStringAsync ===
      "function"
    ) {
      const encrypted =
        await safeStorage.encryptStringAsync(safeValue)

      return {
        mode: "async",
        data: encrypted.toString("base64"),
      }
    }

    return {
      mode: "sync",
      data:
        safeStorage
          .encryptString(safeValue)
          .toString("base64"),
    }
  }

  async function decryptString(record) {
    if (!record?.data) {
      return ""
    }

    const buffer =
      Buffer.from(record.data, "base64")

    if (
      record.mode === "async" &&
      typeof safeStorage.decryptStringAsync ===
        "function"
    ) {
      const decrypted =
        await safeStorage.decryptStringAsync(buffer)

      return decrypted.result || ""
    }

    if (!encryptionAvailable()) {
      throw new Error(
        "Secure credential decryption is unavailable.",
      )
    }

    return safeStorage.decryptString(buffer)
  }

  async function readCredentialRecord() {
    return readJson(getCredentialsPath(), {
      version: 1,
      companiesHouse: null,
    })
  }

  async function getCompaniesHouseKey() {
    const record =
      await readCredentialRecord()

    const key =
      await decryptString(
        record?.companiesHouse?.apiKey,
      )

    if (!key) {
      throw new Error(
        "Companies House is not connected. Add an API key in Settings.",
      )
    }

    return key
  }

  function companiesHouseHeaders(apiKey) {
    return {
      Authorization:
        `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    }
  }

  async function fetchJson(
    requestUrl,
    {
      headers = {},
      optional = false,
      sourceName = "Research source",
    } = {},
  ) {
    const controller =
      new AbortController()

    const timeoutId =
      setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      )

    try {
      const response =
        await fetch(requestUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...headers,
          },
          signal: controller.signal,
          redirect: "follow",
        })

      const responseText =
        await response.text()

      let data = {}

      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          data = {}
        }
      }

      if (
        optional &&
        response.status === 404
      ) {
        return null
      }

      if (!response.ok) {
        if (
          response.status === 401 ||
          response.status === 403
        ) {
          throw new Error(
            `${sourceName} rejected the saved credentials.`,
          )
        }

        if (response.status === 429) {
          throw new Error(
            `${sourceName} reached its request limit. Try again later.`,
          )
        }

        throw new Error(
          `${sourceName} returned error ${response.status}.`,
        )
      }

      return data
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          `${sourceName} did not respond within 20 seconds.`,
        )
      }

      const code =
        String(error?.cause?.code || "").toUpperCase()

      if (
        [
          "ENOTFOUND",
          "EAI_AGAIN",
          "ECONNREFUSED",
          "ECONNRESET",
          "ENETUNREACH",
          "EHOSTUNREACH",
        ].includes(code) ||
        String(error?.message || "")
          .toLowerCase()
          .includes("fetch failed")
      ) {
        throw new Error(
          `${sourceName} could not be reached. Check the internet connection and try again.`,
        )
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function buildCompaniesHouseUrl(
    companyNumber,
    suffix = "",
  ) {
    return (
      "https://find-and-update.company-information.service.gov.uk/company/" +
      encodeURIComponent(cleanText(companyNumber)) +
      suffix
    )
  }

  function formatAddress(address) {
    if (
      !address ||
      typeof address !== "object"
    ) {
      return ""
    }

    return [
      address.premises,
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country,
    ]
      .map(cleanText)
      .filter(Boolean)
      .join(", ")
  }

  function validateOfficialWebsite(value) {
    const rawValue = cleanText(value)

    if (!rawValue) {
      return ""
    }

    const parsed =
      new URL(
        /^https?:\/\//i.test(rawValue)
          ? rawValue
          : `https://${rawValue}`,
      )

    if (
      !["http:", "https:"].includes(parsed.protocol)
    ) {
      throw new Error(
        "Official website links must use HTTP or HTTPS.",
      )
    }

    return parsed.toString()
  }

  async function searchCompaniesHouse(companyName) {
    const query = cleanText(companyName)

    if (!query) {
      throw new Error(
        "Enter a company name before searching Companies House.",
      )
    }

    const apiKey =
      await getCompaniesHouseKey()

    const requestUrl =
      new URL(
        "https://api.company-information.service.gov.uk/search/companies",
      )

    requestUrl.searchParams.set("q", query)
    requestUrl.searchParams.set("items_per_page", "8")

    const data =
      await fetchJson(requestUrl.toString(), {
        sourceName: "Companies House",
        headers: companiesHouseHeaders(apiKey),
      })

    return (
      Array.isArray(data?.items)
        ? data.items
        : []
    ).map((item) => ({
      companyNumber:
        cleanText(item.company_number),

      companyName:
        cleanText(item.title),

      status:
        titleCase(item.company_status),

      companyType:
        titleCase(item.company_type),

      createdAt:
        cleanText(item.date_of_creation),

      address:
        cleanText(item.address_snippet),

      description:
        cleanText(item.description),

      url:
        buildCompaniesHouseUrl(
          item.company_number,
        ),
    }))
  }

  async function searchWikipedia(companyName) {
    const query = cleanText(companyName)

    if (!query) {
      throw new Error(
        "Enter a company name before searching Wikipedia.",
      )
    }

    const requestUrl =
      new URL("https://en.wikipedia.org/w/api.php")

    requestUrl.searchParams.set("action", "query")
    requestUrl.searchParams.set("list", "search")
    requestUrl.searchParams.set("srsearch", query)
    requestUrl.searchParams.set("srlimit", "6")
    requestUrl.searchParams.set("format", "json")
    requestUrl.searchParams.set("utf8", "1")

    const data =
      await fetchJson(requestUrl.toString(), {
        sourceName: "Wikipedia",
        headers: {
          "User-Agent":
            "BreakVeilAI/0.3.1 desktop-company-research",
        },
      })

    return (
      Array.isArray(data?.query?.search)
        ? data.query.search
        : []
    ).map((item) => ({
      pageId:
        Number(item.pageid || 0),

      title:
        cleanText(item.title),

      snippet:
        cleanText(item.snippet),

      wordCount:
        Number(item.wordcount || 0),

      url:
        `https://en.wikipedia.org/?curid=${encodeURIComponent(
          item.pageid,
        )}`,
    }))
  }

  function normaliseNewsUrl(
    value,
  ) {
    const rawValue =
      cleanText(
        value,
      )

    if (!rawValue) {
      return ""
    }

    try {
      const parsed =
        new URL(
          rawValue,
        )

      if (
        ![
          "http:",
          "https:",
        ].includes(
          parsed.protocol,
        )
      ) {
        return ""
      }

      parsed.hash = ""

      return parsed.toString()
    } catch {
      return ""
    }
  }

  function newsSourceId(
    url,
  ) {
    return `news-${crypto
      .createHash(
        "sha1",
      )
      .update(
        String(
          url ||
          "",
        ),
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        12,
      )}`
  }

  function parseGdeltDate(
    value,
  ) {
    const rawValue =
      cleanText(
        value,
      )

    if (!rawValue) {
      return ""
    }

    const compactMatch =
      rawValue.match(
        /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/,
      )

    if (
      compactMatch
    ) {
      const [
        ,
        year,
        month,
        day,
        hour =
          "00",
        minute =
          "00",
        second =
          "00",
      ] =
        compactMatch

      const parsed =
        new Date(
          `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
        )

      if (
        !Number.isNaN(
          parsed.getTime(),
        )
      ) {
        return parsed
          .toISOString()
      }
    }

    const parsed =
      new Date(
        rawValue,
      )

    return Number.isNaN(
      parsed.getTime(),
    )
      ? ""
      : parsed
          .toISOString()
  }

  function normaliseNewsArticle(
    article,
  ) {
    const url =
      normaliseNewsUrl(
        article?.url,
      )

    const title =
      cleanText(
        article?.title,
      )

    if (
      !url ||
      !title
    ) {
      return null
    }

    let domain =
      cleanText(
        article?.domain,
      )

    if (!domain) {
      try {
        domain =
          new URL(
            url,
          ).hostname
            .replace(
              /^www\./i,
              "",
            )
      } catch {
        domain =
          ""
      }
    }

    return {
      sourceId:
        newsSourceId(
          url,
        ),

      title,

      url,

      domain,

      publishedAt:
        parseGdeltDate(
          article?.publishedAt ||
          article?.seendate,
        ),

      sourceCountry:
        cleanText(
          article?.sourceCountry ||
          article?.sourcecountry,
        ),

      language:
        cleanText(
          article?.language,
        ),

      image:
        normaliseNewsUrl(
          article?.image ||
          article?.socialimage,
        ),
    }
  }

  function normaliseSelectedNews(
    value,
  ) {
    if (
      !Array.isArray(
        value,
      )
    ) {
      return []
    }

    const seen =
      new Set()

    const articles =
      []

    for (
      const item
      of value
    ) {
      const article =
        normaliseNewsArticle(
          item,
        )

      if (
        !article ||
        seen.has(
          article.url,
        )
      ) {
        continue
      }

      seen.add(
        article.url,
      )

      articles.push(
        article,
      )

      if (
        articles.length >=
        5
      ) {
        break
      }
    }

    return articles
  }

  async function searchRecentNews(
    companyName,
  ) {
    const query =
      cleanText(
        companyName,
      )

    if (
      query.length <
      2
    ) {
      throw new Error(
        "Enter a company name before searching recent news.",
      )
    }

    const escaped =
      query.replace(
        /"/g,
        "",
      )

    const requestUrl =
      new URL(
        "https://api.gdeltproject.org/api/v2/doc/doc",
      )

    requestUrl.searchParams.set(
      "query",
      `"${escaped}" sourcelang:english`,
    )

    requestUrl.searchParams.set(
      "mode",
      "artlist",
    )

    requestUrl.searchParams.set(
      "maxrecords",
      "18",
    )

    requestUrl.searchParams.set(
      "timespan",
      "30d",
    )

    requestUrl.searchParams.set(
      "sort",
      "DateDesc",
    )

    requestUrl.searchParams.set(
      "format",
      "json",
    )

    const data =
      await fetchJson(
        requestUrl.toString(),
        {
          sourceName:
            "GDELT recent-news search",

          headers: {
            "User-Agent":
              "BreakVeilAI/0.3.1 desktop-company-research",
          },
        },
      )

    const rawArticles =
      Array.isArray(
        data?.articles,
      )
        ? data.articles
        : []

    const seen =
      new Set()

    return rawArticles
      .map(
        normaliseNewsArticle,
      )
      .filter(
        (article) => {
          if (
            !article ||
            seen.has(
              article.url,
            )
          ) {
            return false
          }

          seen.add(
            article.url,
          )

          return true
        },
      )
      .slice(
        0,
        15,
      )
  }

  async function getWikipediaPage(title) {
    const safeTitle = cleanText(title)

    if (!safeTitle) {
      return null
    }

    const requestUrl =
      new URL("https://en.wikipedia.org/w/api.php")

    requestUrl.searchParams.set("action", "query")
    requestUrl.searchParams.set("prop", "extracts|info")
    requestUrl.searchParams.set("inprop", "url")
    requestUrl.searchParams.set("exintro", "1")
    requestUrl.searchParams.set("explaintext", "1")
    requestUrl.searchParams.set("redirects", "1")
    requestUrl.searchParams.set("titles", safeTitle)
    requestUrl.searchParams.set("format", "json")

    const data =
      await fetchJson(requestUrl.toString(), {
        sourceName: "Wikipedia",
        headers: {
          "User-Agent":
            "BreakVeilAI/0.3.1 desktop-company-research",
        },
      })

    const page =
      Object.values(data?.query?.pages || {})[0]

    if (
      !page ||
      page.missing !== undefined
    ) {
      return null
    }

    return {
      pageId:
        Number(page.pageid || 0),

      title:
        cleanText(page.title),

      summary:
        cleanText(page.extract),

      url:
        cleanText(page.fullurl) ||
        `https://en.wikipedia.org/?curid=${encodeURIComponent(
          page.pageid,
        )}`,
    }
  }

  async function getCompaniesHouseReport(companyNumber) {
    const safeNumber = cleanText(companyNumber)

    if (!safeNumber) {
      return null
    }

    const apiKey =
      await getCompaniesHouseKey()

    const headers =
      companiesHouseHeaders(apiKey)

    const baseUrl =
      `https://api.company-information.service.gov.uk/company/${encodeURIComponent(
        safeNumber,
      )}`

    const [
      profileResult,
      officersResult,
      pscResult,
      filingsResult,
    ] =
      await Promise.allSettled([
        fetchJson(baseUrl, {
          sourceName: "Companies House",
          headers,
        }),

        fetchJson(
          `${baseUrl}/officers?items_per_page=20`,
          {
            sourceName:
              "Companies House officers",
            headers,
            optional: true,
          },
        ),

        fetchJson(
          `${baseUrl}/persons-with-significant-control?items_per_page=20`,
          {
            sourceName:
              "Companies House persons with significant control",
            headers,
            optional: true,
          },
        ),

        fetchJson(
          `${baseUrl}/filing-history?items_per_page=10`,
          {
            sourceName:
              "Companies House filing history",
            headers,
            optional: true,
          },
        ),
      ])

    if (
      profileResult.status !== "fulfilled"
    ) {
      throw profileResult.reason
    }

    const profile = profileResult.value

    const officers =
      officersResult.status === "fulfilled"
        ? officersResult.value
        : null

    const psc =
      pscResult.status === "fulfilled"
        ? pscResult.value
        : null

    const filings =
      filingsResult.status === "fulfilled"
        ? filingsResult.value
        : null

    const activeOfficers =
      (
        Array.isArray(officers?.items)
          ? officers.items
          : []
      )
        .filter((officer) => !officer.resigned_on)
        .slice(0, 10)
        .map((officer) => ({
          name:
            cleanText(officer.name),

          role:
            titleCase(officer.officer_role),

          appointedOn:
            cleanText(officer.appointed_on),

          nationality:
            cleanText(officer.nationality),

          occupation:
            cleanText(officer.occupation),
        }))

    const significantControl =
      (
        Array.isArray(psc?.items)
          ? psc.items
          : []
      )
        .filter((person) => !person.ceased_on)
        .slice(0, 10)
        .map((person) => ({
          name:
            cleanText(person.name),

          kind:
            titleCase(person.kind),

          notifiedOn:
            cleanText(person.notified_on),

          natureOfControl:
            Array.isArray(person.natures_of_control)
              ? person.natures_of_control.map(titleCase)
              : [],
        }))

    const recentFilings =
      (
        Array.isArray(filings?.items)
          ? filings.items
          : []
      )
        .slice(0, 8)
        .map((filing) => ({
          date:
            cleanText(filing.date),

          category:
            titleCase(filing.category),

          description:
            cleanText(filing.description),

          type:
            cleanText(filing.type),

          subcategory:
            titleCase(filing.subcategory),

          transactionId:
            cleanText(filing.transaction_id),

          pages:
            Number(
              filing.pages ||
              0,
            ),

          paperFiled:
            Boolean(
              filing.paper_filed,
            ),

          documentAvailable:
            Boolean(
              filing.links
                ?.document_metadata,
            ),
        }))

    return {
      companyNumber:
        cleanText(profile.company_number),

      companyName:
        cleanText(profile.company_name),

      status:
        titleCase(profile.company_status),

      companyType:
        titleCase(profile.type),

      jurisdiction:
        titleCase(profile.jurisdiction),

      incorporationDate:
        cleanText(profile.date_of_creation),

      cessationDate:
        cleanText(profile.date_of_cessation),

      registeredOfficeAddress:
        formatAddress(profile.registered_office_address),

      sicCodes:
        Array.isArray(profile.sic_codes)
          ? profile.sic_codes.map(cleanText)
          : [],

      accounts: {
        nextDue:
          cleanText(profile.accounts?.next_due),

        nextMadeUpTo:
          cleanText(profile.accounts?.next_made_up_to),

        lastMadeUpTo:
          cleanText(
            profile.accounts?.last_accounts?.made_up_to,
          ),

        overdue:
          Boolean(profile.accounts?.overdue),
      },

      confirmationStatement: {
        nextDue:
          cleanText(
            profile.confirmation_statement?.next_due,
          ),

        lastMadeUpTo:
          cleanText(
            profile.confirmation_statement?.last_made_up_to,
          ),

        overdue:
          Boolean(
            profile.confirmation_statement?.overdue,
          ),
      },

      hasInsolvencyHistory:
        Boolean(profile.has_insolvency_history),

      activeOfficers,
      significantControl,
      recentFilings,

      filingHistoryTotalCount:
        Number(
          filings?.total_count ||
          recentFilings.length,
        ),

      sourceAvailability: {
        profile: true,
        officers:
          Boolean(officers),
        significantControl:
          Boolean(psc),
        filings:
          Boolean(filings),
      },
    }
  }

  function buildSources({
    companiesHouse,
    wikipedia,
    officialWebsite,
    newsArticles,
    retrievedAt,
  }) {
    const sources = []

    if (companiesHouse) {
      sources.push({
        id: "companies-house-profile",
        title:
          `${companiesHouse.companyName} — Company Information`,
        publisher: "Companies House",
        sourceType:
          "Official UK public register",
        trust: "official",
        url:
          buildCompaniesHouseUrl(
            companiesHouse.companyNumber,
          ),
        retrievedAt,
      })

      if (
        companiesHouse.sourceAvailability?.officers
      ) {
        sources.push({
          id: "companies-house-officers",
          title:
            `${companiesHouse.companyName} — Officers`,
          publisher: "Companies House",
          sourceType:
            "Official UK public register",
          trust: "official",
          url:
            buildCompaniesHouseUrl(
              companiesHouse.companyNumber,
              "/officers",
            ),
          retrievedAt,
        })
      }

      if (
        companiesHouse
          .sourceAvailability
          ?.significantControl
      ) {
        sources.push({
          id: "companies-house-psc",
          title:
            `${companiesHouse.companyName} — Persons with Significant Control`,
          publisher: "Companies House",
          sourceType:
            "Official UK public register",
          trust: "official",
          url:
            buildCompaniesHouseUrl(
              companiesHouse.companyNumber,
              "/persons-with-significant-control",
            ),
          retrievedAt,
        })
      }

      if (
        companiesHouse.sourceAvailability?.filings
      ) {
        sources.push({
          id: "companies-house-filings",
          title:
            `${companiesHouse.companyName} — Filing History`,
          publisher: "Companies House",
          sourceType:
            "Official UK public register",
          trust: "official",
          url:
            buildCompaniesHouseUrl(
              companiesHouse.companyNumber,
              "/filing-history",
            ),
          retrievedAt,
        })
      }
    }

    if (wikipedia) {
      sources.push({
        id: "wikipedia-overview",
        title: wikipedia.title,
        publisher: "Wikipedia",
        sourceType:
          "Community-edited overview",
        trust: "community",
        url: wikipedia.url,
        retrievedAt,
      })
    }

    if (officialWebsite?.url) {
      sources.push({
        id: "official-company-website",
        title:
          officialWebsite.title ||
          "Official Company Website",
        publisher:
          companiesHouse?.companyName ||
          wikipedia?.title ||
          "Company website",
        sourceType:
          "User-confirmed official website",
        trust: "official-site",
        url: officialWebsite.url,
        retrievedAt,
      })
    }

    for (
      const article
      of newsArticles ||
      []
    ) {
      sources.push({
        id:
          article.sourceId,

        title:
          article.title,

        publisher:
          article.domain ||
          "News publication",

        sourceType:
          "Recent news article discovered through GDELT",

        trust:
          "news",

        url:
          article.url,

        retrievedAt,

        publishedAt:
          article.publishedAt ||
          "",
      })
    }

    return sources.map((source, index) => ({
      ...source,
      number: index + 1,
    }))
  }

  function buildFacts(companiesHouse) {
    if (!companiesHouse) {
      return []
    }

    return [
      {
        id: "company-number",
        label: "Company Number",
        value: companiesHouse.companyNumber,
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "company-status",
        label: "Company Status",
        value: companiesHouse.status,
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "company-type",
        label: "Company Type",
        value: companiesHouse.companyType,
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "incorporated",
        label: "Incorporated",
        value: companiesHouse.incorporationDate,
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "registered-office",
        label: "Registered Office",
        value:
          companiesHouse.registeredOfficeAddress,
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "sic-codes",
        label: "SIC Codes",
        value:
          companiesHouse.sicCodes.join(", "),
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "accounts-next-due",
        label: "Next Accounts Due",
        value:
          companiesHouse.accounts?.nextDue,
        sourceIds: ["companies-house-profile"],
      },
      {
        id: "confirmation-next-due",
        label:
          "Next Confirmation Statement Due",
        value:
          companiesHouse
            .confirmationStatement
            ?.nextDue,
        sourceIds: ["companies-house-profile"],
      },
    ].filter((fact) => cleanText(fact.value))
  }

  async function readCache() {
    const cache =
      await readJson(getCachePath(), {
        version: 1,
        entries: [],
      })

    const now = Date.now()

    return (
      Array.isArray(cache?.entries)
        ? cache.entries
        : []
    )
      .filter(
        (entry) =>
          new Date(entry.expiresAt || 0).getTime() >
          now,
      )
      .slice(0, MAX_CACHE_ENTRIES)
  }

  async function getCachedReport(cacheKey) {
    const entries = await readCache()

    return (
      entries.find((entry) => entry.key === cacheKey) ||
      null
    )
  }

  async function saveCachedReport(
    cacheKey,
    report,
  ) {
    const entries = await readCache()
    const createdAt = new Date()

    const entry = {
      key: cacheKey,
      createdAt: createdAt.toISOString(),
      expiresAt:
        new Date(
          createdAt.getTime() + CACHE_TTL_MS,
        ).toISOString(),
      report,
    }

    await writeJson(getCachePath(), {
      version: 1,
      entries: [
        entry,
        ...entries.filter(
          (item) => item.key !== cacheKey,
        ),
      ].slice(0, MAX_CACHE_ENTRIES),
    })

    return entry
  }

  async function buildResearchReport(payload) {
    const companyNumber =
      cleanText(payload?.companyNumber)

    const wikipediaTitle =
      cleanText(payload?.wikipediaTitle)

    const officialWebsiteUrl =
      validateOfficialWebsite(
        payload?.officialWebsite?.url,
      )

    const officialWebsite = {
      url: officialWebsiteUrl,
      title:
        cleanText(payload?.officialWebsite?.title),
      note:
        cleanText(payload?.officialWebsite?.note),
    }

    const selectedNews =
      normaliseSelectedNews(
        payload?.selectedNews,
      )

    if (
      !companyNumber &&
      !wikipediaTitle &&
      !officialWebsiteUrl &&
      selectedNews.length ===
        0
    ) {
      throw new Error(
        "Select at least one research source.",
      )
    }

    const cacheKey =
      JSON.stringify({
        companyNumber,
        wikipediaTitle,
        officialWebsiteUrl,
        officialWebsiteNote:
          officialWebsite.note,

        selectedNewsUrls:
          selectedNews.map(
            (article) =>
              article.url,
          ),
      })

    if (payload?.forceRefresh !== true) {
      const cached =
        await getCachedReport(cacheKey)

      if (cached) {
        return {
          ...cached.report,
          cached: true,
          cacheCreatedAt: cached.createdAt,
          cacheExpiresAt: cached.expiresAt,
        }
      }
    }

    const [
      companiesHouseResult,
      wikipediaResult,
    ] =
      await Promise.allSettled([
        companyNumber
          ? getCompaniesHouseReport(companyNumber)
          : Promise.resolve(null),

        wikipediaTitle
          ? getWikipediaPage(wikipediaTitle)
          : Promise.resolve(null),
      ])

    if (
      companiesHouseResult.status === "rejected" &&
      wikipediaResult.status === "rejected" &&
      !officialWebsiteUrl
    ) {
      throw new Error(
        `${friendlyError(
          companiesHouseResult.reason,
        )} ${friendlyError(
          wikipediaResult.reason,
        )}`,
      )
    }

    const companiesHouse =
      companiesHouseResult.status === "fulfilled"
        ? companiesHouseResult.value
        : null

    const wikipedia =
      wikipediaResult.status === "fulfilled"
        ? wikipediaResult.value
        : null

    const retrievedAt =
      new Date().toISOString()

    const report = {
      version: 3,
      researchId:
        globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`,
      createdAt: retrievedAt,
      refreshedAt: retrievedAt,

      researchedCompanyName:
        companiesHouse?.companyName ||
        wikipedia?.title ||
        cleanText(payload?.companyName),

      selectedSources: {
        companyNumber,
        wikipediaTitle,
        officialWebsite,

        newsUrls:
          selectedNews.map(
            (article) =>
              article.url,
          ),
      },

      companiesHouse,
      wikipedia,
      officialWebsite,

      news: {
        provider:
          "GDELT DOC 2.0",

        searchWindow:
          "30 days",

        selectedAt:
          retrievedAt,

        articles:
          selectedNews,
      },

      facts:
        buildFacts(companiesHouse),

      sources:
        buildSources({
          companiesHouse,
          wikipedia,
          officialWebsite,

          newsArticles:
            selectedNews,

          retrievedAt,
        }),

      warnings: [
        companiesHouseResult.status === "rejected"
          ? friendlyError(companiesHouseResult.reason)
          : "",
        wikipediaResult.status === "rejected"
          ? friendlyError(wikipediaResult.reason)
          : "",
        wikipedia
          ? "Wikipedia is community-edited and should be checked against official company sources for important claims."
          : "",

        selectedNews.length >
          0
          ? "Recent news is third-party reporting discovered through GDELT. Read the original article before relying on important claims."
          : "",
      ].filter(Boolean),

      cached: false,
    }

    const cacheEntry =
      await saveCachedReport(cacheKey, report)

    return {
      ...report,
      cacheCreatedAt: cacheEntry.createdAt,
      cacheExpiresAt: cacheEntry.expiresAt,
    }
  }

  async function buildStatus() {
    const record =
      await readCredentialRecord()

    return {
      encryptionAvailable:
        encryptionAvailable(),

      companiesHouse: {
        configured:
          Boolean(
            record?.companiesHouse?.apiKey?.data,
          ),

        savedAt:
          cleanText(
            record?.companiesHouse?.savedAt,
          ),

        lastTest:
          record?.companiesHouse?.lastTest ||
          null,
      },
    }
  }

  async function testCompaniesHouseKey(apiKey) {
    const requestUrl =
      new URL(
        "https://api.company-information.service.gov.uk/search/companies",
      )

    requestUrl.searchParams.set("q", "company")
    requestUrl.searchParams.set(
      "items_per_page",
      "1",
    )

    const data =
      await fetchJson(requestUrl.toString(), {
        sourceName: "Companies House",
        headers: companiesHouseHeaders(apiKey),
      })

    return {
      ok: true,
      testedAt:
        new Date().toISOString(),
      message:
        `Companies House connected successfully. ${Number(
          data?.total_results || 0,
        ).toLocaleString(
          "en-GB",
        )} company records matched the test query.`,
    }
  }

  ipcMain.handle(
    "company-research:get-status",
    async () => {
      try {
        return {
          ok: true,
          status: await buildStatus(),
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
    "company-research:save-companies-house",
    async (_event, payload = {}) => {
      try {
        const record =
          await readCredentialRecord()

        const existingKey =
          await decryptString(
            record?.companiesHouse?.apiKey,
          )

        const apiKey =
          cleanText(payload.apiKey) ||
          existingKey

        if (!apiKey) {
          throw new Error(
            "Enter a Companies House API key.",
          )
        }

        const testResult =
          await testCompaniesHouseKey(apiKey)

        record.companiesHouse = {
          apiKey:
            await encryptString(apiKey),
          savedAt:
            new Date().toISOString(),
          lastTest: testResult,
        }

        await writeJson(
          getCredentialsPath(),
          record,
        )

        return {
          ok: true,
          test: testResult,
          status: await buildStatus(),
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
    "company-research:test-companies-house",
    async () => {
      try {
        const apiKey =
          await getCompaniesHouseKey()

        const testResult =
          await testCompaniesHouseKey(apiKey)

        const record =
          await readCredentialRecord()

        record.companiesHouse = {
          ...(record.companiesHouse || {}),
          lastTest: testResult,
        }

        await writeJson(
          getCredentialsPath(),
          record,
        )

        return {
          ok: true,
          test: testResult,
          status: await buildStatus(),
        }
      } catch (error) {
        const testResult = {
          ok: false,
          testedAt:
            new Date().toISOString(),
          error: friendlyError(error),
        }

        const record =
          await readCredentialRecord()

        if (record.companiesHouse) {
          record.companiesHouse = {
            ...record.companiesHouse,
            lastTest: testResult,
          }

          await writeJson(
            getCredentialsPath(),
            record,
          )
        }

        return {
          ok: false,
          error: testResult.error,
          test: testResult,
          status: await buildStatus(),
        }
      }
    },
  )

  ipcMain.handle(
    "company-research:remove-companies-house",
    async () => {
      try {
        const record =
          await readCredentialRecord()

        record.companiesHouse = null

        await writeJson(
          getCredentialsPath(),
          record,
        )

        return {
          ok: true,
          status: await buildStatus(),
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
    "company-research:search-companies-house",
    async (_event, companyName) => {
      try {
        return {
          ok: true,
          results:
            await searchCompaniesHouse(companyName),
        }
      } catch (error) {
        return {
          ok: false,
          results: [],
          error: friendlyError(error),
        }
      }
    },
  )

  ipcMain.handle(
    "company-research:search-news",
    async (
      _event,
      companyName,
    ) => {
      try {
        return {
          ok:
            true,

          provider:
            "GDELT DOC 2.0",

          window:
            "30 days",

          results:
            await searchRecentNews(
              companyName,
            ),
        }
      } catch (error) {
        return {
          ok:
            false,

          provider:
            "GDELT DOC 2.0",

          results:
            [],

          error:
            friendlyError(
              error,
            ),
        }
      }
    },
  )

  ipcMain.handle(
    "company-research:search-wikipedia",
    async (_event, companyName) => {
      try {
        return {
          ok: true,
          results:
            await searchWikipedia(companyName),
        }
      } catch (error) {
        return {
          ok: false,
          results: [],
          error: friendlyError(error),
        }
      }
    },
  )

  ipcMain.handle(
    "company-research:build-report",
    async (_event, payload = {}) => {
      try {
        return {
          ok: true,
          report:
            await buildResearchReport(payload),
        }
      } catch (error) {
        return {
          ok: false,
          error: friendlyError(error),
        }
      }
    },
  )
}

module.exports = {
  registerCompanyResearch,
}

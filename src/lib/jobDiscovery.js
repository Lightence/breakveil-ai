import {
  recordJobSearchResult,
} from "./jobSourceResilience"

import {
  defaultDiscoverySourceIds,
  isSupportedJobProviderId,
} from "./jobProviders"

import {
  appendDiscoveryRunHistory,
  discoveryRunHistoryStorageKey,
  loadDiscoveryRunHistory,
} from "./discoveryRunHistory"

export {
  loadDiscoveryRunHistory,
}

const settingsStorageKey = "jobpilot.discovery-settings"
const resultsStorageKey = "jobpilot.discovery-results"
const historyStorageKey = "jobpilot.discovery-history"
const lastEventStorageKey = "jobpilot.discovery-last-event"
const jobsStorageKey = "jobpilot.jobs"
const profileStorageKey = "jobpilot.candidate-profile"

const maximumStoredResults = 100
const maximumHistoryItems = 2500
const maximumQueriesPerRun = 4

export const discoveryStorageKeys = {
  settings: settingsStorageKey,
  results: resultsStorageKey,
  history: historyStorageKey,
  runHistory: discoveryRunHistoryStorageKey,
  lastEvent: lastEventStorageKey,
}

export const defaultDiscoverySettings = {
  enabled: false,
  intervalMinutes: 180,
  minimumMatch: 70,
  distance: 15,
  minimumSalary: "",
  maximumSalary: "",
  postedWithinDays: 7,
  resultsPerSource: 20,
  sources: [
    ...defaultDiscoverySourceIds,
  ],
  keywords: "",
  locations: "",
  permanent: false,
  contract: false,
  temporary: false,
  fullTime: false,
  partTime: false,
  notificationsEnabled: true,
  lastRunAt: "",
  nextRunAt: "",
  lastError: "",
  lastResultCount: 0,
  lastRawResultCount: 0,
  lastProviderErrors: [],
  lastRunMode: "",
  lastUsedCacheAt: "",
  lastSuccessfulProviderCount: 0,
}

const skillDefinitions = [
  {
    name: "Administration",
    aliases: [
      "administration",
      "administrator",
      "administrative",
      "office admin",
    ],
  },
  {
    name: "Accounts",
    aliases: [
      "accounts",
      "accounting",
      "accounts payable",
      "accounts receivable",
    ],
  },
  {
    name: "Bookkeeping",
    aliases: [
      "bookkeeping",
      "bookkeeper",
    ],
  },
  {
    name: "Cash Handling",
    aliases: [
      "cash handling",
      "cash reconciliation",
      "till reconciliation",
    ],
  },
  {
    name: "Communication",
    aliases: [
      "communication",
      "communicate",
      "interpersonal",
    ],
  },
  {
    name: "Customer Service",
    aliases: [
      "customer service",
      "customer support",
      "customer care",
      "complaint handling",
    ],
  },
  {
    name: "Data Entry",
    aliases: [
      "data entry",
      "data input",
      "record keeping",
    ],
  },
  {
    name: "Excel",
    aliases: [
      "excel",
      "spreadsheets",
      "spreadsheet",
    ],
  },
  {
    name: "IT Support",
    aliases: [
      "it support",
      "helpdesk",
      "help desk",
      "service desk",
      "technical support",
    ],
  },
  {
    name: "Microsoft Office",
    aliases: [
      "microsoft office",
      "office 365",
      "microsoft 365",
      "word",
      "outlook",
    ],
  },
  {
    name: "Organisation",
    aliases: [
      "organisation",
      "organization",
      "organised",
      "organized",
    ],
  },
  {
    name: "Problem Solving",
    aliases: [
      "problem solving",
      "troubleshooting",
      "resolve issues",
      "issue resolution",
    ],
  },
  {
    name: "Project Management",
    aliases: [
      "project management",
      "project coordination",
      "project coordinator",
    ],
  },
  {
    name: "Sales",
    aliases: [
      "sales",
      "upselling",
      "cross selling",
    ],
  },
  {
    name: "Teamwork",
    aliases: [
      "teamwork",
      "team player",
      "working as part of a team",
    ],
  },
  {
    name: "Time Management",
    aliases: [
      "time management",
      "prioritise",
      "prioritize",
      "deadlines",
    ],
  },
  {
    name: "Training",
    aliases: [
      "training",
      "train staff",
      "coaching",
    ],
  },
  {
    name: "Written Communication",
    aliases: [
      "written communication",
      "report writing",
      "documentation",
    ],
  },
]

const excludedRolePhrases = [
  "store manager",
  "shop manager",
  "retail manager",
  "branch manager",
  "assistant store manager",
  "deputy store manager",
  "general manager retail",
]

const roleStopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "role",
  "position",
])

let activeDiscoveryRun = null

function readJson(
  storageKey,
  fallbackValue,
) {
  try {
    const storedValue =
      localStorage.getItem(
        storageKey,
      )

    return storedValue
      ? JSON.parse(storedValue)
      : fallbackValue
  } catch {
    return fallbackValue
  }
}

function writeJson(
  storageKey,
  value,
) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(value),
  )
}

function clean(value) {
  return String(value || "").trim()
}

function clampInteger(
  value,
  fallback,
  minimum,
  maximum,
) {
  const parsed =
    Number.parseInt(
      String(value),
      10,
    )

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed),
  )
}

function parseOptionalNumber(value) {
  if (
    value === null ||
    value === undefined ||
    clean(value) === ""
  ) {
    return ""
  }

  const parsed =
    Number(
      String(value).replace(
        /[^0-9.]/g,
        "",
      ),
    )

  return Number.isFinite(parsed)
    ? String(parsed)
    : ""
}

function uniqueValues(values) {
  return [
    ...new Set(
      values
        .map(clean)
        .filter(Boolean),
    ),
  ]
}

export function splitDiscoveryValues(
  value,
) {
  if (Array.isArray(value)) {
    return uniqueValues(value)
  }

  return uniqueValues(
    String(value || "").split(
      /[\n,;|]/,
    ),
  )
}

function normaliseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim()
}

function normaliseUrl(value) {
  const rawValue = clean(value)

  if (!rawValue) {
    return ""
  }

  try {
    const url = new URL(
      rawValue.startsWith(
        "http://",
      ) ||
        rawValue.startsWith(
          "https://",
        )
        ? rawValue
        : `https://${rawValue}`,
    )

    url.hash = ""

    return url.toString()
  } catch {
    return rawValue.toLowerCase()
  }
}

function canonicalRoleText(value) {
  return normaliseText(value)
    .replace(
      /\badministrative\b/g,
      "admin",
    )
    .replace(
      /\badministration\b/g,
      "admin",
    )
    .replace(
      /\badministrator\b/g,
      "admin",
    )
    .replace(
      /\baccounting\b/g,
      "accounts",
    )
    .replace(
      /\baccountant\b/g,
      "accounts",
    )
    .replace(
      /\bbookkeeper\b/g,
      "bookkeeping",
    )
    .replace(
      /\bhelp desk\b/g,
      "it support",
    )
    .replace(
      /\bhelpdesk\b/g,
      "it support",
    )
    .replace(
      /\bservice desk\b/g,
      "it support",
    )
    .replace(
      /\btechnical support\b/g,
      "it support",
    )
    .replace(
      /\bcustomer support\b/g,
      "customer service",
    )
    .replace(
      /\bcustomer care\b/g,
      "customer service",
    )
    .replace(
      /\bcustomer representative\b/g,
      "customer service",
    )
}

function roleTokens(value) {
  return canonicalRoleText(value)
    .split(" ")
    .filter(
      (token) =>
        token &&
        !roleStopWords.has(token),
    )
}

function roleSimilarity(
  firstValue,
  secondValue,
) {
  const first =
    canonicalRoleText(firstValue)

  const second =
    canonicalRoleText(secondValue)

  if (!first || !second) {
    return 0
  }

  if (first === second) {
    return 1
  }

  if (
    first.includes(second) ||
    second.includes(first)
  ) {
    return 0.9
  }

  const firstTokens =
    roleTokens(first)

  const secondTokens =
    roleTokens(second)

  if (
    firstTokens.length === 0 ||
    secondTokens.length === 0
  ) {
    return 0
  }

  const secondSet =
    new Set(secondTokens)

  const intersection =
    firstTokens.filter(
      (token) =>
        secondSet.has(token),
    ).length

  return (
    intersection /
    Math.max(
      1,
      Math.min(
        firstTokens.length,
        secondTokens.length,
      ),
    )
  )
}

function detectSkills(textValue) {
  const text =
    normaliseText(textValue)

  return skillDefinitions
    .filter((skill) =>
      skill.aliases.some(
        (alias) =>
          text.includes(
            normaliseText(alias),
          ),
      ),
    )
    .map(
      (skill) => skill.name,
    )
}

function parseNumber(value) {
  const parsedValue =
    Number(
      String(value || "").replace(
        /[^0-9.]/g,
        "",
      ),
    )

  return Number.isFinite(
    parsedValue,
  )
    ? parsedValue
    : 0
}

function getPostedAgeDays(
  postedAt,
) {
  if (!postedAt) {
    return null
  }

  const postedDate =
    new Date(postedAt)

  if (
    Number.isNaN(
      postedDate.getTime(),
    )
  ) {
    return null
  }

  return Math.max(
    0,
    Math.floor(
      (
        Date.now() -
        postedDate.getTime()
      ) /
        (
          24 *
          60 *
          60 *
          1000
        ),
    ),
  )
}

export function loadCandidateProfileForDiscovery() {
  const profile =
    readJson(
      profileStorageKey,
      {},
    )

  return (
    profile &&
    typeof profile === "object"
  )
    ? profile
    : {}
}

export function getProfileDiscoveryDefaults(
  profile =
    loadCandidateProfileForDiscovery(),
) {
  const keywords =
    splitDiscoveryValues(
      profile?.targetRoles,
    )

  const locations =
    splitDiscoveryValues(
      profile?.preferredLocations ||
        profile?.city,
    )

  if (
    keywords.length === 0 &&
    clean(
      profile?.currentJobTitle,
    )
  ) {
    keywords.push(
      clean(
        profile.currentJobTitle,
      ),
    )
  }

  return {
    keywords:
      keywords.join(", "),

    locations:
      locations.join(", "),

    minimumSalary:
      parseOptionalNumber(
        profile?.minimumSalary,
      ),
  }
}

function sanitiseSettings(
  settings = {},
) {
  const merged = {
    ...defaultDiscoverySettings,
    ...(settings || {}),
  }

  const sources =
    Array.isArray(
      merged.sources,
    )
      ? uniqueValues(
          merged.sources
            .map(
              (source) =>
                clean(source)
                  .toLowerCase(),
            )
            .filter(
              (source) =>
                isSupportedJobProviderId(
                  source,
                ),
            ),
        )
      : [
          ...defaultDiscoverySettings.sources,
        ]

  return {
    ...merged,

    enabled:
      merged.enabled === true,

    intervalMinutes:
      clampInteger(
        merged.intervalMinutes,
        180,
        60,
        1440,
      ),

    minimumMatch:
      clampInteger(
        merged.minimumMatch,
        70,
        0,
        100,
      ),

    distance:
      clampInteger(
        merged.distance,
        15,
        1,
        100,
      ),

    minimumSalary:
      parseOptionalNumber(
        merged.minimumSalary,
      ),

    maximumSalary:
      parseOptionalNumber(
        merged.maximumSalary,
      ),

    postedWithinDays:
      clampInteger(
        merged.postedWithinDays,
        7,
        0,
        30,
      ),

    resultsPerSource:
      clampInteger(
        merged.resultsPerSource,
        20,
        5,
        50,
      ),

    sources:
      sources.length > 0
        ? sources
        : [
            ...defaultDiscoverySettings.sources,
          ],

    keywords:
      clean(merged.keywords),

    locations:
      clean(merged.locations),

    permanent:
      merged.permanent === true,

    contract:
      merged.contract === true,

    temporary:
      merged.temporary === true,

    fullTime:
      merged.fullTime === true,

    partTime:
      merged.partTime === true,

    notificationsEnabled:
      merged.notificationsEnabled !==
      false,

    lastRunAt:
      clean(
        merged.lastRunAt,
      ),

    nextRunAt:
      clean(
        merged.nextRunAt,
      ),

    lastError:
      clean(
        merged.lastError,
      ),

    lastResultCount:
      clampInteger(
        merged.lastResultCount,
        0,
        0,
        100000,
      ),

    lastRawResultCount:
      clampInteger(
        merged.lastRawResultCount,
        0,
        0,
        100000,
      ),

    lastProviderErrors:
      Array.isArray(
        merged.lastProviderErrors,
      )
        ? merged.lastProviderErrors
            .slice(0, 12)
        : [],

    lastRunMode:
      clean(
        merged.lastRunMode,
      ),

    lastUsedCacheAt:
      clean(
        merged.lastUsedCacheAt,
      ),

    lastSuccessfulProviderCount:
      clampInteger(
        merged.lastSuccessfulProviderCount,
        0,
        0,
        20,
      ),
  }
}

export function loadDiscoverySettings() {
  return sanitiseSettings(
    readJson(
      settingsStorageKey,
      defaultDiscoverySettings,
    ),
  )
}

export function saveDiscoverySettings(
  changes = {},
) {
  const current =
    loadDiscoverySettings()

  const updated =
    sanitiseSettings({
      ...current,
      ...(changes || {}),
    })

  writeJson(
    settingsStorageKey,
    updated,
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:discovery-settings-updated",
    ),
  )

  return updated
}

export function calculateNextDiscoveryRun(
  intervalMinutes,
  startValue = Date.now(),
) {
  const startDate =
    startValue instanceof Date
      ? startValue
      : new Date(startValue)

  const startTime =
    Number.isNaN(
      startDate.getTime(),
    )
      ? Date.now()
      : startDate.getTime()

  return new Date(
    startTime +
      clampInteger(
        intervalMinutes,
        180,
        60,
        1440,
      ) *
        60 *
        1000,
  ).toISOString()
}

export function isDiscoveryDue(
  settings =
    loadDiscoverySettings(),
) {
  if (!settings.enabled) {
    return false
  }

  if (!settings.nextRunAt) {
    return true
  }

  const nextRunTime =
    new Date(
      settings.nextRunAt,
    ).getTime()

  return (
    !Number.isFinite(
      nextRunTime,
    ) ||
    nextRunTime <= Date.now()
  )
}

export function loadDiscoveryResults() {
  const results =
    readJson(
      resultsStorageKey,
      [],
    )

  return Array.isArray(results)
    ? results
    : []
}

export function loadDiscoveryHistory() {
  const history =
    readJson(
      historyStorageKey,
      {
        seen: [],
        dismissed: [],
      },
    )

  return {
    seen:
      Array.isArray(
        history?.seen,
      )
        ? history.seen
        : [],

    dismissed:
      Array.isArray(
        history?.dismissed,
      )
        ? history.dismissed
        : [],
  }
}

function saveDiscoveryHistory(
  history,
) {
  writeJson(
    historyStorageKey,
    {
      seen:
        uniqueValues(
          history?.seen || [],
        ).slice(
          -maximumHistoryItems,
        ),

      dismissed:
        uniqueValues(
          history?.dismissed || [],
        ).slice(
          -maximumHistoryItems,
        ),
    },
  )
}

function saveDiscoveryResults(
  results,
) {
  const safeResults =
    Array.isArray(results)
      ? results.slice(
          0,
          maximumStoredResults,
        )
      : []

  writeJson(
    resultsStorageKey,
    safeResults,
  )

  window.dispatchEvent(
    new Event(
      "jobpilot:discovery-updated",
    ),
  )

  return safeResults
}

function getRoleFingerprint(
  job,
) {
  const title =
    normaliseText(
      job?.title ||
        job?.role,
    )

  const company =
    normaliseText(
      job?.company,
    )

  const location =
    normaliseText(
      job?.location,
    )

  return title && company
    ? `role:${title}|${company}|${location}`
    : ""
}

function getDiscoveryJobFingerprintAliases(
  job,
) {
  const aliases = []

  const providerId =
    clean(job?.providerId)

  const source =
    clean(job?.source)
      .toLowerCase()

  if (
    providerId &&
    source
  ) {
    aliases.push(
      `provider:${source}:${providerId}`,
    )
  }

  if (job?.id) {
    aliases.push(
      `live:${clean(job.id)}`,
    )
  }

  const url =
    normaliseUrl(
      job?.applyUrl ||
        job?.url ||
        job?.jobUrl,
    )

  if (url) {
    aliases.push(
      `url:${url}`,
    )
  }

  const roleFingerprint =
    getRoleFingerprint(job)

  if (roleFingerprint) {
    aliases.push(
      roleFingerprint,
    )
  }

  return uniqueValues(
    aliases,
  )
}

export function getDiscoveryJobFingerprint(
  job,
) {
  const aliases =
    getDiscoveryJobFingerprintAliases(
      job,
    )

  return (
    aliases[0] ||
    `unknown:${normaliseText(
      JSON.stringify(
        job || {},
      ),
    ).slice(0, 180)}`
  )
}

function getSavedJobFingerprints() {
  const savedJobs =
    readJson(
      jobsStorageKey,
      [],
    )

  const safeJobs =
    Array.isArray(savedJobs)
      ? savedJobs
      : []

  const fingerprints =
    new Set()

  for (const job of safeJobs) {
    for (
      const fingerprint
      of getDiscoveryJobFingerprintAliases(
        job,
      )
    ) {
      fingerprints.add(
        fingerprint,
      )
    }
  }

  return fingerprints
}

function jobMatchesSavedFingerprints(
  job,
  fingerprints,
) {
  return getDiscoveryJobFingerprintAliases(
    job,
  ).some(
    (fingerprint) =>
      fingerprints.has(
        fingerprint,
      ),
  )
}

export function analyseDiscoveryJob(
  job,
  profile,
) {
  const targetRoles =
    splitDiscoveryValues(
      profile?.targetRoles,
    )

  const preferredLocations =
    splitDiscoveryValues(
      profile?.preferredLocations ||
        profile?.city,
    )

  const preferredWorkModes =
    splitDiscoveryValues(
      profile?.workModes,
    )

  const minimumSalary =
    parseNumber(
      profile?.minimumSalary,
    )

  const profileText = [
    profile?.skills,
    profile?.professionalSummary,
    profile?.strengths,
    profile?.currentJobTitle,
    profile?.targetRoles,
  ]
    .filter(Boolean)
    .join(" ")

  const jobText = [
    job?.title,
    job?.description,
    job?.category,
    job?.contractType,
    job?.workType,
  ]
    .filter(Boolean)
    .join(" ")

  const profileSkills =
    detectSkills(
      profileText,
    )

  const jobSkills =
    detectSkills(
      jobText,
    )

  const matchedSkills =
    jobSkills.filter(
      (skill) =>
        profileSkills.includes(
          skill,
        ),
    )

  const missingSkills =
    jobSkills.filter(
      (skill) =>
        !profileSkills.includes(
          skill,
        ),
    )

  let roleScore = 17
  let bestRole = ""

  if (
    targetRoles.length > 0
  ) {
    const roleMatches =
      targetRoles
        .map(
          (targetRole) => ({
            role: targetRole,

            similarity:
              roleSimilarity(
                job?.title,
                targetRole,
              ),
          }),
        )
        .sort(
          (
            first,
            second,
          ) =>
            second.similarity -
            first.similarity,
        )

    bestRole =
      roleMatches[0]?.role ||
      ""

    roleScore =
      Math.round(
        (
          roleMatches[0]
            ?.similarity ||
          0
        ) * 35,
      )
  }

  let skillScore = 15

  if (
    jobSkills.length > 0
  ) {
    skillScore =
      profileSkills.length > 0
        ? Math.round(
            (
              matchedSkills.length /
              jobSkills.length
            ) * 30,
          )
        : 5
  }

  const jobLocation =
    normaliseText(
      job?.location,
    )

  const workModeText =
    preferredWorkModes
      .map(normaliseText)
      .join(" ")

  let locationScore =
    preferredLocations.length ===
    0
      ? 10
      : 2

  let locationMatch = ""

  if (
    job?.isRemote &&
    (
      workModeText.includes(
        "remote",
      ) ||
      preferredLocations.length ===
        0
    )
  ) {
    locationScore = 15

    locationMatch =
      "Remote matches your preference"
  } else {
    const matchedLocation =
      preferredLocations.find(
        (location) => {
          const normalisedLocation =
            normaliseText(
              location,
            )

          return (
            normalisedLocation &&
            (
              jobLocation.includes(
                normalisedLocation,
              ) ||
              normalisedLocation.includes(
                jobLocation,
              )
            )
          )
        },
      )

    if (matchedLocation) {
      locationScore = 15

      locationMatch =
        `Matches ${matchedLocation}`
    } else if (
      job?.isRemote
    ) {
      locationScore = 8

      locationMatch =
        "Remote vacancy"
    }
  }

  const advertisedSalary =
    Number(
      job?.salaryMax || 0,
    ) ||
    Number(
      job?.salaryMin || 0,
    )

  let salaryScore =
    minimumSalary > 0
      ? 4
      : 8

  let salaryMessage =
    advertisedSalary > 0
      ? job?.salaryText ||
        `£${Math.round(
          advertisedSalary,
        ).toLocaleString(
          "en-GB",
        )}`
      : "Salary not listed"

  if (
    minimumSalary > 0 &&
    advertisedSalary > 0
  ) {
    if (
      advertisedSalary >=
      minimumSalary
    ) {
      salaryScore = 10

      salaryMessage =
        `${salaryMessage} meets your minimum`
    } else if (
      advertisedSalary >=
      minimumSalary * 0.9
    ) {
      salaryScore = 7

      salaryMessage =
        `${salaryMessage} is close to your minimum`
    } else if (
      advertisedSalary >=
      minimumSalary * 0.8
    ) {
      salaryScore = 4

      salaryMessage =
        `${salaryMessage} is below your minimum`
    } else {
      salaryScore = 0

      salaryMessage =
        `${salaryMessage} is well below your minimum`
    }
  }

  let workModeScore =
    preferredWorkModes.length ===
    0
      ? 5
      : 2

  if (
    job?.isRemote &&
    workModeText.includes(
      "remote",
    )
  ) {
    workModeScore = 5
  } else if (
    normaliseText(
      job?.description,
    ).includes("hybrid") &&
    workModeText.includes(
      "hybrid",
    )
  ) {
    workModeScore = 5
  } else if (
    !job?.isRemote &&
    (
      workModeText.includes(
        "on site",
      ) ||
      workModeText.includes(
        "onsite",
      ) ||
      workModeText.includes(
        "office",
      )
    )
  ) {
    workModeScore = 5
  }

  const ageDays =
    getPostedAgeDays(
      job?.postedAt,
    )

  let recencyScore = 2

  if (ageDays !== null) {
    if (ageDays <= 7) {
      recencyScore = 5
    } else if (
      ageDays <= 14
    ) {
      recencyScore = 4
    } else if (
      ageDays <= 30
    ) {
      recencyScore = 2
    } else {
      recencyScore = 0
    }
  }

  const normalisedTitle =
    normaliseText(
      job?.title,
    )

  const excludedRole =
    excludedRolePhrases.find(
      (phrase) =>
        normalisedTitle.includes(
          normaliseText(
            phrase,
          ),
        ),
    )

  const penalty =
    excludedRole
      ? 35
      : 0

  const score =
    Math.max(
      0,
      Math.min(
        100,

        roleScore +
          skillScore +
          locationScore +
          salaryScore +
          workModeScore +
          recencyScore -
          penalty,
      ),
    )

  const strengths = []
  const concerns = []

  if (roleScore >= 25) {
    strengths.push(
      bestRole
        ? `Strong title match for ${bestRole}`
        : "Strong target-role match",
    )
  } else if (
    targetRoles.length > 0
  ) {
    concerns.push(
      "The job title is not a close match to your target roles",
    )
  }

  if (
    matchedSkills.length > 0
  ) {
    strengths.push(
      `${matchedSkills.length} recognised skill${
        matchedSkills.length === 1
          ? ""
          : "s"
      } match your profile`,
    )
  }

  if (
    locationScore >= 12
  ) {
    strengths.push(
      locationMatch ||
        "Location matches your preferences",
    )
  } else if (
    preferredLocations.length >
      0 &&
    !job?.isRemote
  ) {
    concerns.push(
      "The location may be outside your preferred areas",
    )
  }

  if (salaryScore >= 8) {
    strengths.push(
      salaryMessage,
    )
  } else if (
    minimumSalary > 0
  ) {
    concerns.push(
      salaryMessage,
    )
  }

  if (
    ageDays !== null &&
    ageDays <= 7
  ) {
    strengths.push(
      "Recently posted",
    )
  }

  if (
    missingSkills.length > 0
  ) {
    concerns.push(
      `${missingSkills.length} recognised requirement${
        missingSkills.length ===
        1
          ? ""
          : "s"
      } are not listed in your profile`,
    )
  }

  if (excludedRole) {
    concerns.unshift(
      `This appears to be an excluded managerial role: ${excludedRole}`,
    )
  }

  let label =
    "Low match"

  if (score >= 85) {
    label =
      "Strong match"
  } else if (
    score >= 70
  ) {
    label =
      "Good match"
  } else if (
    score >= 50
  ) {
    label =
      "Possible match"
  }

  const profileReady =
    Boolean(
      targetRoles.length ||
        profileSkills.length ||
        preferredLocations.length ||
        minimumSalary,
    )

  return {
    score,
    label,
    profileReady,

    excludedRole:
      excludedRole || "",

    bestRole,
    roleScore,
    skillScore,
    locationScore,
    salaryScore,
    workModeScore,
    recencyScore,
    matchedSkills,
    missingSkills,
    strengths,
    concerns,
    locationMatch,
    salaryMessage,
    profileSkills,
    jobSkills,
  }
}

function buildDiscoveryQueries(
  settings,
  profile,
) {
  const profileDefaults =
    getProfileDiscoveryDefaults(
      profile,
    )

  const keywords =
    splitDiscoveryValues(
      settings.keywords ||
        profileDefaults.keywords,
    )

  const locations =
    splitDiscoveryValues(
      settings.locations ||
        profileDefaults.locations,
    ).filter(
      (location) => {
        const normalisedLocation =
          normaliseText(
            location,
          )

        return ![
          "remote",
          "hybrid",
          "home based",
          "work from home",
        ].includes(
          normalisedLocation,
        )
      },
    )

  const safeKeywords =
    keywords.length > 0
      ? keywords.slice(0, 3)
      : [""]

  const safeLocations =
    locations.length > 0
      ? locations.slice(0, 2)
      : [""]

  const queries = []

  for (
    const keyword
    of safeKeywords
  ) {
    for (
      const location
      of safeLocations
    ) {
      if (
        !keyword &&
        !location
      ) {
        continue
      }

      queries.push({
        keyword,
        location,
      })

      if (
        queries.length >=
        maximumQueriesPerRun
      ) {
        return queries
      }
    }
  }

  return queries
}

function sortDiscoveryResults(
  results,
) {
  return [
    ...results,
  ].sort(
    (
      first,
      second,
    ) => {
      const scoreDifference =
        Number(
          second
            ?.matchAnalysis
            ?.score || 0,
        ) -
        Number(
          first
            ?.matchAnalysis
            ?.score || 0,
        )

      if (
        scoreDifference !== 0
      ) {
        return scoreDifference
      }

      return (
        new Date(
          second?.postedAt ||
            second?.discoveredAt ||
            0,
        ).getTime() -
        new Date(
          first?.postedAt ||
            first?.discoveredAt ||
            0,
        ).getTime()
      )
    },
  )
}

async function performDiscoveryRun({
  forceRefresh = false,
} = {}) {
  const startedAt =
    new Date()

  const settings =
    loadDiscoverySettings()

  const profile =
    loadCandidateProfileForDiscovery()

  const queries =
    buildDiscoveryQueries(
      settings,
      profile,
    )

  if (
    queries.length === 0
  ) {
    const errorMessage =
      "Add target roles or a preferred location in Candidate Profile, or enter discovery keywords under Automation."

    saveDiscoverySettings({
      lastRunAt:
        startedAt.toISOString(),

      nextRunAt:
        calculateNextDiscoveryRun(
          settings.intervalMinutes,
          startedAt,
        ),

      lastError:
        errorMessage,

      lastResultCount: 0,
      lastRawResultCount: 0,
    })

    throw new Error(
      errorMessage,
    )
  }

  if (
    !window.jobPilot
      ?.jobSources
      ?.searchJobs
  ) {
    throw new Error(
      "The job-search service is unavailable. Fully restart BreakVeil.",
    )
  }

  let connectedSources = [
    ...settings.sources,
  ]

  if (
    window.jobPilot
      .jobSources
      .getStatus
  ) {
    try {
      const sourceStatus =
        await window.jobPilot
          .jobSources
          .getStatus()

      if (
        sourceStatus?.ok
      ) {
        connectedSources =
          settings.sources
            .filter(
              (source) =>
                sourceStatus
                  ?.sources
                  ?.[source]
                  ?.configured,
            )
      }
    } catch {
      /*
       * The search request will
       * return a clearer provider
       * error when required.
       */
    }
  }

  if (
    connectedSources.length ===
    0
  ) {
    const errorMessage =
      "Enable at least one available job source before starting job discovery."

    saveDiscoverySettings({
      lastRunAt:
        startedAt.toISOString(),

      nextRunAt:
        calculateNextDiscoveryRun(
          settings.intervalMinutes,
          startedAt,
        ),

      lastError:
        errorMessage,

      lastResultCount: 0,
      lastRawResultCount: 0,
    })

    throw new Error(
      errorMessage,
    )
  }

  const allJobs = []
  const providerErrors = []

  let successfulQueries = 0
  let staleCacheQueries = 0
  let partialQueries = 0
  let successfulProviderCount = 0

  for (
    const query
    of queries
  ) {
    try {
      const result =
        await window.jobPilot
          .jobSources
          .searchJobs({
            keywords:
              query.keyword,

            location:
              query.location,

            distance:
              settings.distance,

            minimumSalary:
              settings.minimumSalary,

            maximumSalary:
              settings.maximumSalary,

            permanent:
              settings.permanent,

            contract:
              settings.contract,

            temporary:
              settings.temporary,

            fullTime:
              settings.fullTime,

            partTime:
              settings.partTime,

            postedWithinDays:
              settings.postedWithinDays,

            resultsPerSource:
              settings.resultsPerSource,

            page: 1,

            requestMode:
              "automatic",

            sources:
              connectedSources,

            forceRefresh,
          })

      recordJobSearchResult(
        result,
      )

      if (!result?.ok) {
        providerErrors.push({
          query: [
            query.keyword,
            query.location,
          ]
            .filter(Boolean)
            .join(" in "),

          error:
            result?.error ||
            "The search did not complete.",
        })

        continue
      }

      successfulQueries += 1

      if (
        result.stale ||
        result.fallback
      ) {
        staleCacheQueries +=
          1
      }

      if (
        result.partial
      ) {
        partialQueries +=
          1
      }

      successfulProviderCount +=
        Number(
          result.successfulProviderCount ||
          (
            result.providers ||
            []
          ).filter(
            (provider) =>
              provider.ok,
          ).length,
        )

      for (
        const job
        of result.jobs || []
      ) {
        allJobs.push({
          ...job,

          discoveryQuery: {
            keyword:
              query.keyword,

            location:
              query.location,
          },
        })
      }

      for (
        const providerError
        of result.errors || []
      ) {
        providerErrors.push({
          query: [
            query.keyword,
            query.location,
          ]
            .filter(Boolean)
            .join(" in "),

          source:
            providerError
              .sourceName ||
            providerError.source,

          error:
            providerError.error,
        })
      }
    } catch (error) {
      recordJobSearchResult({
        ok:
          false,

        networkState:
          navigator.onLine
            ? "unavailable"
            : "offline",

        error:
          error?.message ||
          "The search did not complete.",
      })

      providerErrors.push({
        query: [
          query.keyword,
          query.location,
        ]
          .filter(Boolean)
          .join(" in "),

        error:
          error?.message ||
          "The search did not complete.",
      })
    }
  }

  if (
    successfulQueries === 0
  ) {
    const errorMessage =
      providerErrors
        .map(
          (entry) =>
            entry.error,
        )
        .filter(Boolean)
        .join(" ") ||
      "No background job search completed successfully."

    saveDiscoverySettings({
      lastRunAt:
        startedAt.toISOString(),

      nextRunAt:
        calculateNextDiscoveryRun(
          settings.intervalMinutes,
          startedAt,
        ),

      lastError:
        errorMessage,

      lastResultCount: 0,

      lastRawResultCount:
        allJobs.length,

      lastProviderErrors:
        providerErrors,

      lastRunMode:
        navigator.onLine
          ? "failed"
          : "offline",

      lastUsedCacheAt:
        "",

      lastSuccessfulProviderCount:
        0,
    })

    throw new Error(
      errorMessage,
    )
  }

  const jobsByFingerprint =
    new Map()

  for (
    const job
    of allJobs
  ) {
    const fingerprint =
      getRoleFingerprint(job) ||
      getDiscoveryJobFingerprint(
        job,
      )

    if (
      !jobsByFingerprint.has(
        fingerprint,
      )
    ) {
      jobsByFingerprint.set(
        fingerprint,
        job,
      )
    }
  }

  const history =
    loadDiscoveryHistory()

  const ignoredFingerprints =
    new Set([
      ...history.seen,
      ...history.dismissed,
    ])

  const savedFingerprints =
    getSavedJobFingerprints()

  const existingResults =
    loadDiscoveryResults()

  const existingFingerprints =
    new Set(
      existingResults.flatMap(
        (result) =>
          getDiscoveryJobFingerprintAliases(
            result,
          ),
      ),
    )

  const discoveredAt =
    new Date().toISOString()

  const newResults = []

  for (
    const [
      fingerprint,
      job,
    ]
    of jobsByFingerprint.entries()
  ) {
    const aliases =
      getDiscoveryJobFingerprintAliases(
        job,
      )

    if (
      aliases.some(
        (alias) =>
          ignoredFingerprints.has(
            alias,
          ),
      ) ||
      aliases.some(
        (alias) =>
          existingFingerprints.has(
            alias,
          ),
      ) ||
      jobMatchesSavedFingerprints(
        job,
        savedFingerprints,
      )
    ) {
      continue
    }

    const matchAnalysis =
      analyseDiscoveryJob(
        job,
        profile,
      )

    if (
      matchAnalysis.score <
        settings.minimumMatch ||
      Boolean(
        matchAnalysis.excludedRole,
      )
    ) {
      continue
    }

    newResults.push({
      ...job,

      discoveryId:
        typeof globalThis
          .crypto
          ?.randomUUID ===
        "function"
          ? globalThis.crypto
              .randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`,

      discoveryFingerprint:
        fingerprint,

      discoveredAt,

      matchAnalysis,
    })
  }

  const combinedResults =
    sortDiscoveryResults([
      ...newResults,
      ...existingResults,
    ]).slice(
      0,
      maximumStoredResults,
    )

  saveDiscoveryResults(
    combinedResults,
  )

  const runMode =
    staleCacheQueries >
      0
      ? "offline-cache"
      : partialQueries >
          0 ||
        providerErrors.length >
          0
        ? "partial"
        : "live"

  const updatedSettings =
    saveDiscoverySettings({
      lastRunAt:
        startedAt.toISOString(),

      nextRunAt:
        calculateNextDiscoveryRun(
          settings.intervalMinutes,
          startedAt,
        ),

      lastError:
        "",

      lastResultCount:
        newResults.length,

      lastRawResultCount:
        jobsByFingerprint.size,

      lastProviderErrors:
        providerErrors,

      lastRunMode:
        runMode,

      lastUsedCacheAt:
        staleCacheQueries >
          0
          ? startedAt
              .toISOString()
          : "",

      lastSuccessfulProviderCount:
        successfulProviderCount,
    })

  if (
    newResults.length > 0 &&
    settings.notificationsEnabled
  ) {
    const event = {
      id:
        typeof globalThis
          .crypto
          ?.randomUUID ===
        "function"
          ? globalThis.crypto
              .randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`,

      type:
        "new-job-matches",

      count:
        newResults.length,

      totalAvailable:
        combinedResults.length,

      sampleTitle:
        newResults[0]?.title ||
        "New vacancy",

      sampleCompany:
        newResults[0]?.company ||
        "",

      createdAt:
        discoveredAt,
    }

    writeJson(
      lastEventStorageKey,
      event,
    )

    window.dispatchEvent(
      new Event(
        "jobpilot:discovery-event",
      ),
    )
  }

  return {
    ok: true,
    newResults,
    results:
      combinedResults,

    newCount:
      newResults.length,

    totalCount:
      combinedResults.length,

    rawCount:
      jobsByFingerprint.size,

    queries,
    providerErrors,

    mode:
      runMode,

    staleCacheQueries,

    partialQueries,

    settings:
      updatedSettings,
  }
}

export async function runJobDiscovery(
  options = {},
) {
  if (activeDiscoveryRun) {
    return activeDiscoveryRun
  }

  const startedAt = new Date()
  const runId = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const trigger = ["manual", "scheduled", "retry"].includes(options.trigger)
    ? options.trigger
    : options.forceRefresh
      ? "manual"
      : "scheduled"
  const settingsAtStart = loadDiscoverySettings()

  activeDiscoveryRun = (async () => {
    try {
      const result = await performDiscoveryRun(options)
      const status = result.mode === "partial"
        ? "partial"
        : result.mode === "offline-cache"
          ? "cached"
          : "success"
      appendDiscoveryRunHistory({
        id: runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        trigger,
        retryOf: options.retryOf || "",
        status,
        mode: result.mode,
        queryCount: result.queries?.length || 0,
        sourceCount: settingsAtStart.sources.length,
        successfulProviderCount: result.settings?.lastSuccessfulProviderCount || 0,
        rawCount: result.rawCount,
        newCount: result.newCount,
        totalCount: result.totalCount,
        providerErrors: result.providerErrors,
      })
      return result
    } catch (error) {
      const failedSettings = loadDiscoverySettings()
      appendDiscoveryRunHistory({
        id: runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        trigger,
        retryOf: options.retryOf || "",
        status: "failed",
        mode: failedSettings.lastRunMode || "failed",
        sourceCount: settingsAtStart.sources.length,
        rawCount: failedSettings.lastRawResultCount,
        error: error?.message || "Background job discovery could not complete.",
        providerErrors: failedSettings.lastProviderErrors,
      })
      throw error
    }
  })()

  try {
    return await activeDiscoveryRun
  } finally {
    activeDiscoveryRun = null
  }
}

export function consumeDiscoveryResult(
  discoveryId,
  action = "seen",
) {
  const results =
    loadDiscoveryResults()

  const result =
    results.find(
      (item) =>
        item.discoveryId ===
        discoveryId,
    )

  if (!result) {
    return loadDiscoveryResults()
  }

  const history =
    loadDiscoveryHistory()

  const fingerprints =
    getDiscoveryJobFingerprintAliases(
      result,
    )

  if (
    action === "dismissed"
  ) {
    history.dismissed = [
      ...history.dismissed,
      ...fingerprints,
    ]
  } else {
    history.seen = [
      ...history.seen,
      ...fingerprints,
    ]
  }

  saveDiscoveryHistory(
    history,
  )

  return saveDiscoveryResults(
    results.filter(
      (item) =>
        item.discoveryId !==
        discoveryId,
    ),
  )
}

export function markAllDiscoveryResultsSeen() {
  const results =
    loadDiscoveryResults()

  const history =
    loadDiscoveryHistory()

  history.seen = [
    ...history.seen,

    ...results.flatMap(
      (result) =>
        getDiscoveryJobFingerprintAliases(
          result,
        ),
    ),
  ]

  saveDiscoveryHistory(
    history,
  )

  return saveDiscoveryResults(
    [],
  )
}

export function clearDiscoveryHistory() {
  saveDiscoveryHistory({
    seen: [],
    dismissed: [],
  })

  window.dispatchEvent(
    new Event(
      "jobpilot:discovery-updated",
    ),
  )
}

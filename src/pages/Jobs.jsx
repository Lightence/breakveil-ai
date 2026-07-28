import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useLocation,
  useNavigate,
} from "react-router-dom"

import {
  appendJobActivity,
  createJobActivity,
} from "../lib/jobActivity"

import {
  AlertTriangle,
  BellRing,
  BrainCircuit,
  Briefcase,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  ChevronRight,
  ChevronUp,
  Clock3,
  Database,
  Link2,
  ListTodo,
  ExternalLink,
  FolderOpen,
  Layers3,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Plus,
  PoundSterling,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Wifi,
  X,
} from "lucide-react"

import ConfirmDialog from "../components/ConfirmDialog"

import {
  consumeDiscoveryResult,
  loadDiscoveryResults,
  loadDiscoverySettings,
} from "../lib/jobDiscovery"

import {
  formatPreferenceDate,
  formatPreferenceDateTime,
  formatPreferenceDistance,
} from "../lib/uiPreferences"

import {
  getMatchScoreClass,
} from "../lib/semanticUi"

import {
  getHealthToneClass,
  getProviderPresentation,
  getSearchResultPresentation,
  recordJobSearchResult,
} from "../lib/jobSourceResilience"

import {
  createEmptyJobSourceMap,
  getJobProviderLabel,
  jobProviderIds,
  mergeJobSourceMap,
} from "../lib/jobProviders"


const storageKey = "jobpilot.jobs"
const profileStorageKey = "jobpilot.candidate-profile"
const assistantHandoffStorageKey = "jobpilot.assistant-handoff"
const matchInboxDecisionStorageKey = "jobpilot.match-inbox-decisions"
const jobsViewStorageKey = "jobpilot.jobs-view"
const smartMatchVisibilityStorageKey =
  "jobpilot.smart-match-visible"

const statuses = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
]

const nextActionOptions = [
  "None",
  "Review job",
  "Prepare application",
  "Submit application",
  "Follow up",
  "Prepare for interview",
  "Attend interview",
  "Send thank-you email",
  "Wait for response",
  "Other",
]

const emptyForm = {
  role: "",
  company: "",
  location: "",
  salary: "",
  status: "Saved",
  dateApplied: "",
  nextAction: "None",
  nextActionDate: "",
  followUpDate: "",
  interviewDate: "",
  interviewTime: "",
  interviewLocation: "",
  interviewLink: "",
  interviewNotes: "",
  jobUrl: "",
  contactName: "",
  contactEmail: "",
  notes: "",
}

const emptySourceStatus = {
  loading: true,
  error: "",
  sources:
    createEmptyJobSourceMap(),
}

function loadSavedJobs() {
  try {
    const savedJobs = localStorage.getItem(storageKey)
    const parsedJobs = savedJobs ? JSON.parse(savedJobs) : []

    return Array.isArray(parsedJobs) ? parsedJobs : []
  } catch {
    return []
  }
}

function loadMatchInboxDecisions() {
  try {
    const storedValue =
      localStorage.getItem(
        matchInboxDecisionStorageKey,
      )

    const parsedValue = storedValue
      ? JSON.parse(storedValue)
      : {}

    return parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
      ? parsedValue
      : {}
  } catch {
    return {}
  }
}

function getMatchInboxKey(job) {
  return (
    String(
      job?.discoveryFingerprint ||
        job?.discoveryId ||
        job?.id ||
        "",
    ).trim() ||
    [
      normaliseText(
        job?.title ||
          job?.role,
      ),
      normaliseText(job?.company),
      normaliseText(job?.location),
    ].join("|")
  )
}

function getMatchInboxStatus(
  job,
  decisions,
) {
  const entry =
    decisions?.[
      getMatchInboxKey(job)
    ]

  if (typeof entry === "string") {
    return entry
  }

  return (
    entry?.status ||
    "new"
  )
}

function getSortableSalary(job) {
  return (
    Number(job?.salaryMax || 0) ||
    Number(job?.salaryMin || 0) ||
    Number(
      String(job?.salaryText || "")
        .replace(/,/g, "")
        .match(/\d+(?:\.\d+)?/)?.[0] ||
        0,
    )
  )
}

function loadCandidateDefaults() {
  try {
    const savedProfile = localStorage.getItem(profileStorageKey)
    const profile = savedProfile ? JSON.parse(savedProfile) : {}

    const targetRoles = String(profile?.targetRoles || "")
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean)

    const preferredLocations = String(
      profile?.preferredLocations || "",
    )
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean)

    return {
      keywords:
        targetRoles[0] ||
        String(profile?.currentJobTitle || "").trim(),

      location:
        preferredLocations[0] ||
        String(profile?.city || "").trim(),

      minimumSalary: String(profile?.minimumSalary || "").replace(
        /[^0-9.]/g,
        "",
      ),
    }
  } catch {
    return {
      keywords: "",
      location: "",
      minimumSalary: "",
    }
  }
}

function createInitialLiveSearch() {
  const defaults = loadCandidateDefaults()

  return {
    keywords: defaults.keywords,
    location: defaults.location,
    distance: 15,
    minimumSalary: defaults.minimumSalary,
    maximumSalary: "",
    postedWithinDays: 14,
    resultsPerSource: 25,
    permanent: false,
    contract: false,
    temporary: false,
    fullTime: false,
    partTime: false,
  }
}

function normaliseUrl(url) {
  const trimmedUrl = String(url || "").trim()

  if (!trimmedUrl) {
    return ""
  }

  if (
    trimmedUrl.startsWith("http://") ||
    trimmedUrl.startsWith("https://")
  ) {
    return trimmedUrl
  }

  return `https://${trimmedUrl}`
}

function normaliseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function formatDate(
  value,
) {
  return formatPreferenceDate(
    value,
  )
}

function formatDateTime(
  value,
) {
  return formatPreferenceDateTime(
    value,
  )
}

function parseLocalDate(value) {
  if (!value) {
    return null
  }

  const [year, month, day] =
    String(value)
      .split("-")
      .map(Number)

  if (!year || !month || !day) {
    return null
  }

  const date =
    new Date(
      year,
      month - 1,
      day,
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date
}

function startOfToday() {
  const today =
    new Date()

  today.setHours(
    0,
    0,
    0,
    0,
  )

  return today
}

function isPastDate(value) {
  const date =
    parseLocalDate(value)

  if (!date) {
    return false
  }

  return (
    date.getTime() <
    startOfToday().getTime()
  )
}

function isToday(value) {
  const date =
    parseLocalDate(value)

  if (!date) {
    return false
  }

  return (
    date.getTime() ===
    startOfToday().getTime()
  )
}

function isWithinNextDays(
  value,
  days,
) {
  const date =
    parseLocalDate(value)

  if (!date) {
    return false
  }

  const today =
    startOfToday()

  const maximum =
    new Date(today)

  maximum.setDate(
    maximum.getDate() +
      days,
  )

  return (
    date.getTime() >=
      today.getTime() &&
    date.getTime() <=
      maximum.getTime()
  )
}

function formatActionDate(value) {
  const date =
    parseLocalDate(value)

  if (!date) {
    return ""
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  )
}

function getJobActionDate(job) {
  return (
    job.nextActionDate ||
    job.followUpDate ||
    (
      job.status ===
      "Interview"
        ? job.interviewDate
        : ""
    )
  )
}

function getJobActionLabel(job) {
  if (
    job.nextAction &&
    job.nextAction !== "None"
  ) {
    return job.nextAction
  }

  if (
    job.status ===
      "Interview" &&
    job.interviewDate
  ) {
    return "Attend interview"
  }

  if (
    job.status ===
      "Applied" &&
    job.followUpDate
  ) {
    return "Follow up"
  }

  if (
    job.status ===
    "Applied"
  ) {
    return "Wait for response"
  }

  if (
    job.status ===
    "Saved"
  ) {
    return "Review job"
  }

  return "None"
}

function jobNeedsAction(job) {
  const label =
    getJobActionLabel(job)

  const actionDate =
    getJobActionDate(job)

  if (
    [
      "Offer",
      "Rejected",
    ].includes(job.status)
  ) {
    return false
  }

  if (
    label ===
      "Wait for response" ||
    label === "None"
  ) {
    return false
  }

  return (
    !actionDate ||
    isPastDate(actionDate) ||
    isToday(actionDate)
  )
}

function jobIsWaiting(job) {
  return (
    job.status ===
      "Applied" &&
    getJobActionLabel(job) ===
      "Wait for response"
  )
}

function jobHasUpcomingInterview(
  job,
) {
  return (
    job.status ===
      "Interview" &&
    Boolean(job.interviewDate) &&
    isWithinNextDays(
      job.interviewDate,
      30,
    )
  )
}

function jobIsOverdue(job) {
  const actionDate =
    getJobActionDate(job)

  return Boolean(
    actionDate &&
      isPastDate(
        actionDate,
      ) &&
      ![
        "Offer",
        "Rejected",
      ].includes(job.status),
  )
}

function getLiveJobUrls(job) {
  const urls = [job?.applyUrl, job?.url]

  for (const listing of job?.sourceListings || []) {
    urls.push(listing?.applyUrl, listing?.url)
  }

  return [...new Set(urls.map(normaliseUrl).filter(Boolean))]
}

function getProviderLabel(source) {
  return getJobProviderLabel(
    source,
  )
}


function buildSavedJobRecord(liveJob) {
  const now =
    new Date().toISOString()

  const sourceNames =
    liveJob.sourceNames?.length > 0
      ? liveJob.sourceNames
      : [
          liveJob.sourceName ||
            getProviderLabel(
              liveJob.source,
            ),
        ]

  const jobId =
    crypto.randomUUID()

  return {
    id: jobId,
    role:
      liveJob.title ||
      "Untitled role",
    company:
      liveJob.company ||
      "Unknown company",
    location:
      liveJob.location || "",
    salary:
      liveJob.salaryText || "",
    status: "Saved",
    dateApplied: "",
    jobUrl: normaliseUrl(
      liveJob.applyUrl ||
        liveJob.url,
    ),
    contactName: "",
    contactEmail: "",
    notes: `Imported from ${sourceNames.join(" and ")} live search.`,
    description:
      liveJob.description || "",
    descriptionIsSnippet:
      Boolean(
        liveJob.descriptionIsSnippet,
      ),
    descriptionSource:
      liveJob.descriptionSource || "",
    descriptionNotice:
      liveJob.descriptionNotice || "",
    matchScore: Number(
      liveJob.matchAnalysis
        ?.score || 0,
    ),
    matchLabel:
      liveJob.matchAnalysis
        ?.label || "",
    matchedSkills:
      Array.isArray(
        liveJob.matchAnalysis
          ?.matchedSkills,
      )
        ? liveJob.matchAnalysis
            .matchedSkills
        : [],
    missingSkills:
      Array.isArray(
        liveJob.matchAnalysis
          ?.missingSkills,
      )
        ? liveJob.matchAnalysis
            .missingSkills
        : [],
    postedAt:
      liveJob.postedAt || "",
    expiresAt:
      liveJob.expiresAt || "",
    contractType:
      liveJob.contractType || "",
    workType:
      liveJob.workType || "",
    category:
      liveJob.category || "",
    isRemote:
      Boolean(liveJob.isRemote),
    liveSearchId:
      liveJob.id || "",
    providerId:
      liveJob.providerId || "",
    source:
      liveJob.source || "",
    sourceName:
      liveJob.sourceName || "",
    sourceNames,
    sourceListings:
      Array.isArray(
        liveJob.sourceListings,
      )
        ? liveJob.sourceListings
        : [],
    importedFromLiveSearch: true,
    createdAt: now,
    updatedAt: now,

    activityHistory: [
      createJobActivity({
        type:
          "tracked",

        title:
          "Job added to tracker",

        description:
          `Saved from ${sourceNames.join(" and ")} live search.`,

        createdAt:
          now,

        dedupeKey:
          `job-created-${jobId}`,

        metadata: {
          source:
            liveJob.source ||
            "live-search",
        },
      }),
    ],
  }
}


const skillDefinitions = [
  {
    name: "Administration",
    aliases: ["administration", "administrator", "administrative", "office admin"],
  },
  {
    name: "Accounts",
    aliases: ["accounts", "accounting", "accounts payable", "accounts receivable"],
  },
  {
    name: "Bookkeeping",
    aliases: ["bookkeeping", "bookkeeper"],
  },
  {
    name: "Cash Handling",
    aliases: ["cash handling", "cash reconciliation", "till reconciliation"],
  },
  {
    name: "Communication",
    aliases: ["communication", "communicate", "interpersonal"],
  },
  {
    name: "Customer Service",
    aliases: ["customer service", "customer support", "customer care", "complaint handling"],
  },
  {
    name: "Data Entry",
    aliases: ["data entry", "data input", "record keeping"],
  },
  {
    name: "Excel",
    aliases: ["excel", "spreadsheets", "spreadsheet"],
  },
  {
    name: "IT Support",
    aliases: ["it support", "helpdesk", "help desk", "service desk", "technical support"],
  },
  {
    name: "Microsoft Office",
    aliases: ["microsoft office", "office 365", "microsoft 365", "word", "outlook"],
  },
  {
    name: "Organisation",
    aliases: ["organisation", "organization", "organised", "organized"],
  },
  {
    name: "Problem Solving",
    aliases: ["problem solving", "troubleshooting", "resolve issues", "issue resolution"],
  },
  {
    name: "Project Management",
    aliases: ["project management", "project coordination", "project coordinator"],
  },
  {
    name: "Sales",
    aliases: ["sales", "upselling", "cross selling"],
  },
  {
    name: "Teamwork",
    aliases: ["teamwork", "team player", "working as part of a team"],
  },
  {
    name: "Time Management",
    aliases: ["time management", "prioritise", "prioritize", "deadlines"],
  },
  {
    name: "Training",
    aliases: ["training", "train staff", "coaching"],
  },
  {
    name: "Written Communication",
    aliases: ["written communication", "report writing", "documentation"],
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

function loadCandidateProfile() {
  try {
    const savedProfile = localStorage.getItem(profileStorageKey)
    const profile = savedProfile ? JSON.parse(savedProfile) : {}

    return profile && typeof profile === "object" ? profile : {}
  } catch {
    return {}
  }
}

function splitProfileValues(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  }

  return String(value || "")
    .split(/[\n,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function canonicalRoleText(value) {
  return normaliseText(value)
    .replace(/\badministrative\b/g, "admin")
    .replace(/\badministration\b/g, "admin")
    .replace(/\badministrator\b/g, "admin")
    .replace(/\baccounting\b/g, "accounts")
    .replace(/\baccountant\b/g, "accounts")
    .replace(/\bbookkeeper\b/g, "bookkeeping")
    .replace(/\bhelp desk\b/g, "it support")
    .replace(/\bhelpdesk\b/g, "it support")
    .replace(/\bservice desk\b/g, "it support")
    .replace(/\btechnical support\b/g, "it support")
    .replace(/\bcustomer support\b/g, "customer service")
    .replace(/\bcustomer care\b/g, "customer service")
    .replace(/\bcustomer representative\b/g, "customer service")
}

function roleTokens(value) {
  return canonicalRoleText(value)
    .split(" ")
    .filter((token) => token && !roleStopWords.has(token))
}

function roleSimilarity(firstValue, secondValue) {
  const first = canonicalRoleText(firstValue)
  const second = canonicalRoleText(secondValue)

  if (!first || !second) {
    return 0
  }

  if (first === second) {
    return 1
  }

  if (first.includes(second) || second.includes(first)) {
    return 0.9
  }

  const firstTokens = roleTokens(first)
  const secondTokens = roleTokens(second)

  if (firstTokens.length === 0 || secondTokens.length === 0) {
    return 0
  }

  const secondSet = new Set(secondTokens)
  const intersection = firstTokens.filter((token) =>
    secondSet.has(token),
  ).length

  return intersection / Math.max(1, Math.min(firstTokens.length, secondTokens.length))
}

function detectSkills(textValue) {
  const text = normaliseText(textValue)

  return skillDefinitions
    .filter((skill) =>
      skill.aliases.some((alias) =>
        text.includes(normaliseText(alias)),
      ),
    )
    .map((skill) => skill.name)
}

function parseNumber(value) {
  const parsedValue = Number(
    String(value || "").replace(/[^0-9.]/g, ""),
  )

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function getPostedAgeDays(postedAt) {
  if (!postedAt) {
    return null
  }

  const postedDate = new Date(postedAt)

  if (Number.isNaN(postedDate.getTime())) {
    return null
  }

  return Math.max(
    0,
    Math.floor((Date.now() - postedDate.getTime()) / (24 * 60 * 60 * 1000)),
  )
}

function analyseLiveJob(job, profile) {
  const targetRoles = splitProfileValues(profile?.targetRoles)
  const preferredLocations = splitProfileValues(
    profile?.preferredLocations || profile?.city,
  )
  const preferredWorkModes = splitProfileValues(profile?.workModes)
  const minimumSalary = parseNumber(profile?.minimumSalary)

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

  const profileSkills = detectSkills(profileText)
  const jobSkills = detectSkills(jobText)
  const matchedSkills = jobSkills.filter((skill) =>
    profileSkills.includes(skill),
  )
  const missingSkills = jobSkills.filter(
    (skill) => !profileSkills.includes(skill),
  )

  let roleScore = 17
  let bestRole = ""

  if (targetRoles.length > 0) {
    const roleMatches = targetRoles
      .map((targetRole) => ({
        role: targetRole,
        similarity: roleSimilarity(job?.title, targetRole),
      }))
      .sort((first, second) => second.similarity - first.similarity)

    bestRole = roleMatches[0]?.role || ""
    roleScore = Math.round((roleMatches[0]?.similarity || 0) * 35)
  }

  let skillScore = 15

  if (jobSkills.length > 0) {
    skillScore =
      profileSkills.length > 0
        ? Math.round((matchedSkills.length / jobSkills.length) * 30)
        : 5
  }

  const jobLocation = normaliseText(job?.location)
  const workModeText = preferredWorkModes
    .map(normaliseText)
    .join(" ")

  let locationScore = preferredLocations.length === 0 ? 10 : 2
  let locationMatch = ""

  if (
    job?.isRemote &&
    (workModeText.includes("remote") || preferredLocations.length === 0)
  ) {
    locationScore = 15
    locationMatch = "Remote matches your preference"
  } else {
    const matchedLocation = preferredLocations.find((location) => {
      const normalisedLocation = normaliseText(location)

      return (
        normalisedLocation &&
        (jobLocation.includes(normalisedLocation) ||
          normalisedLocation.includes(jobLocation))
      )
    })

    if (matchedLocation) {
      locationScore = 15
      locationMatch = `Matches ${matchedLocation}`
    } else if (job?.isRemote) {
      locationScore = 8
      locationMatch = "Remote vacancy"
    }
  }

  const advertisedSalary =
    Number(job?.salaryMax || 0) || Number(job?.salaryMin || 0)

  let salaryScore = minimumSalary > 0 ? 4 : 8
  let salaryMessage =
    advertisedSalary > 0
      ? job?.salaryText || `£${Math.round(advertisedSalary).toLocaleString("en-GB")}`
      : "Salary not listed"

  if (minimumSalary > 0 && advertisedSalary > 0) {
    if (advertisedSalary >= minimumSalary) {
      salaryScore = 10
      salaryMessage = `${salaryMessage} meets your minimum`
    } else if (advertisedSalary >= minimumSalary * 0.9) {
      salaryScore = 7
      salaryMessage = `${salaryMessage} is close to your minimum`
    } else if (advertisedSalary >= minimumSalary * 0.8) {
      salaryScore = 4
      salaryMessage = `${salaryMessage} is below your minimum`
    } else {
      salaryScore = 0
      salaryMessage = `${salaryMessage} is well below your minimum`
    }
  }

  let workModeScore = preferredWorkModes.length === 0 ? 5 : 2

  if (
    job?.isRemote &&
    workModeText.includes("remote")
  ) {
    workModeScore = 5
  } else if (
    normaliseText(job?.description).includes("hybrid") &&
    workModeText.includes("hybrid")
  ) {
    workModeScore = 5
  } else if (
    !job?.isRemote &&
    (workModeText.includes("on site") ||
      workModeText.includes("onsite") ||
      workModeText.includes("office"))
  ) {
    workModeScore = 5
  }

  const ageDays = getPostedAgeDays(job?.postedAt)
  let recencyScore = 2

  if (ageDays !== null) {
    if (ageDays <= 7) {
      recencyScore = 5
    } else if (ageDays <= 14) {
      recencyScore = 4
    } else if (ageDays <= 30) {
      recencyScore = 2
    } else {
      recencyScore = 0
    }
  }

  const normalisedTitle = normaliseText(job?.title)
  const excludedRole = excludedRolePhrases.find((phrase) =>
    normalisedTitle.includes(normaliseText(phrase)),
  )

  const penalty = excludedRole ? 35 : 0

  const score = Math.max(
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
  } else if (targetRoles.length > 0) {
    concerns.push("The job title is not a close match to your target roles")
  }

  if (matchedSkills.length > 0) {
    strengths.push(
      `${matchedSkills.length} recognised skill${
        matchedSkills.length === 1 ? "" : "s"
      } match your profile`,
    )
  }

  if (locationScore >= 12) {
    strengths.push(locationMatch || "Location matches your preferences")
  } else if (preferredLocations.length > 0 && !job?.isRemote) {
    concerns.push("The location may be outside your preferred areas")
  }

  if (salaryScore >= 8) {
    strengths.push(salaryMessage)
  } else if (minimumSalary > 0) {
    concerns.push(salaryMessage)
  }

  if (ageDays !== null && ageDays <= 7) {
    strengths.push("Recently posted")
  }

  if (missingSkills.length > 0) {
    concerns.push(
      `${missingSkills.length} recognised requirement${
        missingSkills.length === 1 ? "" : "s"
      } are not listed in your profile`,
    )
  }

  if (excludedRole) {
    concerns.unshift(
      `This appears to be an excluded managerial role: ${excludedRole}`,
    )
  }

  let label = "Low match"

  if (score >= 85) {
    label = "Strong match"
  } else if (score >= 70) {
    label = "Good match"
  } else if (score >= 50) {
    label = "Possible match"
  }

  const profileReady = Boolean(
    targetRoles.length ||
      profileSkills.length ||
      preferredLocations.length ||
      minimumSalary,
  )

  return {
    score,
    label,
    profileReady,
    excludedRole: excludedRole || "",
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

function getMatchBadgeClass(
  score,
  excludedRole =
    false,
) {
  return getMatchScoreClass(
    score,
    excludedRole,
  )
}

export default function Jobs() {
  const navigate =
    useNavigate()

  const location =
    useLocation()

  const [
    activeJobsView,
    setActiveJobsView,
  ] = useState(() => {
    try {
      return localStorage.getItem(
        jobsViewStorageKey,
      ) === "my-jobs"
        ? "my-jobs"
        : "discover"
    } catch {
      return "discover"
    }
  })

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        location.search,
      )

    const requestedView =
      parameters.get(
        "view",
      )

    const requestedSection =
      parameters.get(
        "section",
      )

    const requestedAction =
      parameters.get(
        "action",
      )

    if (
      requestedView ===
        "discover" ||
      requestedView ===
        "my-jobs"
    ) {
      changeJobsView(
        requestedView,
      )
    }

    const timeoutId =
      window.setTimeout(
        () => {
          if (
            requestedAction ===
            "add-job"
          ) {
            openAddJob()
          }

          if (
            requestedSection
          ) {
            document
              .getElementById(
                requestedSection,
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",

                block:
                  "start",
              })
          }
        },
        140,
      )

    return () =>
      window.clearTimeout(
        timeoutId,
      )
  }, [
    location.search,
  ])

  const [
    showSmartMatch,
    setShowSmartMatch,
  ] = useState(() => {
    try {
      const savedVisibility =
        localStorage.getItem(
          smartMatchVisibilityStorageKey,
        )

      if (savedVisibility) {
        return savedVisibility !== "hidden"
      }

      return loadDiscoveryResults().length > 0
    } catch {
      return false
    }
  })

  const [jobs, setJobs] = useState(loadSavedJobs)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [actionFilter, setActionFilter] = useState("all")
  const [showJobForm, setShowJobForm] = useState(false)
  const [editingJobId, setEditingJobId] = useState(null)
  const [jobPendingDeletion, setJobPendingDeletion] =
    useState(null)
  const [form, setForm] = useState(emptyForm)

  const [candidateProfile, setCandidateProfile] = useState(
    loadCandidateProfile,
  )

  const [liveSort, setLiveSort] = useState("match")
  const [analysisJob, setAnalysisJob] = useState(null)

  const [sourceStatus, setSourceStatus] = useState(
    emptySourceStatus,
  )

  const [selectedSources, setSelectedSources] = useState(() =>
    jobProviderIds.reduce(
      (selection, source) => {
        selection[source] =
          true
        return selection
      },
      {},
    ),
  )

  const [liveSearch, setLiveSearch] = useState(
    createInitialLiveSearch,
  )

  const [showAdvancedFilters, setShowAdvancedFilters] =
    useState(false)

  const [liveResult, setLiveResult] = useState(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState("")
  const [liveMessage, setLiveMessage] = useState("")
  const [livePage, setLivePage] = useState(1)

  const [discoveryResults, setDiscoveryResults] = useState(
    loadDiscoveryResults,
  )

  const [discoverySettings, setDiscoverySettings] = useState(
    loadDiscoverySettings,
  )

  const [
    matchInboxDecisions,
    setMatchInboxDecisions,
  ] = useState(
    loadMatchInboxDecisions,
  )

  const [
    matchInboxMessage,
    setMatchInboxMessage,
  ] = useState("")

  useEffect(() => {
    loadJobSourceStatus()

    function refreshSavedJobs() {
      setJobs(loadSavedJobs())
    }

    function refreshCandidateProfile() {
      setCandidateProfile(loadCandidateProfile())
    }

    function refreshDiscoveryData() {
      setDiscoveryResults(loadDiscoveryResults())
      setDiscoverySettings(loadDiscoverySettings())
      setMatchInboxDecisions(
        loadMatchInboxDecisions(),
      )
    }

    window.addEventListener(
      "jobpilot:jobs-updated",
      refreshSavedJobs,
    )

    window.addEventListener(
      "jobpilot:discovery-updated",
      refreshDiscoveryData,
    )

    window.addEventListener(
      "jobpilot:discovery-settings-updated",
      refreshDiscoveryData,
    )

    window.addEventListener(
      "jobpilot:match-inbox-updated",
      refreshDiscoveryData,
    )

    window.addEventListener(
      "focus",
      refreshCandidateProfile,
    )

    window.addEventListener(
      "focus",
      refreshDiscoveryData,
    )

    window.addEventListener(
      "jobpilot:profile-updated",
      refreshCandidateProfile,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:jobs-updated",
        refreshSavedJobs,
      )

      window.removeEventListener(
        "jobpilot:discovery-updated",
        refreshDiscoveryData,
      )

      window.removeEventListener(
        "jobpilot:discovery-settings-updated",
        refreshDiscoveryData,
      )

      window.removeEventListener(
        "jobpilot:match-inbox-updated",
        refreshDiscoveryData,
      )

      window.removeEventListener(
        "focus",
        refreshCandidateProfile,
      )

      window.removeEventListener(
        "focus",
        refreshDiscoveryData,
      )

      window.removeEventListener(
        "jobpilot:profile-updated",
        refreshCandidateProfile,
      )
    }
  }, [])

  const filteredJobs = useMemo(() => {
    const searchText = search.toLowerCase().trim()

    return jobs.filter((job) => {
      const searchableText = [
        job.role,
        job.company,
        job.location,
        job.contactName,
        job.contactEmail,
        job.notes,
        job.description,
        job.nextAction,
        job.interviewLocation,
        job.interviewNotes,
        job.sourceName,
        ...(job.sourceNames || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchesSearch = searchableText.includes(searchText)

      const matchesStatus =
        statusFilter === "All" || job.status === statusFilter

      const matchesAction =
        actionFilter === "all" ||
        (
          actionFilter ===
            "needs-action" &&
          jobNeedsAction(job)
        ) ||
        (
          actionFilter ===
            "waiting" &&
          jobIsWaiting(job)
        ) ||
        (
          actionFilter ===
            "interviews" &&
          jobHasUpcomingInterview(
            job,
          )
        ) ||
        (
          actionFilter ===
            "overdue" &&
          jobIsOverdue(job)
        )

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAction
      )
    })
  }, [
    jobs,
    search,
    statusFilter,
    actionFilter,
  ])

  const newDiscoveryCount =
    useMemo(
      () =>
        discoveryResults.filter(
          (job) =>
            getMatchInboxStatus(
              job,
              matchInboxDecisions,
            ) === "new",
        ).length,
      [
        discoveryResults,
        matchInboxDecisions,
      ],
    )

  const highMatchCount =
    useMemo(
      () =>
        discoveryResults.filter(
          (job) =>
            Number(
              job?.matchAnalysis
                ?.score || 0,
            ) >= 90,
        ).length,
      [discoveryResults],
    )

  const configuredSources = useMemo(() => {
    return Object.entries(sourceStatus.sources)
      .filter(([, source]) => source?.configured)
      .map(([source]) => source)
  }, [sourceStatus])

  const activeSelectedSources = useMemo(() => {
    return configuredSources.filter(
      (source) => selectedSources[source],
    )
  }, [configuredSources, selectedSources])

  const hasNextLivePage = useMemo(() => {
    if (!liveResult?.providers?.length) {
      return false
    }

    return liveResult.providers.some((provider) => {
      if (!provider.ok) {
        return false
      }

      return (
        Number(provider.available || 0) >
        livePage * Number(liveSearch.resultsPerSource || 25)
      )
    })
  }, [liveResult, livePage, liveSearch.resultsPerSource])


  const displayLiveResult = useMemo(() => {
    if (!liveResult) {
      return null
    }

    const analysedJobs = (liveResult.jobs || []).map((job) => ({
      ...job,
      matchAnalysis: analyseLiveJob(job, candidateProfile),
    }))

    analysedJobs.sort((first, second) => {
      if (liveSort === "newest") {
        return (
          new Date(second.postedAt || 0).getTime() -
          new Date(first.postedAt || 0).getTime()
        )
      }

      if (liveSort === "salary") {
        return (
          Number(second.salaryMax || second.salaryMin || 0) -
          Number(first.salaryMax || first.salaryMin || 0)
        )
      }

      if (liveSort === "source") {
        return String(first.sourceName || first.source || "").localeCompare(
          String(second.sourceName || second.source || ""),
        )
      }

      return (
        Number(second.matchAnalysis?.score || 0) -
          Number(first.matchAnalysis?.score || 0) ||
        new Date(second.postedAt || 0).getTime() -
          new Date(first.postedAt || 0).getTime()
      )
    })

    return {
      ...liveResult,
      jobs: analysedJobs,
    }
  }, [liveResult, candidateProfile, liveSort])

  async function loadJobSourceStatus() {
    setSourceStatus((current) => ({
      ...current,
      loading: true,
      error: "",
    }))

    try {
      if (!window.jobPilot?.jobSources?.getStatus) {
        throw new Error(
          "Live job-search services are unavailable. Fully restart BreakVeil.",
        )
      }

      const result = await window.jobPilot.jobSources.getStatus()

      if (!result?.ok) {
        throw new Error(
          result?.error || "BreakVeil could not check job sources.",
        )
      }

      const nextSources =
        mergeJobSourceMap(
          result?.sources,
        )

      setSourceStatus({
        loading: false,
        error: "",
        sources: nextSources,
      })

      setSelectedSources(
        Object.entries(
          nextSources,
        ).reduce(
          (selection, [source, details]) => {
            selection[source] =
              Boolean(
                details.configured,
              )
            return selection
          },
          {},
        ),
      )
    } catch (error) {
      setSourceStatus({
        ...emptySourceStatus,
        loading: false,
        error:
          error?.message || "BreakVeil could not check job sources.",
      })
    }
  }

  function saveJobs(updatedJobs) {
    setJobs(updatedJobs)

    localStorage.setItem(storageKey, JSON.stringify(updatedJobs))

    window.dispatchEvent(new Event("jobpilot:jobs-updated"))
  }

  function updateForm(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateLiveSearch(field, value) {
    setLiveSearch((currentSearch) => ({
      ...currentSearch,
      [field]: value,
    }))
  }

  function toggleSelectedSource(source) {
    if (!sourceStatus.sources[source]?.configured) {
      return
    }

    setSelectedSources((current) => ({
      ...current,
      [source]: !current[source],
    }))
  }

  async function runLiveSearch({
    forceRefresh = false,
    page = 1,
  } = {}) {
    if (!window.jobPilot?.jobSources?.searchJobs) {
      setLiveError(
        "The live search engine is unavailable. Fully restart BreakVeil.",
      )
      return
    }

    if (activeSelectedSources.length === 0) {
      setLiveError("Select at least one connected job source.")
      return
    }

    if (!liveSearch.keywords.trim() && !liveSearch.location.trim()) {
      setLiveError("Enter a job title, keyword or location.")
      return
    }

    setCandidateProfile(loadCandidateProfile())
    setLiveLoading(true)
    setLiveError("")
    setLiveMessage(
      `Searching ${activeSelectedSources
        .map(
          (source) =>
            sourceStatus.sources[source]?.name ||
            getProviderLabel(source),
        )
        .join(" and ")}...`,
    )

    try {
      const result = await window.jobPilot.jobSources.searchJobs({
        ...liveSearch,
        page,
        requestMode: "manual",
        sources: activeSelectedSources,
        forceRefresh,
      })

      recordJobSearchResult(
        result,
      )

      if (!result?.ok) {
        const previousResultsMessage =
          liveResult
            ? " Previous results remain available below."
            : ""

        setLiveError(
          `${result?.error || "The live search failed."}${previousResultsMessage}`,
        )

        setLiveMessage(
          "",
        )

        return
      }

      const presentation =
        getSearchResultPresentation(
          result,
        )

      setLiveResult(result)
      setLivePage(page)
      setLiveMessage(
        presentation.message,
      )
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
          "The live search failed.",
      })

      const previousResultsMessage =
        liveResult
          ? " Previous results remain available below."
          : ""

      setLiveError(
        `${error?.message || "The live search failed."}${previousResultsMessage}`,
      )

      setLiveMessage("")
    } finally {
      setLiveLoading(false)
    }
  }

  function isLiveJobSaved(liveJob) {
    const liveUrls = getLiveJobUrls(liveJob)
    const liveRole = normaliseText(liveJob.title)
    const liveCompany = normaliseText(liveJob.company)
    const liveLocation = normaliseText(liveJob.location)

    return jobs.some((savedJob) => {
      if (
        savedJob.liveSearchId &&
        savedJob.liveSearchId === liveJob.id
      ) {
        return true
      }

      const savedUrl = normaliseUrl(savedJob.jobUrl)

      if (savedUrl && liveUrls.includes(savedUrl)) {
        return true
      }

      return (
        normaliseText(savedJob.role) === liveRole &&
        normaliseText(savedJob.company) === liveCompany &&
        normaliseText(savedJob.location) === liveLocation
      )
    })
  }

  function saveLiveJob(liveJob) {
    if (isLiveJobSaved(liveJob)) {
      setLiveMessage(
        `${liveJob.title} at ${liveJob.company} is already in your tracker.`,
      )

      return false
    }

    const newJob =
      buildSavedJobRecord(
        liveJob,
      )

    saveJobs([
      newJob,
      ...jobs,
    ])

    setLiveMessage(
      `${newJob.role} at ${newJob.company} was saved to your tracker.`,
    )

    return true
  }

  function openLiveJobInAssistant(liveJob) {
    const matchAnalysis =
      liveJob.matchAnalysis ||
      analyseLiveJob(liveJob, candidateProfile)

    const sourceNames =
      Array.isArray(liveJob.sourceNames) &&
      liveJob.sourceNames.length > 0
        ? liveJob.sourceNames
        : [liveJob.sourceName || getProviderLabel(liveJob.source)]

    const handoff = {
      version: 1,
      origin: "live-job-search",
      importedAt: new Date().toISOString(),

      vacancy: {
        role: liveJob.title || "",
        company: liveJob.company || "",
        location: liveJob.location || "",
        salary: liveJob.salaryText || "",
        jobUrl: normaliseUrl(liveJob.applyUrl || liveJob.url),
        description: liveJob.description || "",
        descriptionIsSnippet:
          Boolean(
            liveJob.descriptionIsSnippet,
          ),
        descriptionSource:
          liveJob.descriptionSource || "",
        descriptionNotice:
          liveJob.descriptionNotice || "",

        postedAt: liveJob.postedAt || "",
        expiresAt: liveJob.expiresAt || "",
        contractType: liveJob.contractType || "",
        workType: liveJob.workType || "",
        category: liveJob.category || "",
        isRemote: Boolean(liveJob.isRemote),

        liveSearchId: liveJob.id || "",
        providerId: liveJob.providerId || "",
        source: liveJob.source || "",
        sourceName: liveJob.sourceName || "",
        sourceNames,
        sourceListings: Array.isArray(liveJob.sourceListings)
          ? liveJob.sourceListings
          : [],
      },

      matchAnalysis,
    }

    localStorage.setItem(
      assistantHandoffStorageKey,
      JSON.stringify(handoff),
    )

    setAnalysisJob(null)
    navigate("/assistant")
  }

  function changeJobsView(view) {
    setActiveJobsView(view)

    try {
      localStorage.setItem(
        jobsViewStorageKey,
        view,
      )
    } catch {
      /*
       * The selected tab still works
       * for this session when storage
       * is unavailable.
       */
    }
  }

  function toggleSmartMatch() {
    setShowSmartMatch(
      (currentValue) => {
        const nextValue =
          !currentValue

        try {
          localStorage.setItem(
            smartMatchVisibilityStorageKey,
            nextValue
              ? "visible"
              : "hidden",
          )
        } catch {
          /*
           * The visibility toggle still
           * works for this session when
           * storage is unavailable.
           */
        }

        return nextValue
      },
    )
  }

  function openAddJob() {
    setEditingJobId(null)
    setForm(emptyForm)
    setShowJobForm(true)
  }

  function openEditJob(job) {
    setEditingJobId(job.id)

    setForm({
      role: job.role || "",
      company: job.company || "",
      location: job.location || "",
      salary: job.salary || "",
      status: job.status || "Saved",
      dateApplied: job.dateApplied || "",
      nextAction:
        job.nextAction || "None",
      nextActionDate:
        job.nextActionDate || "",
      followUpDate:
        job.followUpDate || "",
      interviewDate:
        job.interviewDate || "",
      interviewTime:
        job.interviewTime || "",
      interviewLocation:
        job.interviewLocation || "",
      interviewLink:
        job.interviewLink || "",
      interviewNotes:
        job.interviewNotes || "",
      jobUrl: job.jobUrl || "",
      contactName: job.contactName || "",
      contactEmail: job.contactEmail || "",
      notes: job.notes || "",
    })

    setShowJobForm(true)
  }

  function closeJobForm() {
    setShowJobForm(false)
    setEditingJobId(null)
    setForm(emptyForm)
  }

  function submitJob(event) {
    event.preventDefault()

    if (!form.role.trim() || !form.company.trim()) {
      return
    }

    if (editingJobId) {
      const updatedJobs = jobs.map((job) => {
        if (job.id !== editingJobId) {
          return job
        }

        const updatedAt =
          new Date().toISOString()

        const statusChanged =
          job.status !==
          form.status

        const activity =
          createJobActivity({
            type:
              statusChanged
                ? [
                    "Offer",
                    "Rejected",
                  ].includes(
                    form.status,
                  )
                  ? "outcome"
                  : "status"
                : "updated",

            title:
              statusChanged
                ? form.status ===
                    "Offer"
                  ? "Offer recorded"
                  : form.status ===
                      "Rejected"
                    ? "Application outcome recorded"
                    : `Status changed to ${form.status}`
                : "Job details updated",

            description:
              statusChanged
                ? `Moved from ${job.status || "Saved"} to ${form.status}.`
                : "Job details, notes or interview information were edited.",

            createdAt:
              updatedAt,

            metadata: {
              previousStatus:
                job.status || "",

              status:
                form.status,
            },
          })

        return appendJobActivity({
          ...job,
          role: form.role.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          salary: form.salary.trim(),
          status: form.status,
          dateApplied: form.dateApplied,
          nextAction: form.nextAction,
          nextActionDate:
            form.nextActionDate,
          followUpDate:
            form.followUpDate,
          interviewDate:
            form.interviewDate,
          interviewTime:
            form.interviewTime,
          interviewLocation:
            form.interviewLocation.trim(),
          interviewLink:
            normaliseUrl(
              form.interviewLink,
            ),
          interviewNotes:
            form.interviewNotes.trim(),
          jobUrl: normaliseUrl(form.jobUrl),
          contactName: form.contactName.trim(),
          contactEmail: form.contactEmail.trim(),
          notes: form.notes.trim(),
          updatedAt,
        }, activity)
      })

      saveJobs(updatedJobs)
    } else {
      const now = new Date().toISOString()

      const jobId =
        crypto.randomUUID()

      const newJob = {
        id: jobId,
        role: form.role.trim(),
        company: form.company.trim(),
        location: form.location.trim(),
        salary: form.salary.trim(),
        status: form.status,
        dateApplied: form.dateApplied,
        nextAction: form.nextAction,
        nextActionDate:
          form.nextActionDate,
        followUpDate:
          form.followUpDate,
        interviewDate:
          form.interviewDate,
        interviewTime:
          form.interviewTime,
        interviewLocation:
          form.interviewLocation.trim(),
        interviewLink:
          normaliseUrl(
            form.interviewLink,
          ),
        interviewNotes:
          form.interviewNotes.trim(),
        jobUrl: normaliseUrl(form.jobUrl),
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        notes: form.notes.trim(),
        createdAt: now,
        updatedAt: now,

        activityHistory: [
          createJobActivity({
            type:
              "tracked",

            title:
              "Job added to tracker",

            description:
              "Added manually to My Jobs.",

            createdAt:
              now,

            dedupeKey:
              `job-created-${jobId}`,

            metadata: {
              source:
                "manual",
            },
          }),
        ],
      }

      saveJobs([newJob, ...jobs])
    }

    closeJobForm()
  }

  function updateJobStatus(jobId, newStatus) {
    const updatedJobs = jobs.map((job) => {
      if (job.id !== jobId) {
        return job
      }

      if (
        job.status ===
        newStatus
      ) {
        return job
      }

      const today =
        new Date()
          .toISOString()
          .slice(0, 10)

      const updatedAt =
        new Date().toISOString()

      let nextJob = {
        ...job,
        status: newStatus,
        updatedAt,
      }

      if (
        newStatus ===
          "Applied" &&
        !nextJob.dateApplied
      ) {
        nextJob.dateApplied =
          today
      }

      if (
        newStatus ===
          "Applied" &&
        (
          !nextJob.nextAction ||
          nextJob.nextAction ===
            "None"
        )
      ) {
        nextJob.nextAction =
          "Wait for response"
      }

      if (
        newStatus ===
          "Interview" &&
        (
          !nextJob.nextAction ||
          [
            "None",
            "Wait for response",
          ].includes(
            nextJob.nextAction,
          )
        )
      ) {
        nextJob.nextAction =
          "Prepare for interview"
      }

      nextJob =
        appendJobActivity(
          nextJob,
          createJobActivity({
            type:
              [
                "Offer",
                "Rejected",
              ].includes(
                newStatus,
              )
                ? "outcome"
                : "status",

            title:
              newStatus ===
                "Offer"
                ? "Offer recorded"
                : newStatus ===
                    "Rejected"
                  ? "Application outcome recorded"
                  : `Status changed to ${newStatus}`,

            description:
              `Moved from ${job.status || "Saved"} to ${newStatus}.`,

            createdAt:
              updatedAt,

            metadata: {
              previousStatus:
                job.status || "",

              status:
                newStatus,
            },
          }),
        )

      return nextJob
    })

    saveJobs(updatedJobs)
  }

  function markJobActionComplete(jobId) {
    const updatedAt =
      new Date().toISOString()

    const updatedJobs =
      jobs.map((job) => {
        if (
          job.id !==
          jobId
        ) {
          return job
        }

        const completedAction =
          getJobActionLabel(
            job,
          )

        return appendJobActivity({
          ...job,
          nextAction: "None",
          nextActionDate: "",
          followUpDate: "",
          updatedAt,
        }, createJobActivity({
          type:
            "action",

          title:
            "Next action completed",

          description:
            completedAction &&
            completedAction !==
              "None"
              ? completedAction
              : "A tracked action was completed.",

          createdAt:
            updatedAt,

          metadata: {
            completedAction:
              completedAction ||
              "",
          },
        }))
      })

    saveJobs(updatedJobs)
  }

  function refreshDiscoveryData() {
    setDiscoveryResults(
      loadDiscoveryResults(),
    )

    setDiscoverySettings(
      loadDiscoverySettings(),
    )

    setMatchInboxDecisions(
      loadMatchInboxDecisions(),
    )
  }

  function saveMatchInboxDecisions(
    updatedDecisions,
  ) {
    setMatchInboxDecisions(
      updatedDecisions,
    )

    localStorage.setItem(
      matchInboxDecisionStorageKey,
      JSON.stringify(
        updatedDecisions,
      ),
    )

    window.dispatchEvent(
      new Event(
        "jobpilot:match-inbox-updated",
      ),
    )
  }

  function setDiscoveredJobDecision(
    discoveredJob,
    status,
  ) {
    const key =
      getMatchInboxKey(
        discoveredJob,
      )

    const updatedDecisions = {
      ...matchInboxDecisions,
      [key]: {
        status,
        updatedAt:
          new Date().toISOString(),
      },
    }

    saveMatchInboxDecisions(
      updatedDecisions,
    )

    const label =
      status === "interested"
        ? "Interested"
        : status === "maybe"
          ? "Maybe"
          : "Reviewed"

    setMatchInboxMessage(
      `${discoveredJob.title} at ${discoveredJob.company} was marked ${label.toLowerCase()}.`,
    )
  }

  function removeDiscoveredJobDecision(
    discoveredJob,
  ) {
    const key =
      getMatchInboxKey(
        discoveredJob,
      )

    if (
      !Object.prototype.hasOwnProperty.call(
        matchInboxDecisions,
        key,
      )
    ) {
      return
    }

    const updatedDecisions = {
      ...matchInboxDecisions,
    }

    delete updatedDecisions[key]

    saveMatchInboxDecisions(
      updatedDecisions,
    )
  }

  function markDiscoveredJobReviewed(
    discoveredJob,
  ) {
    if (
      getMatchInboxStatus(
        discoveredJob,
        matchInboxDecisions,
      ) === "new"
    ) {
      setDiscoveredJobDecision(
        discoveredJob,
        "reviewed",
      )
    }
  }

  function saveDiscoveredJob(
    discoveredJob,
  ) {
    if (
      !isLiveJobSaved(
        discoveredJob,
      )
    ) {
      const newJob =
        buildSavedJobRecord(
          discoveredJob,
        )

      saveJobs([
        newJob,
        ...jobs,
      ])
    }

    consumeDiscoveryResult(
      discoveredJob.discoveryId,
      "saved",
    )

    removeDiscoveredJobDecision(
      discoveredJob,
    )

    refreshDiscoveryData()

    setMatchInboxMessage(
      `${discoveredJob.title} at ${discoveredJob.company} was saved and removed from the Match Inbox.`,
    )
  }

  function saveSelectedDiscoveredJobs(
    selectedJobs,
  ) {
    const uniqueJobs = []
    const seenKeys = new Set()

    for (
      const discoveredJob
      of selectedJobs
    ) {
      const key =
        getMatchInboxKey(
          discoveredJob,
        )

      if (
        seenKeys.has(key) ||
        isLiveJobSaved(
          discoveredJob,
        )
      ) {
        continue
      }

      seenKeys.add(key)
      uniqueJobs.push(
        discoveredJob,
      )
    }

    const newSavedJobs =
      uniqueJobs.map(
        buildSavedJobRecord,
      )

    if (
      newSavedJobs.length > 0
    ) {
      saveJobs([
        ...newSavedJobs,
        ...jobs,
      ])
    }

    for (
      const discoveredJob
      of selectedJobs
    ) {
      consumeDiscoveryResult(
        discoveredJob.discoveryId,
        "saved",
      )
    }

    const selectedKeys =
      new Set(
        selectedJobs.map(
          getMatchInboxKey,
        ),
      )

    const updatedDecisions =
      Object.fromEntries(
        Object.entries(
          matchInboxDecisions,
        ).filter(
          ([key]) =>
            !selectedKeys.has(key),
        ),
      )

    saveMatchInboxDecisions(
      updatedDecisions,
    )

    refreshDiscoveryData()

    setMatchInboxMessage(
      `${newSavedJobs.length} selected job${newSavedJobs.length === 1 ? "" : "s"} saved to your tracker.`,
    )
  }

  function updateSelectedDiscoveryDecisions(
    selectedJobs,
    status,
  ) {
    const updatedDecisions = {
      ...matchInboxDecisions,
    }

    const updatedAt =
      new Date().toISOString()

    for (
      const discoveredJob
      of selectedJobs
    ) {
      updatedDecisions[
        getMatchInboxKey(
          discoveredJob,
        )
      ] = {
        status,
        updatedAt,
      }
    }

    saveMatchInboxDecisions(
      updatedDecisions,
    )

    setMatchInboxMessage(
      `${selectedJobs.length} selected match${selectedJobs.length === 1 ? "" : "es"} marked ${status}.`,
    )
  }

  function dismissSelectedDiscoveryJobs(
    selectedJobs,
  ) {
    for (
      const discoveredJob
      of selectedJobs
    ) {
      consumeDiscoveryResult(
        discoveredJob.discoveryId,
        "dismissed",
      )
    }

    const selectedKeys =
      new Set(
        selectedJobs.map(
          getMatchInboxKey,
        ),
      )

    const updatedDecisions =
      Object.fromEntries(
        Object.entries(
          matchInboxDecisions,
        ).filter(
          ([key]) =>
            !selectedKeys.has(key),
        ),
      )

    saveMatchInboxDecisions(
      updatedDecisions,
    )

    refreshDiscoveryData()

    setMatchInboxMessage(
      `${selectedJobs.length} selected match${selectedJobs.length === 1 ? "" : "es"} dismissed.`,
    )
  }

  function analyseDiscoveredJob(
    discoveredJob,
  ) {
    markDiscoveredJobReviewed(
      discoveredJob,
    )

    setAnalysisJob(
      discoveredJob,
    )
  }

  function openDiscoveredJobInAssistant(
    discoveredJob,
  ) {
    markDiscoveredJobReviewed(
      discoveredJob,
    )

    openLiveJobInAssistant(
      discoveredJob,
    )
  }

  function openDiscoveredListing(
    discoveredJob,
  ) {
    const listingUrl =
      normaliseUrl(
        discoveredJob.applyUrl ||
          discoveredJob.url,
      )

    if (listingUrl) {
      window.open(
        listingUrl,
        "_blank",
        "noopener,noreferrer",
      )
    }

    markDiscoveredJobReviewed(
      discoveredJob,
    )
  }

  function dismissDiscoveredJob(
    discoveredJob,
  ) {
    consumeDiscoveryResult(
      discoveredJob.discoveryId,
      "dismissed",
    )

    removeDiscoveredJobDecision(
      discoveredJob,
    )

    refreshDiscoveryData()

    setMatchInboxMessage(
      `${discoveredJob.title} at ${discoveredJob.company} was dismissed.`,
    )
  }

  function markDiscoveryResultsReviewed() {
    const updatedDecisions = {
      ...matchInboxDecisions,
    }

    const updatedAt =
      new Date().toISOString()

    for (
      const discoveredJob
      of discoveryResults
    ) {
      if (
        getMatchInboxStatus(
          discoveredJob,
          matchInboxDecisions,
        ) === "new"
      ) {
        updatedDecisions[
          getMatchInboxKey(
            discoveredJob,
          )
        ] = {
          status: "reviewed",
          updatedAt,
        }
      }
    }

    saveMatchInboxDecisions(
      updatedDecisions,
    )

    setMatchInboxMessage(
      "All new matches were marked as reviewed.",
    )
  }

  function requestDeleteJob(job) {
    setJobPendingDeletion(job)
  }

  function cancelDeleteJob() {
    setJobPendingDeletion(null)
  }

  function confirmDeleteJob() {
    if (!jobPendingDeletion) {
      return
    }

    saveJobs(
      jobs.filter((job) => job.id !== jobPendingDeletion.id),
    )

    setJobPendingDeletion(null)
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Job-search workspace
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Jobs
          </h1>

          <p className="mt-2 max-w-2xl text-zinc-400">
            {activeJobsView === "discover"
              ? "Review automatic matches or search connected job sources manually."
              : "Manage tracked opportunities, next actions, applications and outcomes."}
          </p>
        </div>

        {activeJobsView === "discover" ? (
          <button
            type="button"
            onClick={() =>
              navigate("/automation")
            }
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
          >
            <SlidersHorizontal
              size={16}
            />
            Manage discovery
          </button>
        ) : (
          <button
            type="button"
            onClick={openAddJob}
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            <Plus size={17} />
            Add job
          </button>
        )}
      </div>

      <nav
        aria-label="Jobs sections"
        className="mt-8 grid gap-3 sm:grid-cols-2"
      >
        <button
          type="button"
          onClick={() =>
            changeJobsView(
              "discover",
            )
          }
          className={[
            "flex items-center gap-4 rounded-xl border p-4 text-left transition",

            activeJobsView ===
            "discover"
              ? "border-violet-500/30 bg-violet-500/10"
              : "border-zinc-800 bg-[#151515] hover:border-zinc-700",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",

              activeJobsView ===
              "discover"
                ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-400",
            ].join(" ")}
          >
            <Search size={19} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">
                Discover Jobs
              </p>

              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs",

                  activeJobsView ===
                  "discover"
                    ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-500",
                ].join(" ")}
              >
                {newDiscoveryCount} new
              </span>
            </div>

            <p className="mt-1 text-sm text-zinc-500">
              {highMatchCount > 0
                ? `${highMatchCount} match${highMatchCount === 1 ? "" : "es"} at 90% or higher`
                : "Smart matches and manual job search"}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            changeJobsView(
              "my-jobs",
            )
          }
          className={[
            "flex items-center gap-4 rounded-xl border p-4 text-left transition",

            activeJobsView ===
            "my-jobs"
              ? "border-sky-500/30 bg-sky-500/10"
              : "border-zinc-800 bg-[#151515] hover:border-zinc-700",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",

              activeJobsView ===
              "my-jobs"
                ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-400",
            ].join(" ")}
          >
            <Briefcase size={19} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">
                My Jobs
              </p>

              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs",

                  activeJobsView ===
                  "my-jobs"
                    ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-500",
                ].join(" ")}
              >
                {jobs.length} tracked
              </span>
            </div>

            <p className="mt-1 text-sm text-zinc-500">
              Saved, applied, interviews and offers
            </p>
          </div>
        </button>
      </nav>

      {activeJobsView ===
      "discover" ? (
        <div
          id="jobs-discover"
          className="mt-6 scroll-mt-24"
        >
          <NewMatchesSection
            results={discoveryResults}
            settings={discoverySettings}
            decisions={matchInboxDecisions}
            message={matchInboxMessage}
            expanded={showSmartMatch}
            onToggleExpanded={toggleSmartMatch}
            onSave={saveDiscoveredJob}
            onBulkSave={saveSelectedDiscoveredJobs}
            onAnalyse={analyseDiscoveredJob}
            onOpenAssistant={openDiscoveredJobInAssistant}
            onOpenListing={openDiscoveredListing}
            onSetDecision={setDiscoveredJobDecision}
            onBulkDecision={updateSelectedDiscoveryDecisions}
            onDismiss={dismissDiscoveredJob}
            onBulkDismiss={dismissSelectedDiscoveryJobs}
            onMarkAllReviewed={markDiscoveryResultsReviewed}
            onOpenAutomation={() => navigate("/automation")}
            isJobSaved={isLiveJobSaved}
          />

          <LiveSearchSection
            sourceStatus={sourceStatus}
            selectedSources={selectedSources}
            configuredSources={configuredSources}
            activeSelectedSources={activeSelectedSources}
            liveSearch={liveSearch}
            showAdvancedFilters={showAdvancedFilters}
            liveLoading={liveLoading}
            liveError={liveError}
            liveMessage={liveMessage}
            liveResult={displayLiveResult}
            liveSort={liveSort}
            livePage={livePage}
            hasNextLivePage={hasNextLivePage}
            onReloadSources={loadJobSourceStatus}
            onToggleSource={toggleSelectedSource}
            onUpdateSearch={updateLiveSearch}
            onToggleAdvanced={() =>
              setShowAdvancedFilters((current) => !current)
            }
            onSearch={() => runLiveSearch({ page: 1 })}
            onRefresh={() =>
              runLiveSearch({
                forceRefresh: true,
                page: livePage,
              })
            }
            onPreviousPage={() =>
              runLiveSearch({ page: Math.max(1, livePage - 1) })
            }
            onNextPage={() =>
              runLiveSearch({ page: livePage + 1 })
            }
            onSaveJob={saveLiveJob}
            onAnalyseJob={setAnalysisJob}
            onSortChange={setLiveSort}
            isJobSaved={isLiveJobSaved}
          />
        </div>
      ) : (
        <div
          id="jobs-my-jobs"
          className="mt-6 scroll-mt-24"
        >
          <section>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-3">
                  <Briefcase
                    size={21}
                    className="text-zinc-400"
                  />

                  <h2 className="text-xl font-semibold">
                    My Jobs
                  </h2>
                </div>

                <p className="mt-2 text-sm text-zinc-500">
                  Focus on what needs attention, then open a workspace for the full application journey.
                </p>
              </div>

              <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                {jobs.length} tracked job{jobs.length === 1 ? "" : "s"}
              </span>
            </div>

            <ActionSummary
              jobs={jobs}
              activeFilter={
                actionFilter
              }
              onFilterChange={
                setActionFilter
              }
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
                Status
              </span>

              <button
                type="button"
                onClick={() =>
                  setStatusFilter("All")
                }
                className={[
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition",
                  statusFilter === "All"
                    ? "border-zinc-500 bg-zinc-800 text-white"
                    : "border-zinc-800 bg-[#151515] text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                ].join(" ")}
              >
                All

                <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-500">
                  {jobs.length}
                </span>
              </button>

              {statuses.map((status) => {
                const total =
                  jobs.filter(
                    (job) =>
                      job.status === status,
                  ).length

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        status,
                      )
                    }
                    className={[
                      "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition",
                      statusFilter === status
                        ? "border-zinc-500 bg-zinc-800 text-white"
                        : "border-zinc-800 bg-[#151515] text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                    ].join(" ")}
                  >
                    {status}

                    <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-500">
                      {total}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <div className="flex h-11 flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-[#151515] px-3 transition focus-within:border-zinc-600">
                <Search
                  size={17}
                  className="shrink-0 text-zinc-500"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  aria-label="Search tracked jobs"
                  placeholder="Search jobs, companies, contacts or notes..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    aria-label="Clear job search"
                    title="Clear search"
                    className="rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {(search ||
                statusFilter !== "All" ||
                actionFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setStatusFilter("All")
                    setActionFilter("all")
                  }}
                  className="h-11 rounded-lg border border-zinc-800 px-4 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  Reset view
                </button>
              )}
            </div>

            {jobs.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
                <span>
                  Showing {filteredJobs.length} of {jobs.length} tracked job{jobs.length === 1 ? "" : "s"}
                </span>

                {(search ||
                  statusFilter !== "All" ||
                  actionFilter !== "all") && (
                  <span>
                    Filters are active
                  </span>
                )}
              </div>
            )}

            {filteredJobs.length === 0 ? (
              <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#111111] px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
                  <Briefcase
                    size={24}
                    className="text-zinc-400"
                  />
                </div>

                <h2 className="mt-5 text-lg font-semibold">
                  {jobs.length === 0
                    ? "No tracked jobs yet"
                    : "No jobs match this view"}
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  {jobs.length === 0
                    ? "Review automatic matches in Discover Jobs, search connected sources or add an opportunity manually."
                    : "Reset the search and filters to return to your complete job list."}
                </p>

                {jobs.length === 0 ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        changeJobsView(
                          "discover",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      <Search size={16} />
                      Discover jobs
                    </button>

                    <button
                      type="button"
                      onClick={
                        openAddJob
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                    >
                      <Plus size={16} />
                      Add manually
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("")
                      setStatusFilter("All")
                      setActionFilter("all")
                    }}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                  >
                    <RefreshCw size={15} />
                    Reset view
                  </button>
                )}
              </div>
            ) : (
              <div className="jp-grid-cards mt-6 gap-4">
                {filteredJobs.map((job) => (
                  <SavedJobCard
                    key={job.id}
                    job={job}
                    onEdit={openEditJob}
                    onDelete={requestDeleteJob}
                    onStatusChange={updateJobStatus}
                    onCompleteAction={
                      markJobActionComplete
                    }
                    onOpenWorkspace={() =>
                      navigate(
                        `/jobs/${job.id}`,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {showJobForm && (
        <JobFormModal
          editingJobId={editingJobId}
          form={form}
          onUpdateForm={updateForm}
          onSubmit={submitJob}
          onClose={closeJobForm}
        />
      )}

      {analysisJob && (
        <LiveJobAnalysisModal
          job={analysisJob}
          analysis={
            analysisJob.matchAnalysis ||
            analyseLiveJob(analysisJob, candidateProfile)
          }
          saved={isLiveJobSaved(analysisJob)}
          onSave={() => saveLiveJob(analysisJob)}
          onOpenAssistant={() => openLiveJobInAssistant(analysisJob)}
          onClose={() => setAnalysisJob(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(jobPendingDeletion)}
        title="Delete this job?"
        message={
          jobPendingDeletion
            ? `${jobPendingDeletion.role} at ${jobPendingDeletion.company} will be permanently removed from your tracker.`
            : ""
        }
        confirmLabel="Delete job"
        cancelLabel="Keep job"
        danger
        onConfirm={confirmDeleteJob}
        onCancel={cancelDeleteJob}
      />
    </div>
  )
}

function NewMatchesSection({
  results,
  settings,
  decisions,
  message,
  expanded,
  onToggleExpanded,
  onSave,
  onBulkSave,
  onAnalyse,
  onOpenAssistant,
  onOpenListing,
  onSetDecision,
  onBulkDecision,
  onDismiss,
  onBulkDismiss,
  onMarkAllReviewed,
  onOpenAutomation,
  isJobSaved,
}) {
  const [
    inboxFilter,
    setInboxFilter,
  ] = useState("all")

  const [
    inboxSort,
    setInboxSort,
  ] = useState("match")

  const [
    selectedIds,
    setSelectedIds,
  ] = useState([])

  const classifiedResults =
    useMemo(
      () =>
        results.map(
          (job) => ({
            ...job,

            inboxStatus:
              getMatchInboxStatus(
                job,
                decisions,
              ),
          }),
        ),
      [results, decisions],
    )

  const statusCounts =
    useMemo(() => {
      const counts = {
        all:
          classifiedResults.length,
        new: 0,
        interested: 0,
        maybe: 0,
        reviewed: 0,
      }

      for (
        const job
        of classifiedResults
      ) {
        const status =
          job.inboxStatus ||
          "new"

        counts[status] =
          (counts[status] || 0) +
          1
      }

      return counts
    }, [classifiedResults])

  const visibleResults =
    useMemo(() => {
      const filtered =
        inboxFilter === "all"
          ? classifiedResults
          : classifiedResults.filter(
              (job) =>
                job.inboxStatus ===
                inboxFilter,
            )

      return [
        ...filtered,
      ].sort(
        (first, second) => {
          if (
            inboxSort === "newest"
          ) {
            return (
              new Date(
                second.postedAt ||
                  second.discoveredAt ||
                  0,
              ).getTime() -
              new Date(
                first.postedAt ||
                  first.discoveredAt ||
                  0,
              ).getTime()
            )
          }

          if (
            inboxSort === "salary"
          ) {
            return (
              getSortableSalary(
                second,
              ) -
              getSortableSalary(
                first,
              )
            )
          }

          if (
            inboxSort === "location"
          ) {
            return String(
              first.location || "",
            ).localeCompare(
              String(
                second.location ||
                  "",
              ),
            )
          }

          return (
            Number(
              second.matchAnalysis
                ?.score || 0,
            ) -
            Number(
              first.matchAnalysis
                ?.score || 0,
            )
          )
        },
      )
    }, [
      classifiedResults,
      inboxFilter,
      inboxSort,
    ])

  useEffect(() => {
    const availableIds =
      new Set(
        results.map(
          (job) =>
            job.discoveryId,
        ),
      )

    setSelectedIds(
      (currentIds) =>
        currentIds.filter(
          (id) =>
            availableIds.has(id),
        ),
    )
  }, [results])

  const selectedJobs =
    useMemo(
      () =>
        classifiedResults.filter(
          (job) =>
            selectedIds.includes(
              job.discoveryId,
            ),
        ),
      [
        classifiedResults,
        selectedIds,
      ],
    )

  const allVisibleSelected =
    visibleResults.length > 0 &&
    visibleResults.every(
      (job) =>
        selectedIds.includes(
          job.discoveryId,
        ),
    )

  function toggleSelected(
    discoveryId,
  ) {
    setSelectedIds(
      (currentIds) =>
        currentIds.includes(
          discoveryId,
        )
          ? currentIds.filter(
              (id) =>
                id !==
                discoveryId,
            )
          : [
              ...currentIds,
              discoveryId,
            ],
    )
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds =
        new Set(
          visibleResults.map(
            (job) =>
              job.discoveryId,
          ),
        )

      setSelectedIds(
        (currentIds) =>
          currentIds.filter(
            (id) =>
              !visibleIds.has(id),
          ),
      )

      return
    }

    setSelectedIds(
      (currentIds) => [
        ...new Set([
          ...currentIds,
          ...visibleResults.map(
            (job) =>
              job.discoveryId,
          ),
        ]),
      ],
    )
  }

  function runBulkAction(
    action,
  ) {
    if (
      selectedJobs.length === 0
    ) {
      return
    }

    action(selectedJobs)
    setSelectedIds([])
  }

  const filterOptions = [
    {
      id: "all",
      label: "All",
    },
    {
      id: "new",
      label: "New",
    },
    {
      id: "interested",
      label: "Interested",
    },
    {
      id: "maybe",
      label: "Maybe",
    },
    {
      id: "reviewed",
      label: "Reviewed",
    },
  ]

  return (
    <section
      id="jobs-smart-match"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-violet-500/20 bg-[#151515]"
    >
      <div className="flex flex-col justify-between gap-5 border-b border-zinc-800 px-6 py-5 lg:flex-row lg:items-center">
        <button
          type="button"
          onClick={
            onToggleExpanded
          }
          aria-expanded={expanded}
          aria-controls="smart-match-inbox-content"
          className="group flex min-w-0 flex-1 items-start gap-4 rounded-xl text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300 transition group-hover:bg-violet-500/15">
            <BellRing size={21} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                Smart Match Inbox
              </h2>

              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium",

                  settings.enabled
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400",
                ].join(" ")}
              >
                Discovery{" "}
                {settings.enabled
                  ? "running"
                  : "paused"}
              </span>

              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
                {statusCounts.new} new
              </span>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              {expanded
                ? "Review automatic matches, organise them by interest and save the best opportunities in bulk."
                : "Click to show your automatic job matches."}
            </p>

            {expanded &&
              settings.lastRunAt && (
                <p className="mt-1 text-xs text-zinc-700">
                  Last discovery search{" "}
                  {formatDateTime(
                    settings.lastRunAt,
                  )}
                </p>
              )}
          </div>

          <div className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 transition group-hover:bg-zinc-800 group-hover:text-white">
            {expanded ? (
              <ChevronUp size={17} />
            ) : (
              <ChevronDown size={17} />
            )}
          </div>
        </button>

        <div
          className="flex flex-wrap gap-2"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {expanded &&
            statusCounts.new > 0 && (
              <button
                type="button"
                onClick={
                  onMarkAllReviewed
                }
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                Mark new as reviewed
              </button>
            )}

          <button
            type="button"
            onClick={
              onOpenAutomation
            }
            className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2.5 text-sm text-violet-200 transition hover:bg-violet-500/20"
          >
            <SlidersHorizontal
              size={16}
            />
            Discovery settings
          </button>
        </div>
      </div>

      {expanded && (
        <div
          id="smart-match-inbox-content"
          role="region"
          aria-label="Smart Match Inbox results"
        >
              {message && (
                <div className="border-b border-zinc-800 bg-zinc-900/40 px-6 py-3 text-sm text-zinc-300">
                  {message}
                </div>
              )}

              {results.length > 0 && (
                <div className="border-b border-zinc-800 px-6 py-4">
                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                    <div className="flex flex-wrap gap-2">
                      {filterOptions.map(
                        (option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              setInboxFilter(
                                option.id,
                              )
                            }
                            className={[
                              "rounded-lg border px-3 py-2 text-sm transition",

                              inboxFilter ===
                              option.id
                                ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                                : "border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                            ].join(" ")}
                          >
                            {option.label}{" "}
                            <span className="ml-1 text-xs opacity-70">
                              {
                                statusCounts[
                                  option.id
                                ]
                              }
                            </span>
                          </button>
                        ),
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          visibleResults.length ===
                          0
                        }
                        onClick={
                          toggleAllVisible
                        }
                        className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {allVisibleSelected
                          ? "Clear visible"
                          : "Select visible"}
                      </button>

                      <select
                        value={inboxSort}
                        onChange={(event) =>
                          setInboxSort(
                            event.target.value,
                          )
                        }
                        className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none"
                      >
                        <option value="match">
                          Best match
                        </option>

                        <option value="newest">
                          Newest posted
                        </option>

                        <option value="salary">
                          Highest salary
                        </option>

                        <option value="location">
                          Location A–Z
                        </option>
                      </select>
                    </div>
                  </div>

                  {selectedJobs.length > 0 && (
                    <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 sm:flex-row sm:items-center">
                      <p className="text-sm text-sky-200">
                        {selectedJobs.length}{" "}
                        match
                        {selectedJobs.length ===
                        1
                          ? ""
                          : "es"}{" "}
                        selected
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runBulkAction(
                              onBulkSave,
                            )
                          }
                          className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
                        >
                          Save selected
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            runBulkAction(
                              (jobs) =>
                                onBulkDecision(
                                  jobs,
                                  "interested",
                                ),
                            )
                          }
                          className="rounded-lg border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-500/10"
                        >
                          Interested
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            runBulkAction(
                              (jobs) =>
                                onBulkDecision(
                                  jobs,
                                  "maybe",
                                ),
                            )
                          }
                          className="rounded-lg border border-amber-500/20 px-3 py-2 text-xs text-amber-300 transition hover:bg-amber-500/10"
                        >
                          Maybe
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            runBulkAction(
                              onBulkDismiss,
                            )
                          }
                          className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {results.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                  <BellRing
                    size={25}
                    className="text-zinc-700"
                  />

                  <p className="mt-4 font-medium text-zinc-300">
                    No automatic matches in your inbox
                  </p>

                  <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-600">
                    {settings.enabled
                      ? "BreakVeil will place suitable vacancies here after the next scheduled search. You can also run discovery immediately from Automation."
                      : "Open Automation to choose your search schedule, sources and minimum profile-match score."}
                  </p>
                </div>
              ) : visibleResults.length ===
                0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center px-6 py-8 text-center">
                  <Target
                    size={24}
                    className="text-zinc-700"
                  />

                  <p className="mt-3 text-sm text-zinc-500">
                    No matches are currently in this category.
                  </p>
                </div>
              ) : (
                <div className="jp-masonry p-4 sm:p-6">
                  {visibleResults.map(
                    (job) => {
                      const score =
                        Number(
                          job.matchAnalysis
                            ?.score || 0,
                        )

                      const saved =
                        isJobSaved(job)

                      const selected =
                        selectedIds.includes(
                          job.discoveryId,
                        )

                      const status =
                        job.inboxStatus ||
                        "new"

                      return (
                        <article
                          key={
                            job.discoveryId
                          }
                          className={[
                            "mb-4 inline-block w-full break-inside-avoid rounded-xl border p-5 align-top transition",

                            selected
                              ? "border-sky-500/30 bg-sky-500/5"
                              : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                toggleSelected(
                                  job.discoveryId,
                                )
                              }
                              aria-label={`Select ${job.title || "job"}`}
                              className="mt-1 h-4 w-4 shrink-0 accent-sky-500"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-zinc-100">
                                      {job.title ||
                                        "Untitled vacancy"}
                                    </h3>

                                    <InboxStatusBadge
                                      status={
                                        status
                                      }
                                    />
                                  </div>

                                  <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                                    <Building2
                                      size={15}
                                    />
                                    {job.company ||
                                      "Unknown company"}
                                  </p>
                                </div>

                                <span
                                  className={[
                                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",

                                    getMatchBadgeClass(
                                      score,
                                      Boolean(
                                        job
                                          .matchAnalysis
                                          ?.excludedRole,
                                      ),
                                    ),
                                  ].join(" ")}
                                >
                                  {score}%{" "}
                                  {job
                                    .matchAnalysis
                                    ?.label ||
                                    "match"}
                                </span>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
                                {job.location && (
                                  <span className="flex items-center gap-1.5">
                                    <MapPin
                                      size={13}
                                    />
                                    {
                                      job.location
                                    }
                                  </span>
                                )}

                                {job.salaryText && (
                                  <span className="inline-flex min-h-5 items-center">
                                    {job.salaryText}
                                  </span>
                                )}

                                {job.postedAt && (
                                  <span className="flex items-center gap-1.5">
                                    <CalendarDays
                                      size={13}
                                    />
                                    Posted{" "}
                                    {formatDate(
                                      job.postedAt,
                                    )}
                                  </span>
                                )}

                                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                                  {job.sourceName ||
                                    getProviderLabel(
                                      job.source,
                                    )}
                                </span>
                              </div>

                              {job
                                .matchAnalysis
                                ?.strengths
                                ?.length >
                                0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {job.matchAnalysis.strengths
                                    .slice(0, 2)
                                    .map(
                                      (
                                        strength,
                                      ) => (
                                        <span
                                          key={
                                            strength
                                          }
                                          className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-300"
                                        >
                                          {
                                            strength
                                          }
                                        </span>
                                      ),
                                    )}
                                </div>
                              )}

                              {job.description && (
                                <ExpandableDescription
                                  description={
                                    job.description
                                  }
                                  collapsedLines={
                                    2
                                  }
                                  isSnippet={
                                    Boolean(
                                      job.descriptionIsSnippet,
                                    )
                                  }
                                  sourceName={
                                    job.sourceName ||
                                    job.sourceNames?.[0] ||
                                    ""
                                  }
                                  notice={
                                    job.descriptionNotice ||
                                    ""
                                  }
                                />
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-nowrap items-center gap-1.5 border-t border-zinc-800 pt-4">
                            <button
                              type="button"
                              disabled={saved}
                              onClick={() =>
                                onSave(job)
                              }
                              className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-2 text-[11px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                            >
                              {saved ? (
                                <Check
                                  size={13}
                                />
                              ) : (
                                <Save
                                  size={13}
                                />
                              )}

                              {saved
                                ? "Saved"
                                : "Save"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onSetDecision(
                                  job,
                                  status ===
                                    "interested"
                                    ? "reviewed"
                                    : "interested",
                                )
                              }
                              className={[
                                "h-9 min-w-0 flex-1 whitespace-nowrap rounded-lg border px-2 text-[11px] transition",

                                status ===
                                "interested"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                  : "border-zinc-700 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-300",
                              ].join(" ")}
                            >
                              Interested
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onSetDecision(
                                  job,
                                  status ===
                                    "maybe"
                                    ? "reviewed"
                                    : "maybe",
                                )
                              }
                              className={[
                                "h-9 min-w-0 flex-1 whitespace-nowrap rounded-lg border px-2 text-[11px] transition",

                                status ===
                                "maybe"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                  : "border-zinc-700 text-zinc-400 hover:bg-amber-500/10 hover:text-amber-300",
                              ].join(" ")}
                            >
                              Maybe
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onAnalyse(job)
                              }
                              className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-500/20 px-2 text-[11px] text-violet-300 transition hover:bg-violet-500/10"
                            >
                              <BrainCircuit
                                size={13}
                              />
                              Analyse
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onOpenAssistant(
                                  job,
                                )
                              }
                              className="h-9 min-w-0 flex-1 whitespace-nowrap rounded-lg border border-sky-500/20 px-2 text-[11px] text-sky-300 transition hover:bg-sky-500/10"
                            >
                              AI Assistant
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onOpenListing(
                                  job,
                                )
                              }
                              title="Open original listing"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                            >
                              <ExternalLink
                                size={13}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onDismiss(job)
                              }
                              title="Dismiss match"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-600 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </article>
                      )
                    },
                  )}
                </div>
              )}
        </div>
      )}
    </section>
  )
}

function InboxStatusBadge({
  status,
}) {
  const styles = {
    new:
      "border-violet-500/20 bg-violet-500/10 text-violet-300",

    interested:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",

    maybe:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",

    reviewed:
      "border-zinc-700 bg-zinc-800 text-zinc-400",
  }

  const labels = {
    new: "New",
    interested: "Interested",
    maybe: "Maybe",
    reviewed: "Reviewed",
  }

  return (
    <span
      className={[
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",

        styles[status] ||
          styles.new,
      ].join(" ")}
    >
      {labels[status] ||
        "New"}
    </span>
  )
}


function LiveSearchSection({
  sourceStatus,
  selectedSources,
  configuredSources,
  activeSelectedSources,
  liveSearch,
  showAdvancedFilters,
  liveLoading,
  liveError,
  liveMessage,
  liveResult,
  liveSort,
  livePage,
  hasNextLivePage,
  onReloadSources,
  onToggleSource,
  onUpdateSearch,
  onToggleAdvanced,
  onSearch,
  onRefresh,
  onPreviousPage,
  onNextPage,
  onSaveJob,
  onAnalyseJob,
  onSortChange,
  isJobSaved,
}) {
  function submitSearch(event) {
    event.preventDefault()
    onSearch()
  }

  return (
    <section
      id="jobs-live-search"
      className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515]"
    >
      <div className="flex flex-col justify-between gap-5 border-b border-zinc-800 px-6 py-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
            <Wifi size={21} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Live job search</h2>

              {sourceStatus.loading ? (
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  <LoaderCircle size={14} className="animate-spin" />
                  Checking sources
                </span>
              ) : (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                  {configuredSources.length} connected source
                  {configuredSources.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              Search connected job sources together, then save suitable vacancies
              directly to your tracker.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(sourceStatus.sources).map(([source, details]) => (
            <button
              key={source}
              type="button"
              disabled={!details.configured || sourceStatus.loading}
              onClick={() => onToggleSource(source)}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
                details.configured && selectedSources[source]
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-500",
              ].join(" ")}
            >
              {details.configured && selectedSources[source] ? (
                <Check size={15} />
              ) : (
                <Database size={15} />
              )}

              {details.name || getProviderLabel(source)}
            </button>
          ))}

          <button
            type="button"
            onClick={onReloadSources}
            disabled={sourceStatus.loading}
            title="Refresh source connections"
            className="rounded-lg border border-zinc-700 p-2.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={sourceStatus.loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {selectedSources.arbeitnow && (
        <div className="border-b border-sky-500/15 bg-sky-500/[0.05] px-6 py-3 text-xs leading-5 text-sky-200/80">
          Arbeitnow is Germany-focused. BreakVeil skips it for ordinary UK location searches and keeps only listings that appear to be written mainly in English.
        </div>
      )}

      {(selectedSources.jobicy || selectedSources.remotive) && (
        <div className="border-b border-violet-500/15 bg-violet-500/[0.05] px-6 py-3 text-xs leading-5 text-violet-200/80">
          Jobicy and Remotive are remote-only sources. Use a broad location such as Remote, UK, Europe, EMEA or Worldwide; local city searches skip them rather than returning unsuitable global roles.
        </div>
      )}

      <form onSubmit={submitSearch} className="p-6">
        {sourceStatus.error && (
          <StatusMessage type="error" message={sourceStatus.error} />
        )}

        {!sourceStatus.loading && configuredSources.length === 0 && (
          <StatusMessage
            type="warning"
            message="No job sources are available. Open Settings and check the vacancy-source connections before searching."
          />
        )}

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr_auto]">
          <label>
            <span className={labelClass}>Job title or keywords</span>

            <div className="flex h-12 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 focus-within:border-zinc-500">
              <Search size={17} className="text-zinc-600" />

              <input
                value={liveSearch.keywords}
                onChange={(event) =>
                  onUpdateSearch("keywords", event.target.value)
                }
                placeholder="Administrator, accounts assistant, IT support..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-700"
              />
            </div>
          </label>

          <label>
            <span className={labelClass}>Location</span>

            <div className="flex h-12 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 focus-within:border-zinc-500">
              <MapPin size={17} className="text-zinc-600" />

              <input
                value={liveSearch.location}
                onChange={(event) =>
                  onUpdateSearch("location", event.target.value)
                }
                placeholder="Preston, Manchester or Remote"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-700"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={
              liveLoading ||
              activeSelectedSources.length === 0 ||
              (!liveSearch.keywords.trim() && !liveSearch.location.trim())
            }
            className="mt-auto flex h-12 min-w-40 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {liveLoading ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Search size={17} />
            )}

            {liveLoading ? "Searching..." : "Search jobs"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleAdvanced}
            aria-expanded={showAdvancedFilters}
            aria-controls="live-search-advanced-filters"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <SlidersHorizontal size={16} />
            {showAdvancedFilters ? "Hide filters" : "More filters"}
          </button>

          <p className="text-xs text-zinc-600">
            Results are cached for 15 minutes to reduce API usage.
          </p>
        </div>

        {showAdvancedFilters && (
          <div
            id="live-search-advanced-filters"
            className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
          >
            <div className="jp-grid-compact grid gap-4">
              <SelectField
                label="Distance"
                value={liveSearch.distance}
                onChange={(value) =>
                  onUpdateSearch("distance", Number(value))
                }
                options={[
                  [5, formatPreferenceDistance(5)],
                  [10, formatPreferenceDistance(10)],
                  [15, formatPreferenceDistance(15)],
                  [25, formatPreferenceDistance(25)],
                  [50, formatPreferenceDistance(50)],
                  [100, formatPreferenceDistance(100)],
                ]}
              />

              <TextField
                label="Minimum salary"
                type="number"
                value={liveSearch.minimumSalary}
                onChange={(value) =>
                  onUpdateSearch("minimumSalary", value)
                }
                placeholder="24000"
              />

              <TextField
                label="Maximum salary"
                type="number"
                value={liveSearch.maximumSalary}
                onChange={(value) =>
                  onUpdateSearch("maximumSalary", value)
                }
                placeholder="35000"
              />

              <SelectField
                label="Date posted"
                value={liveSearch.postedWithinDays}
                onChange={(value) =>
                  onUpdateSearch("postedWithinDays", Number(value))
                }
                options={[
                  [0, "Any time"],
                  [1, "Past 24 hours"],
                  [3, "Past 3 days"],
                  [7, "Past week"],
                  [14, "Past 2 weeks"],
                  [30, "Past month"],
                ]}
              />

              <SelectField
                label="Results per source"
                value={liveSearch.resultsPerSource}
                onChange={(value) =>
                  onUpdateSearch("resultsPerSource", Number(value))
                }
                options={[
                  [10, "10 results"],
                  [25, "25 results"],
                  [50, "50 results"],
                ]}
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <FilterGroup title="Contract type">
                <FilterCheckbox
                  label="Permanent"
                  checked={liveSearch.permanent}
                  onChange={(checked) =>
                    onUpdateSearch("permanent", checked)
                  }
                />

                <FilterCheckbox
                  label="Contract"
                  checked={liveSearch.contract}
                  onChange={(checked) =>
                    onUpdateSearch("contract", checked)
                  }
                />

                <FilterCheckbox
                  label="Temporary"
                  checked={liveSearch.temporary}
                  onChange={(checked) =>
                    onUpdateSearch("temporary", checked)
                  }
                />
              </FilterGroup>

              <FilterGroup title="Working pattern">
                <FilterCheckbox
                  label="Full-time"
                  checked={liveSearch.fullTime}
                  onChange={(checked) =>
                    onUpdateSearch("fullTime", checked)
                  }
                />

                <FilterCheckbox
                  label="Part-time"
                  checked={liveSearch.partTime}
                  onChange={(checked) =>
                    onUpdateSearch("partTime", checked)
                  }
                />
              </FilterGroup>
            </div>
          </div>
        )}
      </form>

      {liveLoading && (
        <div className="border-t border-zinc-800 bg-sky-500/5 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
              <LoaderCircle size={21} className="animate-spin" />
            </div>

            <div>
              <p className="font-medium text-sky-200">
                Searching live job sources
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                {liveMessage || "Contacting connected providers..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {!liveLoading && liveError && (
        <div className="border-t border-zinc-800 p-6">
          <StatusMessage type="error" message={liveError} />
        </div>
      )}

      {!liveLoading && liveResult && (
        <LiveResults
          result={liveResult}
          liveMessage={liveMessage}
          liveSort={liveSort}
          page={livePage}
          hasNextPage={hasNextLivePage}
          onRefresh={onRefresh}
          onPreviousPage={onPreviousPage}
          onNextPage={onNextPage}
          onSaveJob={onSaveJob}
          onAnalyseJob={onAnalyseJob}
          onSortChange={onSortChange}
          isJobSaved={isJobSaved}
        />
      )}
    </section>
  )
}

function LiveResults({
  result,
  liveMessage,
  liveSort,
  page,
  hasNextPage,
  onRefresh,
  onPreviousPage,
  onNextPage,
  onSaveJob,
  onAnalyseJob,
  onSortChange,
  isJobSaved,
}) {
  const profileReady = (result.jobs || []).some(
    (job) => job.matchAnalysis?.profileReady,
  )

  return (
    <div className="border-t border-zinc-800">
      <div className="flex flex-col justify-between gap-4 px-6 py-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">Live results</h3>

            {(() => {
              const presentation =
                getSearchResultPresentation(
                  result,
                )

              return (
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-xs font-medium",

                    getHealthToneClass(
                      presentation.tone,
                    ),
                  ].join(
                    " ",
                  )}
                >
                  {
                    presentation.label
                  }
                </span>
              )
            })()}
          </div>

          <p className="mt-2 text-sm text-zinc-500">
            {liveMessage} {result.duplicatesRemoved > 0 && (
              <>
                {result.duplicatesRemoved} duplicate
                {result.duplicatesRemoved === 1 ? "" : "s"} merged.
              </>
            )}
          </p>

          {result.stale && result.cacheCreatedAt && (
            <p className="mt-1 text-xs text-amber-300/75">
              Cached result created {formatDateTime(result.cacheCreatedAt)}. {result.networkState === "waiting"
                ? "The source cards show when another live refresh is allowed."
                : "Live provider errors are shown below."}
            </p>
          )}

          {!result.stale && result.cached && result.cacheExpiresAt && (
            <p className="mt-1 text-xs text-zinc-700">
              Fresh cache expires {formatDateTime(result.cacheExpiresAt)}
            </p>
          )}

          {result.partial && !result.stale && (
            <p className="mt-1 text-xs text-amber-300/75">
              One or more providers did not respond. Available results remain usable and can still be saved.
            </p>
          )}

          <p className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
            <Target size={13} />

            {profileReady
              ? "Results are ranked against your Candidate Profile."
              : "Complete your Candidate Profile for more accurate ranking."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3">
            <Sparkles size={15} className="text-violet-300" />

            <select
              value={liveSort}
              onChange={(event) => onSortChange(event.target.value)}
              className="h-10 bg-transparent text-sm text-zinc-300 outline-none"
            >
              <option value="match">Best profile match</option>
              <option value="newest">Newest first</option>
              <option value="salary">Highest salary</option>
              <option value="source">Job source</option>
            </select>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            <RefreshCw size={16} />
            Refresh live
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={onPreviousPage}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
              aria-label="Show previous results page"
            >
              <ChevronLeft size={16} />
              Previous page
            </button>

            <span className="border-x border-zinc-800 px-3 text-sm text-zinc-500">
              Page {page}
            </span>

            <button
              type="button"
              disabled={!hasNextPage}
              onClick={onNextPage}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-sky-300 transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
              aria-label="Show next results page"
            >
              Next page
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-y border-zinc-800 bg-zinc-950/40 px-6 py-4 md:grid-cols-4">
        <SummaryTile
          icon={Layers3}
          label="Combined"
          value={result.total}
        />

        <SummaryTile
          icon={Database}
          label="Before merging"
          value={result.rawTotal}
        />

        <SummaryTile
          icon={CheckCircle2}
          label="Duplicates removed"
          value={result.duplicatesRemoved}
        />

        <SummaryTile
          icon={Clock3}
          label="Page"
          value={page}
        />
      </div>

      <div className="grid gap-3 border-b border-zinc-800 px-6 py-4 md:grid-cols-2">
        {(result.providers || []).map((provider) => (
          <ProviderResult key={provider.source} provider={provider} />
        ))}
      </div>

      {result.jobs.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <Search size={25} className="text-zinc-700" />

          <p className="mt-4 font-medium">
            {result.errors?.length
              ? "No vacancies available from the responding sources"
              : "No vacancies matched"}
          </p>

          <p className="mt-2 max-w-md text-sm text-zinc-500">
            {result.errors?.length
              ? "Review the provider status above, then retry the unavailable source. Saved jobs and previous searches are unaffected."
              : "Try a broader job title, a larger distance or fewer filters."}
          </p>
        </div>
      ) : (
        <div className="jp-grid-cards gap-4 p-4 sm:p-6">
          {result.jobs.map((job) => (
            <LiveJobCard
              key={job.id}
              job={job}
              saved={isJobSaved(job)}
              onSave={() => onSaveJob(job)}
              onAnalyse={() => onAnalyseJob(job)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 border-t border-zinc-800 px-6 py-5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
          {Object.values(result.attribution || {}).map((attribution) => (
            <a
              key={attribution.label}
              href={attribution.url}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-zinc-300"
            >
              {attribution.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={onPreviousPage}
            className={paginationButtonClass}
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <span className="px-2 text-sm text-zinc-500">Page {page}</span>

          <button
            type="button"
            disabled={!hasNextPage}
            onClick={onNextPage}
            className={paginationButtonClass}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function LiveJobCard({ job, saved, onSave, onAnalyse }) {
  const sourceNames =
    job.sourceNames?.length > 0
      ? job.sourceNames
      : [job.sourceName || getProviderLabel(job.source)]

  const analysis =
    job.matchAnalysis || {
      score: 0,
      label: "Not analysed",
      excludedRole: "",
    }

  return (
    <article className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-zinc-100">
            {job.title}
          </h3>

          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            <Building2 size={15} />
            {job.company || "Company not listed"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              getMatchBadgeClass(
                analysis.score,
                Boolean(analysis.excludedRole),
              ),
            ].join(" ")}
          >
            {analysis.score}% {analysis.label}
          </span>

          {job.isRemote && (
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-300">
              Remote
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-500">
        {job.location && (
          <span className="flex items-center gap-2">
            <MapPin size={14} />
            {job.location}
          </span>
        )}

        {job.salaryText && <span>{job.salaryText}</span>}

        {job.postedAt && (
          <span className="flex items-center gap-2">
            <CalendarDays size={14} />
            Posted {formatDate(job.postedAt)}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sourceNames.map((sourceName) => (
          <span
            key={sourceName}
            className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300"
          >
            {sourceName}
          </span>
        ))}

        {job.contractType && (
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs capitalize text-zinc-400">
            {job.contractType}
          </span>
        )}

        {job.workType && (
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs capitalize text-zinc-400">
            {job.workType}
          </span>
        )}

        {job.duplicateCount > 1 && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
            {job.duplicateCount} listings merged
          </span>
        )}
      </div>

      {analysis.excludedRole && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          Excluded managerial role detected
        </div>
      )}

      {job.description && (
        <ExpandableDescription
          description={job.description}
          collapsedLines={2}
          isSnippet={
            Boolean(
              job.descriptionIsSnippet,
            )
          }
          sourceName={
            job.sourceName ||
            job.sourceNames?.[0] ||
            ""
          }
          notice={
            job.descriptionNotice ||
            ""
          }
        />
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-zinc-800 pt-5">
        <button
          type="button"
          onClick={onAnalyse}
          className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-500/20"
        >
          <BrainCircuit size={16} />
          Analyse job
        </button>

        <button
          type="button"
          disabled={saved}
          onClick={onSave}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-default disabled:bg-emerald-500/10 disabled:text-emerald-300"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? "Saved" : "Save job"}
        </button>

        {(job.applyUrl || job.url) && (
          <a
            href={job.applyUrl || job.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            <ExternalLink size={16} />
            Open listing
          </a>
        )}
      </div>

      {job.sourceListings?.length > 1 && (
        <details className="mt-3 text-xs text-zinc-500">
          <summary className="cursor-pointer select-none transition hover:text-zinc-300">
            View alternate source listings
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {job.sourceListings.map((listing) => {
              const listingUrl = listing.applyUrl || listing.url
              if (!listingUrl) return null
              return (
                <a
                  key={`${listing.source}:${listing.providerId}:${listingUrl}`}
                  href={listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-zinc-800 px-2.5 py-1.5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                >
                  {listing.sourceName || getProviderLabel(listing.source)}
                </a>
              )
            })}
          </div>
        </details>
      )}
    </article>
  )
}

function ExpandableDescription({
  description,
  collapsedLines = 2,
  isSnippet = false,
  sourceName = "",
}) {
  const [expanded, setExpanded] =
    useState(false)

  const text =
    String(description || "").trim()

  if (!text) {
    return null
  }

  const collapsedClass =
    collapsedLines === 3
      ? "line-clamp-3"
      : collapsedLines === 4
        ? "line-clamp-4"
        : "line-clamp-2"

  const providerLabel =
    sourceName
      ? `${sourceName} Summary`
      : "Provider Summary"

  return (
    <div className="mt-4">
      <p
        className={[
          "text-sm leading-6 text-zinc-500",
          expanded
            ? "whitespace-pre-wrap"
            : collapsedClass,
        ].join(" ")}
      >
        {text}
      </p>

      <button
        type="button"
        onClick={() =>
          setExpanded(
            (currentValue) =>
              !currentValue,
          )
        }
        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200"
      >
        {expanded ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )}

        {expanded
          ? "Show less"
          : "Read more"}
      </button>

      {isSnippet && (
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-zinc-800/80 py-3 text-center">
          <CircleAlert
            size={13}
            className="shrink-0 text-zinc-700"
          />

          <p className="text-[11px] leading-5 text-zinc-600">
            <span className="font-medium text-zinc-500">
              {providerLabel}.
            </span>{" "}
            Open the original listing for the complete advert.
          </p>
        </div>
      )}
    </div>
  )
}

function LiveJobAnalysisModal({
  job,
  analysis,
  saved,
  onSave,
  onOpenAssistant,
  onClose,
}) {
  const breakdown = [
    {
      label: "Role fit",
      value: analysis.roleScore,
      maximum: 35,
      icon: Target,
    },
    {
      label: "Skills",
      value: analysis.skillScore,
      maximum: 30,
      icon: Sparkles,
    },
    {
      label: "Location",
      value: analysis.locationScore,
      maximum: 15,
      icon: MapPin,
    },
    {
      label: "Salary",
      value: analysis.salaryScore,
      maximum: 10,
      icon: PoundSterling,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-5 border-b border-zinc-800 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">
                {job.title}
              </h2>

              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  getMatchBadgeClass(
                    analysis.score,
                    Boolean(analysis.excludedRole),
                  ),
                ].join(" ")}
              >
                {analysis.score}% {analysis.label}
              </span>
            </div>

            <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
              <Building2 size={15} />
              {job.company || "Company not listed"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-6">
          {!analysis.profileReady && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-300"
              />

              <div>
                <p className="font-medium text-amber-200">
                  Candidate Profile needs more detail
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-200/70">
                  Add target roles, skills, preferred locations and a minimum
                  salary for a more reliable match score.
                </p>
              </div>
            </div>
          )}

          {analysis.excludedRole && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <CircleAlert
                size={18}
                className="mt-0.5 shrink-0 text-red-300"
              />

              <div>
                <p className="font-medium text-red-200">
                  Excluded role detected
                </p>

                <p className="mt-1 text-sm leading-6 text-red-200/70">
                  This title appears to contain “{analysis.excludedRole}”,
                  which conflicts with your preference to avoid store-management
                  positions.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            {breakdown.map((item) => (
              <AnalysisScoreCard key={item.label} {...item} />
            ))}
          </div>

          <div className="jp-grid-equal mt-6 grid gap-6 xl:grid-cols-2">
            <AnalysisList
              title="Why it matches"
              items={analysis.strengths}
              positive
            />

            <AnalysisList
              title="Things to review"
              items={analysis.concerns}
            />
          </div>

          <div className="jp-grid-equal mt-6 grid gap-6 xl:grid-cols-2">
            <SkillPanel
              title="Matched skills"
              skills={analysis.matchedSkills}
              emptyMessage="No recognised skills were matched automatically."
              positive
            />

            <SkillPanel
              title="Skills not found in your profile"
              skills={analysis.missingSkills}
              emptyMessage="No obvious skill gaps were detected."
            />
          </div>

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="font-semibold">Vacancy summary</h3>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-zinc-500">
              {job.location && (
                <span className="flex items-center gap-2">
                  <MapPin size={14} />
                  {job.location}
                </span>
              )}

              {job.salaryText && (
                <span className="inline-flex min-h-5 items-center">
                  {job.salaryText}
                </span>
              )}

              {job.postedAt && (
                <span className="flex items-center gap-2">
                  <CalendarDays size={14} />
                  Posted {formatDate(job.postedAt)}
                </span>
              )}
            </div>

            {job.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {job.description}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onOpenAssistant}
              className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20"
            >
              <BrainCircuit size={16} />
              Open in AI Assistant
            </button>

            {(job.applyUrl || job.url) && (
              <a
                href={job.applyUrl || job.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                <ExternalLink size={16} />
                Open listing
              </a>
            )}

            <button
              type="button"
              disabled={saved}
              onClick={onSave}
              className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-default disabled:bg-emerald-500/10 disabled:text-emerald-300"
            >
              {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {saved ? "Already saved" : "Save to tracker"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalysisScoreCard({
  label,
  value,
  maximum,
  icon: Icon,
}) {
  const percentage = Math.round((value / maximum) * 100)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <Icon size={14} />
        {label}
      </p>

      <p className="mt-2 text-xl font-bold">
        {value}
        <span className="text-sm font-normal text-zinc-600">
          /{maximum}
        </span>
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-white"
          style={{
            width: `${Math.max(0, Math.min(100, percentage))}%`,
          }}
        />
      </div>
    </div>
  )
}

function AnalysisList({
  title,
  items,
  positive = false,
}) {
  const safeItems =
    Array.isArray(items) && items.length > 0
      ? items
      : [
          positive
            ? "No strong match signals were detected automatically."
            : "No major concerns were detected automatically.",
        ]

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="font-semibold">{title}</h3>

      <div className="mt-4 space-y-3">
        {safeItems.map((item) => (
          <p
            key={item}
            className="flex items-start gap-3 text-sm leading-6 text-zinc-400"
          >
            {positive ? (
              <CheckCircle2
                size={16}
                className="mt-1 shrink-0 text-emerald-300"
              />
            ) : (
              <CircleAlert
                size={16}
                className="mt-1 shrink-0 text-amber-300"
              />
            )}

            {item}
          </p>
        ))}
      </div>
    </section>
  )
}

function SkillPanel({
  title,
  skills,
  emptyMessage,
  positive = false,
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="font-semibold">{title}</h3>

      {Array.isArray(skills) && skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className={[
                "rounded-full border px-2.5 py-1 text-xs",
                positive
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-300",
              ].join(" ")}
            >
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">{emptyMessage}</p>
      )}
    </section>
  )
}

function ActionSummary({
  jobs,
  activeFilter,
  onFilterChange,
}) {
  const counts = {
    all: jobs.length,

    "needs-action":
      jobs.filter(
        jobNeedsAction,
      ).length,

    waiting:
      jobs.filter(
        jobIsWaiting,
      ).length,

    interviews:
      jobs.filter(
        jobHasUpcomingInterview,
      ).length,

    overdue:
      jobs.filter(
        jobIsOverdue,
      ).length,
  }

  const filters = [
    {
      id: "all",
      label: "All",
    },
    {
      id: "needs-action",
      label: "Needs action",
    },
    {
      id: "waiting",
      label: "Waiting",
    },
    {
      id: "interviews",
      label: "Interviews",
    },
    {
      id: "overdue",
      label: "Overdue",
    },
  ]

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
        Quick view
      </span>

      {filters.map((filter) => {
        const selected =
          activeFilter ===
          filter.id

        return (
          <button
            key={filter.id}
            type="button"
            onClick={() =>
              onFilterChange(
                filter.id,
              )
            }
            className={[
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition",
              selected
                ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                : "border-zinc-800 bg-[#151515] text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
            ].join(" ")}
          >
            {filter.label}

            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-[11px]",
                selected
                  ? "bg-sky-500/15 text-sky-300"
                  : "bg-zinc-800 text-zinc-600",
              ].join(" ")}
            >
              {counts[filter.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SavedJobCard({
  job,
  onEdit,
  onDelete,
  onStatusChange,
  onCompleteAction,
  onOpenWorkspace,
}) {
  const actionLabel =
    getJobActionLabel(job)

  const actionDate =
    getJobActionDate(job)

  const overdue =
    jobIsOverdue(job)

  const dueToday =
    isToday(actionDate)

  const upcomingInterview =
    jobHasUpcomingInterview(
      job,
    )

  return (
    <article
      className="group flex h-full flex-col rounded-xl border border-zinc-800 bg-[#151515] p-5 text-left transition hover:border-zinc-600 hover:bg-[#181818]"
    >
      <div className="min-w-0">
        <div className="min-w-0">
          <h2
            className="line-clamp-2 break-words text-lg font-semibold leading-6 text-zinc-100"
            title={
              job.role
            }
          >
            {job.role}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {job.importedFromLiveSearch && (
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">
                Live import
              </span>
            )}

            {overdue && (
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
                Overdue
              </span>
            )}

            {dueToday && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                Due today
              </span>
            )}
          </div>

          <div className="mt-3 flex min-w-0 items-start gap-2 text-sm leading-6 text-zinc-400">
            <Building2
              size={15}
              className="mt-1 shrink-0"
            />

            <span className="min-w-0 break-words">
              {job.company}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenWorkspace()
            }}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:border-sky-500/40 hover:bg-sky-500/20 sm:flex-none"
          >
            <FolderOpen
              size={14}
              className="shrink-0"
            />

            <span className="whitespace-nowrap">
              Open Workspace
            </span>
          </button>

          {job.jobUrl && (
            <a
              href={job.jobUrl}
              onClick={(event) =>
                event.stopPropagation()
              }
              target="_blank"
              rel="noreferrer"
              title="Open job advert"
              aria-label="Open job advert"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            >
              <ExternalLink size={17} />
            </a>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(job)
            }}
            title="Edit job"
            aria-label="Edit job"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <Pencil size={17} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(job)
            }}
            title="Delete job"
            aria-label="Delete job"
            className="rounded-lg p-2 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-3 text-sm text-zinc-500">
        {job.location && (
          <span className="flex items-center gap-2">
            <MapPin size={15} />
            {job.location}
          </span>
        )}

        {job.dateApplied && (
          <span className="flex items-center gap-2">
            <CalendarDays size={15} />
            Applied {formatActionDate(job.dateApplied)}
          </span>
        )}

        {job.postedAt && !job.dateApplied && (
          <span className="flex items-center gap-2">
            <CalendarDays size={15} />
            Posted {formatDate(job.postedAt)}
          </span>
        )}

        {job.salary && (
          <span>{job.salary}</span>
        )}
      </div>

      {actionLabel !== "None" && (
        <div
          className={[
            "mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
            overdue
              ? "border-red-500/20 bg-red-500/5"
              : dueToday
                ? "border-amber-500/20 bg-amber-500/5"
                : "border-zinc-800 bg-zinc-900/40",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <ListTodo
              size={15}
              className={[
                "shrink-0",
                overdue
                  ? "text-red-300"
                  : dueToday
                    ? "text-amber-300"
                    : "text-violet-300",
              ].join(" ")}
            />

            <p className="truncate text-sm text-zinc-300">
              <span className="font-medium">
                {actionLabel}
              </span>

              {actionDate && (
                <span
                  className={[
                    "ml-2 text-xs",
                    overdue
                      ? "text-red-300"
                      : dueToday
                        ? "text-amber-300"
                        : "text-zinc-600",
                  ].join(" ")}
                >
                  {overdue
                    ? "Overdue · "
                    : dueToday
                      ? "Today · "
                      : "Due · "}
                  {formatActionDate(
                    actionDate,
                  )}
                </span>
              )}
            </p>
          </div>

          {actionLabel !==
            "Wait for response" && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onCompleteAction(
                  job.id,
                )
              }}
              className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            >
              Done
            </button>
          )}
        </div>
      )}

      {job.status ===
        "Interview" &&
        (
          job.interviewDate ||
          job.interviewTime ||
          job.interviewLocation ||
          job.interviewLink
        ) && (
          <div className="mt-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CalendarCheck2
                  size={16}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-emerald-200">
                    Interview
                  </p>

                  {upcomingInterview && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                      Upcoming
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  {job.interviewDate && (
                    <p>
                      {formatActionDate(
                        job.interviewDate,
                      )}
                      {job.interviewTime
                        ? ` at ${job.interviewTime}`
                        : ""}
                    </p>
                  )}

                  {job.interviewLocation && (
                    <p className="flex items-center gap-1.5">
                      <MapPin size={12} />
                      {job.interviewLocation}
                    </p>
                  )}

                  {job.interviewLink && (
                    <a
                      href={job.interviewLink}
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sky-300 transition hover:text-sky-200"
                    >
                      <Link2 size={12} />
                      Open meeting link
                    </a>
                  )}
                </div>
              </div>
            </div>

            {job.interviewNotes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-emerald-500/10 pt-3 text-xs leading-5 text-zinc-500">
                {job.interviewNotes}
              </p>
            )}
          </div>
        )}

      {job.sourceNames?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {job.sourceNames.map((sourceName) => (
            <span
              key={sourceName}
              className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300"
            >
              {sourceName}
            </span>
          ))}
        </div>
      )}

      {(job.contactName || job.contactEmail) && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Contact
          </p>

          <div className="space-y-2 text-sm text-zinc-400">
            {job.contactName && (
              <p className="flex items-center gap-2">
                <UserRound size={14} />
                {job.contactName}
              </p>
            )}

            {job.contactEmail && (
              <a
                href={`mailto:${job.contactEmail}`}
                onClick={(event) =>
                  event.stopPropagation()
                }
                className="flex items-center gap-2 transition hover:text-white"
              >
                <Mail size={14} />
                {job.contactEmail}
              </a>
            )}
          </div>
        </div>
      )}

      {job.notes && (
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-lg bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-500">
          {job.notes}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-zinc-800 pt-4">
        <div>
          <p className="text-xs text-zinc-600">
            Application status
          </p>

          {job.updatedAt && (
            <p className="mt-1 text-[11px] text-zinc-700">
              Updated{" "}
              {new Date(
                job.updatedAt,
              ).toLocaleDateString(
                "en-GB",
              )}
            </p>
          )}
        </div>

        <select
          aria-label={`Application status for ${job.role || "job"}`}
          value={job.status}
          onClick={(event) =>
            event.stopPropagation()
          }
          onChange={(event) => {
            event.stopPropagation()
            onStatusChange(
              job.id,
              event.target.value,
            )
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none"
        >
          {statuses.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}

function JobFormModal({
  editingJobId,
  form,
  onUpdateForm,
  onSubmit,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold">
              {editingJobId ? "Edit job" : "Add a job"}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {editingJobId
                ? "Update the details saved for this opportunity."
                : "Record a new opportunity in your tracker."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          <FormSection title="Opportunity">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Job title" required>
                <input
                  autoFocus
                  required
                  value={form.role}
                  onChange={(event) =>
                    onUpdateForm("role", event.target.value)
                  }
                  placeholder="Customer Service Adviser"
                  className={inputClass}
                />
              </Field>

              <Field label="Company" required>
                <input
                  required
                  value={form.company}
                  onChange={(event) =>
                    onUpdateForm("company", event.target.value)
                  }
                  placeholder="Company name"
                  className={inputClass}
                />
              </Field>

              <Field label="Location">
                <input
                  value={form.location}
                  onChange={(event) =>
                    onUpdateForm("location", event.target.value)
                  }
                  placeholder="Manchester or Remote"
                  className={inputClass}
                />
              </Field>

              <Field label="Salary">
                <input
                  value={form.salary}
                  onChange={(event) =>
                    onUpdateForm("salary", event.target.value)
                  }
                  placeholder="£26,000 per year"
                  className={inputClass}
                />
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    onUpdateForm("status", event.target.value)
                  }
                  className={inputClass}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date applied">
                <input
                  type="date"
                  value={form.dateApplied}
                  onChange={(event) =>
                    onUpdateForm("dateApplied", event.target.value)
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Job advert link">
                <input
                  value={form.jobUrl}
                  onChange={(event) =>
                    onUpdateForm("jobUrl", event.target.value)
                  }
                  placeholder="https://example.com/job"
                  className={inputClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Next action">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="What needs doing next?">
                <select
                  value={form.nextAction}
                  onChange={(event) =>
                    onUpdateForm(
                      "nextAction",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                >
                  {nextActionOptions.map(
                    (action) => (
                      <option
                        key={action}
                        value={action}
                      >
                        {action}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Action due date">
                <input
                  type="date"
                  value={form.nextActionDate}
                  onChange={(event) =>
                    onUpdateForm(
                      "nextActionDate",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Follow-up date">
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(event) =>
                    onUpdateForm(
                      "followUpDate",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Interview details">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Interview date">
                <input
                  type="date"
                  value={form.interviewDate}
                  onChange={(event) =>
                    onUpdateForm(
                      "interviewDate",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Interview time">
                <input
                  type="time"
                  value={form.interviewTime}
                  onChange={(event) =>
                    onUpdateForm(
                      "interviewTime",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Location or platform">
                <input
                  value={form.interviewLocation}
                  onChange={(event) =>
                    onUpdateForm(
                      "interviewLocation",
                      event.target.value,
                    )
                  }
                  placeholder="Company office, Microsoft Teams..."
                  className={inputClass}
                />
              </Field>

              <Field label="Meeting link">
                <input
                  value={form.interviewLink}
                  onChange={(event) =>
                    onUpdateForm(
                      "interviewLink",
                      event.target.value,
                    )
                  }
                  placeholder="https://..."
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Interview notes">
                <textarea
                  rows="4"
                  value={form.interviewNotes}
                  onChange={(event) =>
                    onUpdateForm(
                      "interviewNotes",
                      event.target.value,
                    )
                  }
                  placeholder="People attending, preparation notes, questions to ask..."
                  className={`${inputClass} h-auto resize-none py-3`}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Recruiter or hiring contact">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Contact name">
                <input
                  value={form.contactName}
                  onChange={(event) =>
                    onUpdateForm("contactName", event.target.value)
                  }
                  placeholder="Katie Smith"
                  className={inputClass}
                />
              </Field>

              <Field label="Contact email">
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    onUpdateForm("contactEmail", event.target.value)
                  }
                  placeholder="katie@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Notes">
            <Field label="Application notes">
              <textarea
                rows="5"
                value={form.notes}
                onChange={(event) =>
                  onUpdateForm("notes", event.target.value)
                }
                placeholder="Important information, interview details, contact history or reminders..."
                className={`${inputClass} h-auto resize-none py-3`}
              />
            </Field>
          </FormSection>

          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              {editingJobId ? "Save changes" : "Add job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatusMessage({ type, message }) {
  const error = type === "error"

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border p-4",
        error
          ? "border-red-500/20 bg-red-500/10"
          : "border-amber-500/20 bg-amber-500/10",
      ].join(" ")}
    >
      <AlertTriangle
        size={18}
        className={[
          "mt-0.5 shrink-0",
          error ? "text-red-300" : "text-amber-300",
        ].join(" ")}
      />

      <p
        className={[
          "text-sm leading-6",
          error ? "text-red-200" : "text-amber-200",
        ].join(" ")}
      >
        {message}
      </p>
    </div>
  )
}

function ProviderResult({
  provider,
}) {
  const presentation =
    getProviderPresentation(
      provider,
    )

  const toneClass =
    getHealthToneClass(
      presentation.tone,
    )

  return (
    <div
      className={[
        "flex items-center justify-between gap-4 rounded-xl border p-4",

        toneClass,
      ].join(
        " ",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",

            toneClass,
          ].join(
            " ",
          )}
        >
          {provider.skipped ? (
            <CircleAlert
              size={17}
            />
          ) : provider.ok ? (
            <CheckCircle2
              size={17}
            />
          ) : (
            <AlertTriangle
              size={17}
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-medium">
            {
              provider.sourceName
            }
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-zinc-600">
            {provider.deferred
              ? `${provider.notice || "This source is resting briefly."}${provider.retryAt ? ` Try again after ${formatDateTime(provider.retryAt)}.` : ""}`
              : provider.skipped
              ? provider.notice ||
                "This source was not needed for the current search."
              : provider.ok
                ? `${provider.returned} returned · ${Number(
                    provider.available ||
                      0,
                  ).toLocaleString(
                    "en-GB",
                  )} available`
                : provider.error}
          </p>

          {provider.ok &&
            !provider.skipped &&
            provider.notice && (
              <p className="mt-1 break-words text-xs leading-5 text-zinc-500">
                {provider.notice}
              </p>
            )}

          {!provider.ok && !provider.deferred && provider.retryAt && (
            <p className="mt-1 break-words text-xs leading-5 text-amber-300/75">
              BreakVeil will try this source again after {formatDateTime(provider.retryAt)}.
            </p>
          )}
        </div>
      </div>

      <span
        className={[
          "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",

          toneClass,
        ].join(
          " ",
        )}
      >
        {
          presentation.label
        }
      </span>
    </div>
  )
}

function SummaryTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500">
        <Icon size={16} />
      </div>

      <div>
        <p className="text-xs text-zinc-600">{label}</p>
        <p className="mt-0.5 font-semibold">{value}</p>
      </div>
    </div>
  )
}

function TextField({ label, type = "text", value, onChange, placeholder }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={compactInputClass}
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={compactInputClass}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {title}
      </p>

      <div className="mt-3 flex flex-wrap gap-3">{children}</div>
    </div>
  )
}

function FilterCheckbox({ label, checked, onChange }) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
        checked
          ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-500",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />

      {label}
    </label>
  )
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && <span className="ml-1 text-red-400">*</span>}
      </span>

      {children}
    </label>
  )
}

function FormSection({ title, children }) {
  return (
    <section className="mb-7">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>

      {children}
    </section>
  )
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"

const compactInputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"

const labelClass = "mb-2 block text-xs font-medium text-zinc-400"

const paginationButtonClass =
  "flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"

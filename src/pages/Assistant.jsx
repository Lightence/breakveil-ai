import {
  useEffect,
  useMemo,
  useState,
} from "react"

import { useNavigate } from "react-router-dom"

import ApplicationToolkit from "../components/ApplicationToolkit"

import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  GraduationCap,
  Layers3,
  Lightbulb,
  Link2,
  ListChecks,
  MapPin,
  MessageSquareText,
  Plus,
  PoundSterling,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react"

import {
  formatPreferenceDateTime,
} from "../lib/uiPreferences"

import {
  getMatchScoreClass,
} from "../lib/semanticUi"

const profileStorageKey = "jobpilot.candidate-profile"
const jobsStorageKey = "jobpilot.jobs"
const analysisStorageKey = "jobpilot.latest-analysis"
const assistantDraftStorageKey = "jobpilot.assistant-draft"
const assistantHandoffStorageKey = "jobpilot.assistant-handoff"

const emptyVacancy = {
  role: "",
  company: "",
  location: "",
  salary: "",
  jobUrl: "",
  description: "",
  descriptionIsSnippet: false,
  descriptionSource: "",
  descriptionNotice: "",

  status: "",
  dateApplied: "",
  contactName: "",
  contactEmail: "",
  notes: "",

  postedAt: "",
  expiresAt: "",
  contractType: "",
  workType: "",
  category: "",
  isRemote: false,

  liveSearchId: "",
  providerId: "",
  source: "",
  sourceName: "",
  sourceNames: [],
  sourceListings: [],
}

const skillBank = [
  {
    name: "Account Management",
    aliases: [
      "account management",
      "account manager",
      "client accounts",
      "customer accounts",
    ],
  },
  {
    name: "Administration",
    aliases: [
      "administration",
      "administrator",
      "administrative",
      "office support",
    ],
  },
  {
    name: "Bookkeeping",
    aliases: [
      "bookkeeping",
      "purchase ledger",
      "sales ledger",
      "reconciliation",
      "invoicing",
    ],
  },
  {
    name: "Cash Handling",
    aliases: [
      "cash handling",
      "cash reconciliation",
      "till reconciliation",
      "card payments",
    ],
  },
  {
    name: "Communication",
    aliases: [
      "communication",
      "communicate",
      "interpersonal",
      "telephone manner",
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
      "maintain records",
    ],
  },
  {
    name: "Excel",
    aliases: [
      "excel",
      "spreadsheets",
      "spreadsheet",
      "pivot table",
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
      "troubleshooting",
    ],
  },
  {
    name: "Leadership",
    aliases: [
      "leadership",
      "team leader",
      "supervisory",
      "supervisor",
      "lead a team",
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
      "planning",
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
      "business development",
    ],
  },
  {
    name: "Teamwork",
    aliases: [
      "teamwork",
      "team player",
      "working as part of a team",
      "collaborate",
    ],
  },
  {
    name: "Time Management",
    aliases: [
      "time management",
      "prioritise",
      "prioritize",
      "deadlines",
      "workload",
    ],
  },
  {
    name: "Training",
    aliases: [
      "training",
      "train staff",
      "coaching",
      "onboarding",
    ],
  },
  {
    name: "Written Communication",
    aliases: [
      "written communication",
      "report writing",
      "documentation",
      "correspondence",
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

const responsibilitySignals = [
  "administer",
  "advise",
  "answer",
  "assist",
  "audit",
  "build",
  "check",
  "complete",
  "coordinate",
  "create",
  "deliver",
  "develop",
  "ensure",
  "follow up",
  "handle",
  "investigate",
  "liaise",
  "maintain",
  "manage",
  "monitor",
  "organise",
  "organize",
  "prepare",
  "process",
  "provide",
  "record",
  "report",
  "resolve",
  "respond",
  "review",
  "schedule",
  "support",
  "update",
  "work with",
  "you will",
  "your role",
  "day to day",
]

const requirementSignals = [
  "ability to",
  "capable of",
  "essential",
  "experience",
  "familiar with",
  "knowledge",
  "must",
  "must have",
  "proficient",
  "qualification",
  "required",
  "requirements",
  "skills",
  "successful candidate",
  "you will need",
  "you should have",
]

const desirableSignals = [
  "advantage",
  "beneficial",
  "desirable",
  "ideally",
  "nice to have",
  "preferred",
  "would be useful",
]

const workingStyleSignals = [
  "accurate",
  "attention to detail",
  "collaborative",
  "customer focused",
  "deadline",
  "fast paced",
  "flexible",
  "independent",
  "organised",
  "organized",
  "prioritise",
  "prioritize",
  "proactive",
  "professional",
  "team",
  "under pressure",
  "workload",
]

const successMeasureSignals = [
  "accuracy",
  "compliance",
  "deadline",
  "ensure",
  "kpi",
  "measure",
  "performance",
  "quality",
  "service level",
  "sla",
  "target",
  "timely",
  "turnaround",
]

const toolSignals = [
  {
    name: "Microsoft Excel",
    aliases: [
      "excel",
      "spreadsheet",
      "spreadsheets",
    ],
  },
  {
    name: "Microsoft Word",
    aliases: [
      "microsoft word",
      "word documents",
    ],
  },
  {
    name: "Microsoft Outlook",
    aliases: [
      "outlook",
      "shared mailbox",
      "shared inbox",
    ],
  },
  {
    name: "Microsoft Office",
    aliases: [
      "microsoft office",
      "ms office",
      "office 365",
      "microsoft 365",
    ],
  },
  {
    name: "CRM System",
    aliases: [
      "crm",
      "customer relationship management",
    ],
  },
  {
    name: "HR System",
    aliases: [
      "hr system",
      "hris",
      "people system",
      "employee system",
    ],
  },
  {
    name: "Payroll System",
    aliases: [
      "payroll system",
      "payroll software",
    ],
  },
  {
    name: "Case Management System",
    aliases: [
      "case management",
      "case management system",
    ],
  },
  {
    name: "Ticketing System",
    aliases: [
      "ticketing system",
      "service desk",
      "helpdesk system",
    ],
  },
  {
    name: "Database",
    aliases: [
      "database",
      "data management system",
    ],
  },
  {
    name: "SAP",
    aliases: [
      "sap",
    ],
  },
  {
    name: "Sage",
    aliases: [
      "sage",
    ],
  },
  {
    name: "Salesforce",
    aliases: [
      "salesforce",
    ],
  },
]

const descriptionHeadingRules = [
  {
    section: "responsibilities",
    phrases: [
      "responsibilities",
      "key responsibilities",
      "main duties",
      "duties",
      "what you will do",
      "what you'll do",
      "the role",
      "day to day",
      "your role",
    ],
  },
  {
    section: "essential",
    phrases: [
      "essential",
      "essential criteria",
      "requirements",
      "what we need",
      "what you will need",
      "what you'll need",
      "about you",
      "person specification",
      "skills and experience",
    ],
  },
  {
    section: "desirable",
    phrases: [
      "desirable",
      "desirable criteria",
      "nice to have",
      "preferred",
    ],
  },
  {
    section: "workingStyle",
    phrases: [
      "working style",
      "ways of working",
      "who you are",
      "personal qualities",
      "behaviours",
    ],
  },
  {
    section: "benefits",
    phrases: [
      "benefits",
      "what we offer",
      "our offer",
      "rewards",
    ],
  },
]

const responsibilityThemeRules = [
  {
    name: "Administration and Records",
    signals: [
      "admin",
      "document",
      "file",
      "record",
      "database",
      "data entry",
      "update",
    ],
  },
  {
    name: "Customer or Employee Support",
    signals: [
      "customer",
      "client",
      "employee",
      "query",
      "enquiry",
      "respond",
      "support",
      "service",
    ],
  },
  {
    name: "Communication and Coordination",
    signals: [
      "coordinate",
      "liaise",
      "communicate",
      "schedule",
      "meeting",
      "stakeholder",
      "team",
    ],
  },
  {
    name: "Accuracy and Compliance",
    signals: [
      "accurate",
      "audit",
      "check",
      "compliance",
      "confidential",
      "policy",
      "quality",
      "review",
    ],
  },
  {
    name: "Finance and Transactions",
    signals: [
      "account",
      "billing",
      "invoice",
      "payment",
      "payroll",
      "purchase",
      "refund",
    ],
  },
  {
    name: "Systems and Reporting",
    signals: [
      "excel",
      "report",
      "system",
      "software",
      "spreadsheet",
      "technical",
      "ticket",
    ],
  },
]

const roleFamilyRules = [
  {
    name: "People and HR Administration",
    focus:
      "employee records, people processes, internal queries and administrative support",
    keywords: [
      "people administrator",
      "hr administrator",
      "human resources",
      "employee benefits",
      "recruitment administrator",
      "people assistant",
      "hr assistant",
    ],
  },
  {
    name: "Accounts and Finance Support",
    focus:
      "financial records, transactions, invoices, payments and account administration",
    keywords: [
      "accounts",
      "finance",
      "billing",
      "credit control",
      "payroll",
      "purchase ledger",
      "sales ledger",
    ],
  },
  {
    name: "Customer and Client Support",
    focus:
      "handling enquiries, resolving issues and maintaining a positive service experience",
    keywords: [
      "customer service",
      "customer support",
      "client services",
      "contact centre",
      "call centre",
      "customer representative",
    ],
  },
  {
    name: "IT and Service Desk Support",
    focus:
      "responding to technical issues, managing support requests and helping users",
    keywords: [
      "it support",
      "helpdesk",
      "service desk",
      "technical support",
      "support engineer",
    ],
  },
  {
    name: "Office and Business Administration",
    focus:
      "records, correspondence, coordination, scheduling and day-to-day office support",
    keywords: [
      "administrator",
      "administrative assistant",
      "office assistant",
      "office administrator",
      "business support",
      "coordinator",
    ],
  },
  {
    name: "Data and Reporting Support",
    focus:
      "maintaining information, producing reports and supporting data accuracy",
    keywords: [
      "data entry",
      "data administrator",
      "reporting assistant",
      "data assistant",
      "analyst",
    ],
  },
  {
    name: "Operations Support",
    focus:
      "coordinating processes, monitoring work and supporting reliable day-to-day operations",
    keywords: [
      "operations",
      "logistics",
      "service delivery",
      "operations assistant",
      "operations administrator",
    ],
  },
]

function readJson(storageKey, fallbackValue) {
  try {
    const storedValue = localStorage.getItem(storageKey)

    return storedValue
      ? JSON.parse(storedValue)
      : fallbackValue
  } catch {
    return fallbackValue
  }
}

function loadCandidateProfile() {
  const profile = readJson(profileStorageKey, {})

  return profile && typeof profile === "object"
    ? profile
    : {}
}

function loadSavedJobs() {
  const savedJobs = readJson(jobsStorageKey, [])

  return Array.isArray(savedJobs)
    ? savedJobs
    : []
}

function normaliseVacancy(value = {}) {
  const sourceNames = Array.isArray(value.sourceNames)
    ? value.sourceNames.filter(Boolean)
    : []

  return {
    ...emptyVacancy,
    ...value,

    role: String(value.role || value.title || ""),
    company: String(value.company || ""),
    location: String(value.location || ""),
    salary: String(value.salary || value.salaryText || ""),
    jobUrl: String(value.jobUrl || value.applyUrl || value.url || ""),
    description: String(value.description || ""),

    status: String(value.status || ""),
    dateApplied: String(value.dateApplied || ""),
    contactName: String(value.contactName || ""),
    contactEmail: String(value.contactEmail || ""),
    notes: String(value.notes || ""),

    isRemote: Boolean(value.isRemote),
    sourceNames,
    sourceListings: Array.isArray(value.sourceListings)
      ? value.sourceListings
      : [],
  }
}

function loadInitialAssistantState() {
  const handoff = readJson(assistantHandoffStorageKey, null)

  if (handoff?.vacancy) {
    return {
      vacancy: normaliseVacancy(handoff.vacancy),
      importedMeta: {
        origin: handoff.origin || "live-job-search",
        importedAt: handoff.importedAt || new Date().toISOString(),
        matchAnalysis: handoff.matchAnalysis || null,
      },
      consumedHandoff: true,
    }
  }

  const savedDraft = readJson(assistantDraftStorageKey, null)

  if (savedDraft?.vacancy) {
    return {
      vacancy: normaliseVacancy(savedDraft.vacancy),
      importedMeta: savedDraft.importedMeta || null,
      consumedHandoff: false,
    }
  }

  return {
    vacancy: emptyVacancy,
    importedMeta: null,
    consumedHandoff: false,
  }
}

function splitValues(value) {
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

function normaliseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9£]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normaliseUrl(value) {
  const safeValue = String(value || "").trim()

  if (!safeValue) {
    return ""
  }

  if (
    safeValue.startsWith("http://") ||
    safeValue.startsWith("https://")
  ) {
    return safeValue
  }

  return `https://${safeValue}`
}

function tokenise(value) {
  return normaliseText(value)
    .split(" ")
    .filter((token) => token.length > 2)
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))]
}

function detectSkills(text) {
  const normalised = normaliseText(text)

  return skillBank
    .filter((skill) =>
      skill.aliases.some((alias) =>
        normalised.includes(normaliseText(alias)),
      ),
    )
    .map((skill) => skill.name)
}

function getProfileSkillText(profile) {
  return [
    profile.skills,
    profile.professionalSummary,
    profile.strengths,
    profile.currentJobTitle,
    profile.whyThisRole,
  ]
    .filter(Boolean)
    .join(" ")
}

function parseSalaryNumbers(value) {
  const numbers = String(value || "")
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)

  if (!numbers) {
    return []
  }

  return numbers
    .map(Number)
    .filter((number) => Number.isFinite(number))
    .map((number) => {
      if (
        number > 0 &&
        number < 100 &&
        /hour|hourly|per hour|p\/h/i.test(String(value || ""))
      ) {
        return number * 37.5 * 52
      }

      return number
    })
}

function formatCurrency(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return ""
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(number)
}

function cleanDescriptionFragment(
  value,
) {
  return String(
    value ||
      "",
  )
    .replace(
      /<[^>]+>/g,
      " ",
    )
    .replace(
      /^[•●▪◦*+\-–—\s]+/,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .replace(
      /[;:,]\s*$/,
      "",
    )
    .trim()
}

function detectDescriptionHeading(
  value,
) {
  const text =
    cleanDescriptionFragment(
      value,
    )

  const normalised =
    normaliseText(
      text,
    )

  if (
    !normalised ||
    normalised.length >
      90
  ) {
    return ""
  }

  const looksLikeHeading =
    text.endsWith(
      ":",
    ) ||
    text.length <=
      48

  for (
    const rule of
    descriptionHeadingRules
  ) {
    if (
      rule.phrases.some(
        (phrase) => {
          const normalisedPhrase =
            normaliseText(
              phrase,
            )

          return (
            normalised ===
              normalisedPhrase ||
            (looksLikeHeading &&
              normalised.startsWith(
                `${normalisedPhrase} `,
              ))
          )
        },
      )
    ) {
      return rule.section
    }
  }

  return ""
}

function splitDescriptionLine(
  line,
) {
  const cleaned =
    cleanDescriptionFragment(
      line,
    )

  if (!cleaned) {
    return []
  }

  if (
    cleaned.length <=
    220
  ) {
    return [
      cleaned,
    ]
  }

  return cleaned
    .split(
      /(?<=[.!?])\s+|;\s+/,
    )
    .map(
      cleanDescriptionFragment,
    )
    .filter(Boolean)
}

function parseDescriptionFragments(
  description,
) {
  const prepared =
    String(
      description ||
        "",
    )
      .replace(
        /<li[^>]*>/gi,
        "\n",
      )
      .replace(
        /<\/li>/gi,
        "\n",
      )
      .replace(
        /<(?:br|\/p|\/div|\/h[1-6])[^>]*>/gi,
        "\n",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      )
      .replace(
        /\r/g,
        "",
      )

  const lines =
    prepared
      .split(
        /\n+/,
      )
      .flatMap(
        (line) =>
          String(
            line,
          ).split(
            /(?=•|●|▪|◦)/,
          ),
      )

  let section =
    "general"

  const fragments =
    []

  for (
    const rawLine of
    lines
  ) {
    const heading =
      detectDescriptionHeading(
        rawLine,
      )

    if (heading) {
      section =
        heading

      continue
    }

    const lineFragments =
      splitDescriptionLine(
        rawLine,
      )

    for (
      const fragment of
      lineFragments
    ) {
      if (
        fragment.length <
          12 ||
        /^https?:\/\//i.test(
          fragment,
        )
      ) {
        continue
      }

      fragments.push({
        text:
          fragment,

        section,
      })
    }
  }

  if (
    fragments.length ===
    0
  ) {
    return String(
      description ||
        "",
    )
      .replace(
        /•/g,
        ". ",
      )
      .replace(
        /[\r\n]+/g,
        ". ",
      )
      .split(
        /(?<=[.!?])\s+/,
      )
      .map(
        cleanDescriptionFragment,
      )
      .filter(
        (fragment) =>
          fragment.length >=
          12,
      )
      .map(
        (fragment) => ({
          text:
            fragment,

          section:
            "general",
        }),
      )
  }

  return fragments
}

function fragmentMatchesSignals(
  fragment,
  signals,
) {
  const normalised =
    normaliseText(
      fragment,
    )

  return signals.some(
    (signal) =>
      normalised.includes(
        normaliseText(
          signal,
        ),
      ),
  )
}

function extractStructuredItems({
  fragments,
  sections = [],
  signals = [],
  excludeSignals = [],
  limit = 8,
}) {
  const preferred =
    fragments.filter(
      (fragment) =>
        sections.includes(
          fragment.section,
        ),
    )

  const signalMatches =
    fragments.filter(
      (fragment) =>
        signals.length >
          0 &&
        fragmentMatchesSignals(
          fragment.text,
          signals,
        ),
    )

  const combined =
    [
      ...preferred,
      ...signalMatches,
    ]
      .filter(
        (fragment) =>
          !excludeSignals.length ||
          !fragmentMatchesSignals(
            fragment.text,
            excludeSignals,
          ),
      )
      .map(
        (fragment) =>
          fragment.text,
      )

  return uniqueValues(
    combined,
  ).slice(
    0,
    limit,
  )
}

function detectToolsAndSystems(
  vacancyText,
  vacancySkills,
) {
  const normalised =
    normaliseText(
      vacancyText,
    )

  const namedTools =
    toolSignals
      .filter(
        (tool) =>
          tool.aliases.some(
            (alias) =>
              normalised.includes(
                normaliseText(
                  alias,
                ),
              ),
          ),
      )
      .map(
        (tool) =>
          tool.name,
      )

  const technicalSkills =
    vacancySkills.filter(
      (skill) =>
        [
          "Data Entry",
          "IT Support",
          "Microsoft Excel",
          "Microsoft Office",
          "Project Management",
          "Written Communication",
        ].includes(
          skill,
        ),
    )

  return uniqueValues([
    ...namedTools,
    ...technicalSkills,
  ]).slice(
    0,
    10,
  )
}

function detectResponsibilityThemes(
  responsibilities,
) {
  const combined =
    responsibilities.join(
      " ",
    )

  return responsibilityThemeRules
    .filter(
      (theme) =>
        fragmentMatchesSignals(
          combined,
          theme.signals,
        ),
    )
    .map(
      (theme) =>
        theme.name,
    )
    .slice(
      0,
      6,
    )
}

function detectRoleFamily(
  vacancy,
) {
  const title =
    normaliseText(
      vacancy.role,
    )

  const description =
    normaliseText(
      vacancy.description,
    )

  let bestRule =
    null

  let bestScore =
    0

  for (
    const rule of
    roleFamilyRules
  ) {
    let score =
      0

    for (
      const keyword of
      rule.keywords
    ) {
      const normalisedKeyword =
        normaliseText(
          keyword,
        )

      if (
        title.includes(
          normalisedKeyword,
        )
      ) {
        score +=
          4
      } else if (
        description.includes(
          normalisedKeyword,
        )
      ) {
        score +=
          1
      }
    }

    if (
      score >
      bestScore
    ) {
      bestRule =
        rule

      bestScore =
        score
    }
  }

  return (
    bestRule || {
      name:
        "General Support Role",

      focus:
        "supporting day-to-day work, communicating with others and completing the responsibilities described in the advert",
    }
  )
}

function detectRoleLevel(
  role,
) {
  const title =
    normaliseText(
      role,
    )

  if (
    /head|director|senior manager|lead manager/.test(
      title,
    )
  ) {
    return "Senior Leadership"
  }

  if (
    /manager|team leader|supervisor|lead/.test(
      title,
    )
  ) {
    return "Supervisory or Leadership"
  }

  if (
    /trainee|apprentice|graduate|junior/.test(
      title,
    )
  ) {
    return "Entry or Development"
  }

  if (
    /assistant|administrator|coordinator|officer|advisor|adviser/.test(
      title,
    )
  ) {
    return "Support or Specialist"
  }

  return "Not Clearly Stated"
}

function detectWorkPattern(
  vacancy,
) {
  const values =
    uniqueValues([
      vacancy.contractType,
      vacancy.workType,
      vacancy.isRemote
        ? "Remote"
        : "",
    ])

  if (
    values.length >
    0
  ) {
    return values.join(
      " • ",
    )
  }

  const text =
    normaliseText(
      `${vacancy.location} ${vacancy.description}`,
    )

  if (
    text.includes(
      "hybrid",
    )
  ) {
    return "Hybrid"
  }

  if (
    text.includes(
      "remote",
    ) ||
    text.includes(
      "home based",
    )
  ) {
    return "Remote"
  }

  return "Not Clearly Stated"
}

function buildInterviewTopics({
  themes,
  missingSkills,
  roleFamily,
  requirements,
}) {
  const themePrompts = {
    "Administration and Records":
      "Prepare an example of maintaining accurate records or organising administrative information.",

    "Customer or Employee Support":
      "Prepare an example of handling an enquiry, resolving a problem or supporting someone professionally.",

    "Communication and Coordination":
      "Prepare an example of coordinating with colleagues or keeping several people informed.",

    "Accuracy and Compliance":
      "Prepare an example of checking work carefully, following a process or protecting confidential information.",

    "Finance and Transactions":
      "Prepare an example involving payments, invoices, cash, account records or transaction accuracy.",

    "Systems and Reporting":
      "Prepare an example of learning a system, entering data accurately or producing a useful report.",
  }

  const topics =
    themes
      .map(
        (theme) =>
          themePrompts[
            theme
          ],
      )
      .filter(Boolean)

  for (
    const skill of
    missingSkills.slice(
      0,
      2,
    )
  ) {
    topics.push(
      `Be ready to explain your current exposure to ${skill} and how you would build confidence with it.`,
    )
  }

  if (
    requirements.length >
      0
  ) {
    topics.push(
      "Review the essential criteria and prepare evidence that directly supports each one.",
    )
  }

  if (
    topics.length ===
      0
  ) {
    topics.push(
      `Prepare examples that show how your experience supports ${roleFamily.focus}.`,
    )
  }

  return uniqueValues(
    topics,
  ).slice(
    0,
    6,
  )
}

function buildRoleUnderstanding({
  vacancy,
  vacancyText,
  vacancySkills,
  missingSkills,
}) {
  const fragments =
    parseDescriptionFragments(
      vacancy.description,
    )

  const responsibilities =
    extractStructuredItems({
      fragments,

      sections: [
        "responsibilities",
      ],

      signals:
        responsibilitySignals,

      excludeSignals: [
        ...requirementSignals,
        ...desirableSignals,
      ],

      limit:
        10,
    })

  const desirableRequirements =
    extractStructuredItems({
      fragments,

      sections: [
        "desirable",
      ],

      signals:
        desirableSignals,

      limit:
        7,
    })

  const essentialRequirements =
    extractStructuredItems({
      fragments,

      sections: [
        "essential",
      ],

      signals:
        requirementSignals,

      excludeSignals:
        desirableSignals,

      limit:
        9,
    })

  const workingStyle =
    extractStructuredItems({
      fragments,

      sections: [
        "workingStyle",
      ],

      signals:
        workingStyleSignals,

      excludeSignals: [
        ...desirableSignals,
      ],

      limit:
        7,
    })

  const successMeasures =
    extractStructuredItems({
      fragments,

      signals:
        successMeasureSignals,

      limit:
        6,
    })

  const toolsAndSystems =
    detectToolsAndSystems(
      vacancyText,
      vacancySkills,
    )

  const themes =
    detectResponsibilityThemes(
      responsibilities,
    )

  const roleFamily =
    detectRoleFamily(
      vacancy,
    )

  const roleLevel =
    detectRoleLevel(
      vacancy.role,
    )

  const workPattern =
    detectWorkPattern(
      vacancy,
    )

  const wordCount =
    normaliseText(
      vacancy.description,
    )
      .split(
        " ",
      )
      .filter(Boolean)
      .length

  const evidenceCount =
    responsibilities.length +
    essentialRequirements.length +
    desirableRequirements.length

  const advertDetail =
    wordCount >= 250 &&
    evidenceCount >= 6
      ? "Detailed"
      : wordCount >= 100 ||
          evidenceCount >= 3
        ? "Moderate"
        : "Limited"

  const focusText =
    themes.length >
      0
      ? themes
          .slice(
            0,
            3,
          )
          .join(
            ", ",
          )
          .toLowerCase()
      : roleFamily.focus

  const summary =
    `The title and advert wording suggest a ${roleLevel.toLowerCase()} position within ${roleFamily.name.toLowerCase()}, with emphasis on ${focusText}.`

  const interviewTopics =
    buildInterviewTopics({
      themes,
      missingSkills,
      roleFamily,
      requirements:
        essentialRequirements,
    })

  return {
    summary,

    family:
      roleFamily.name,

    level:
      roleLevel,

    workPattern,

    advertDetail,

    themes,

    responsibilities,

    essentialRequirements,

    desirableRequirements,

    toolsAndSystems,

    workingStyle,

    successMeasures,

    interviewTopics,

    sourceNote:
      "Responsibilities and requirements are extracted from the advert where possible. The overview, role family and interview topics are local inferences from the title and wording.",
  }
}

function calculateRoleFit(vacancy, profile) {
  const targetRoles = splitValues(profile.targetRoles)
  const currentRole = String(profile.currentJobTitle || "").trim()
  const vacancyTitle = normaliseText(vacancy.role)
  const vacancyTokens = new Set(tokenise(vacancy.role))

  const candidates = uniqueValues([
    ...targetRoles,
    currentRole,
  ])

  if (candidates.length === 0 || !vacancyTitle) {
    return {
      score: vacancyTitle ? 16 : 0,
      matchedTarget: "",
    }
  }

  let bestScore = 0
  let matchedTarget = ""

  for (const candidate of candidates) {
    const candidateText = normaliseText(candidate)

    if (!candidateText) {
      continue
    }

    let score

    if (
      vacancyTitle.includes(candidateText) ||
      candidateText.includes(vacancyTitle)
    ) {
      score = 35
    } else {
      const candidateTokens = uniqueValues(tokenise(candidate))
      const overlap = candidateTokens.filter((token) =>
        vacancyTokens.has(token),
      ).length

      score = candidateTokens.length
        ? Math.round((overlap / candidateTokens.length) * 30)
        : 0
    }

    if (score > bestScore) {
      bestScore = score
      matchedTarget = candidate
    }
  }

  return {
    score: Math.max(0, Math.min(35, bestScore)),
    matchedTarget,
  }
}

function calculateLocationFit(vacancy, profile) {
  const preferredLocations = uniqueValues([
    ...splitValues(profile.preferredLocations),
    String(profile.city || "").trim(),
  ])

  const vacancyLocation = normaliseText(vacancy.location)
  const remoteRequested = splitValues(profile.workModes).some((mode) =>
    /remote|home/i.test(mode),
  )

  if (vacancy.isRemote && remoteRequested) {
    return {
      score: 15,
      matchedLocation: "Remote",
    }
  }

  if (preferredLocations.length === 0) {
    return {
      score: vacancyLocation ? 8 : 5,
      matchedLocation: "",
    }
  }

  const matchedLocation = preferredLocations.find((location) => {
    const normalisedLocation = normaliseText(location)

    return (
      normalisedLocation &&
      (vacancyLocation.includes(normalisedLocation) ||
        normalisedLocation.includes(vacancyLocation))
    )
  })

  return {
    score: matchedLocation ? 15 : vacancy.isRemote ? 10 : 3,
    matchedLocation: matchedLocation || "",
  }
}

function calculateSalaryFit(vacancy, profile) {
  const minimumSalaryValues = parseSalaryNumbers(profile.minimumSalary)
  const minimumSalary = minimumSalaryValues[0] || 0
  const vacancySalaryValues = parseSalaryNumbers(vacancy.salary)
  const vacancyMaximum = vacancySalaryValues.length
    ? Math.max(...vacancySalaryValues)
    : 0

  if (!minimumSalary) {
    return {
      score: vacancyMaximum ? 8 : 6,
      minimumSalary: 0,
      vacancyMaximum,
    }
  }

  if (!vacancyMaximum) {
    return {
      score: 5,
      minimumSalary,
      vacancyMaximum: 0,
    }
  }

  return {
    score: vacancyMaximum >= minimumSalary ? 10 : 2,
    minimumSalary,
    vacancyMaximum,
  }
}

function buildAnalysis(vacancy, profile, importedQuickAnalysis = null) {
  const vacancyText = [
    vacancy.role,
    vacancy.description,
    vacancy.contractType,
    vacancy.workType,
    vacancy.category,
  ]
    .filter(Boolean)
    .join(" ")

  const profileSkills = detectSkills(getProfileSkillText(profile))
  const vacancySkills = detectSkills(vacancyText)

  const matchedSkills = vacancySkills.filter((skill) =>
    profileSkills.includes(skill),
  )

  const missingSkills = vacancySkills.filter(
    (skill) => !profileSkills.includes(skill),
  )

  let skillsScore

  if (vacancySkills.length === 0) {
    skillsScore = profileSkills.length > 0 ? 18 : 12
  } else {
    skillsScore = Math.round(
      (matchedSkills.length / vacancySkills.length) * 35,
    )
  }

  const roleFit = calculateRoleFit(vacancy, profile)
  const locationFit = calculateLocationFit(vacancy, profile)
  const salaryFit = calculateSalaryFit(vacancy, profile)

  const completenessScore = [
    vacancy.role,
    vacancy.company,
    vacancy.description,
    vacancy.location,
    vacancy.jobUrl,
  ].filter(Boolean).length

  const excludedRole = excludedRolePhrases.find((phrase) =>
    normaliseText(vacancy.role).includes(normaliseText(phrase)),
  )

  let score =
    roleFit.score +
    skillsScore +
    locationFit.score +
    salaryFit.score +
    completenessScore

  if (excludedRole) {
    score -= 35
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  const label = excludedRole
    ? "Excluded role"
    : score >= 80
      ? "Strong match"
      : score >= 65
        ? "Good match"
        : score >= 45
          ? "Possible match"
          : "Weak match"

  const roleUnderstanding =
    buildRoleUnderstanding({
      vacancy,
      vacancyText,
      vacancySkills,
      missingSkills,
    })

  const responsibilities =
    roleUnderstanding
      .responsibilities

  const requirements =
    uniqueValues([
      ...roleUnderstanding
        .essentialRequirements,

      ...roleUnderstanding
        .desirableRequirements,
    ])

  const strengths = []
  const concerns = []

  if (roleFit.matchedTarget) {
    strengths.push(
      `The title overlaps with your target role: ${roleFit.matchedTarget}.`,
    )
  } else {
    concerns.push(
      "The title does not strongly overlap with the target roles saved in your Candidate Profile.",
    )
  }

  if (matchedSkills.length > 0) {
    strengths.push(
      `${matchedSkills.length} recognised skill${matchedSkills.length === 1 ? "" : "s"} appear in both your profile and the vacancy.`,
    )
  }

  if (locationFit.matchedLocation) {
    strengths.push(
      `${locationFit.matchedLocation} matches one of your preferred locations.`,
    )
  } else if (vacancy.isRemote) {
    strengths.push("The vacancy appears to support remote working.")
  }

  if (
    salaryFit.minimumSalary > 0 &&
    salaryFit.vacancyMaximum >= salaryFit.minimumSalary
  ) {
    strengths.push(
      `The advertised salary reaches your minimum target of ${formatCurrency(salaryFit.minimumSalary)}.`,
    )
  }

  if (missingSkills.length > 0) {
    concerns.push(
      `${missingSkills.length} recognised vacancy skill${missingSkills.length === 1 ? " is" : "s are"} not currently found in your profile.`,
    )
  }

  if (
    salaryFit.minimumSalary > 0 &&
    salaryFit.vacancyMaximum > 0 &&
    salaryFit.vacancyMaximum < salaryFit.minimumSalary
  ) {
    concerns.push(
      `The advertised salary appears below your minimum target of ${formatCurrency(salaryFit.minimumSalary)}.`,
    )
  }

  if (!vacancy.description.trim()) {
    concerns.push(
      "The vacancy description is empty, so the analysis is less reliable.",
    )
  }

  if (excludedRole) {
    concerns.unshift(
      `The role contains “${excludedRole}”, which conflicts with your preference to avoid store-management positions.`,
    )
  }

  const profileReady = Boolean(
    String(profile.targetRoles || "").trim() ||
      String(profile.skills || "").trim() ||
      String(profile.professionalSummary || "").trim(),
  )

  return {
    id: crypto.randomUUID(),
    analysedAt: new Date().toISOString(),

    score,
    label,
    profileReady,
    excludedRole: excludedRole || "",

    roleScore: roleFit.score,
    skillsScore,
    locationScore: locationFit.score,
    salaryScore: salaryFit.score,
    completenessScore,

    matchedTarget: roleFit.matchedTarget,
    matchedLocation: locationFit.matchedLocation,
    profileSkills,
    vacancySkills,
    matchedSkills,
    missingSkills,

    strengths,
    concerns,
    responsibilities,
    requirements,
    roleUnderstanding,

    importedQuickScore:
      Number(importedQuickAnalysis?.score) || null,

    vacancy: normaliseVacancy(vacancy),
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
    {
      strong:
        80,

      good:
        65,

      possible:
        45,
    },
  )
}

function getProfileContext(
  profile,
) {
  const targetRoles =
    splitValues(
      profile.targetRoles,
    )

  const preferredLocations =
    splitValues(
      profile.preferredLocations,
    )

  const skills =
    splitValues(
      profile.skills,
    )

  const name =
    profile.preferredName ||
    profile.fullName ||
    "Candidate Profile"

  return {
    name,

    currentRole:
      profile.currentJobTitle ||
      "",

    targetRoleCount:
      targetRoles.length,

    locationCount:
      preferredLocations.length,

    skillCount:
      skills.length,

    ready:
      Boolean(
        targetRoles.length ||
        skills.length ||
        String(
          profile.professionalSummary ||
            "",
        ).trim(),
      ),
  }
}

function formatDateTime(
  value,
) {
  return formatPreferenceDateTime(
    value,
  )
}

export default function Assistant() {
  const navigate = useNavigate()
  const initialState = useMemo(loadInitialAssistantState, [])

  const [candidateProfile, setCandidateProfile] = useState(
    loadCandidateProfile,
  )

  const [savedJobs, setSavedJobs] = useState(loadSavedJobs)

  const [selectedSavedJobId, setSelectedSavedJobId] = useState(
    initialState.importedMeta?.savedJobId || "",
  )

  const [vacancy, setVacancy] = useState(initialState.vacancy)
  const [importedMeta, setImportedMeta] = useState(
    initialState.importedMeta,
  )

  const [analysis, setAnalysis] = useState(() => {
    if (
      initialState.vacancy.role ||
      initialState.vacancy.description
    ) {
      return buildAnalysis(
        initialState.vacancy,
        loadCandidateProfile(),
        initialState.importedMeta?.matchAnalysis,
      )
    }

    return null
  })

  const [analysisDirty, setAnalysisDirty] = useState(false)

  const [
    showClearConfirmation,
    setShowClearConfirmation,
  ] = useState(false)

  const [message, setMessage] = useState(() =>
    initialState.consumedHandoff
      ? "The selected vacancy has been loaded from Live Job Search."
      : "",
  )

  useEffect(() => {
    if (initialState.consumedHandoff) {
      localStorage.removeItem(assistantHandoffStorageKey)
    }
  }, [initialState.consumedHandoff])

  useEffect(() => {
    localStorage.setItem(
      assistantDraftStorageKey,
      JSON.stringify({
        vacancy,
        importedMeta,
        updatedAt: new Date().toISOString(),
      }),
    )
  }, [vacancy, importedMeta])

  useEffect(() => {
    function refreshProfile() {
      const nextProfile = loadCandidateProfile()
      setCandidateProfile(nextProfile)
      setAnalysisDirty(Boolean(analysis))
    }

    window.addEventListener(
      "focus",
      refreshProfile,
    )

    window.addEventListener(
      "jobpilot:profile-updated",
      refreshProfile,
    )

    return () => {
      window.removeEventListener(
        "focus",
        refreshProfile,
      )

      window.removeEventListener(
        "jobpilot:profile-updated",
        refreshProfile,
      )
    }
  }, [analysis])

  useEffect(() => {
    function refreshSavedJobs() {
      setSavedJobs(loadSavedJobs())
    }

    window.addEventListener("focus", refreshSavedJobs)
    window.addEventListener("jobpilot:jobs-updated", refreshSavedJobs)

    return () => {
      window.removeEventListener("focus", refreshSavedJobs)
      window.removeEventListener(
        "jobpilot:jobs-updated",
        refreshSavedJobs,
      )
    }
  }, [])

  function updateVacancy(field, value) {
    setVacancy((currentVacancy) => ({
      ...currentVacancy,

      [field]:
        value,

      ...(field ===
      "description"
        ? {
            descriptionIsSnippet:
              false,

            descriptionSource:
              "manual",

            descriptionNotice:
              "",
          }
        : {}),
    }))

    if (analysis) {
      setAnalysisDirty(true)
    }
  }

  function loadSavedJob(jobId) {
    setSelectedSavedJobId(jobId)

    if (!jobId) {
      return
    }

    const selectedJob = savedJobs.find(
      (job) => job.id === jobId,
    )

    if (!selectedJob) {
      setMessage(
        "That saved job could not be found. Refresh the page and try again.",
      )

      return
    }

    const nextVacancy = normaliseVacancy({
      ...selectedJob,

      role: selectedJob.role || "",
      company: selectedJob.company || "",
      location: selectedJob.location || "",
      salary: selectedJob.salary || "",
      jobUrl: selectedJob.jobUrl || "",
      description: selectedJob.description || "",

      status: selectedJob.status || "",
      dateApplied: selectedJob.dateApplied || "",
      contactName: selectedJob.contactName || "",
      contactEmail: selectedJob.contactEmail || "",
      notes: selectedJob.notes || "",

      sourceNames: Array.isArray(selectedJob.sourceNames)
        ? selectedJob.sourceNames
        : selectedJob.sourceName
          ? [selectedJob.sourceName]
          : [],
    })

    const nextImportedMeta = {
      origin: "saved-job",
      importedAt: new Date().toISOString(),
      savedJobId: selectedJob.id,
      savedJobStatus: selectedJob.status || "Saved",
      matchAnalysis:
        selectedJob.assistantAnalysis ||
        (selectedJob.matchScore !== undefined
          ? {
              score: Number(selectedJob.matchScore) || 0,
              label: selectedJob.matchLabel || "",
            }
          : null),
    }

    const nextAnalysis = buildAnalysis(
      nextVacancy,
      candidateProfile,
      nextImportedMeta.matchAnalysis,
    )

    setVacancy(nextVacancy)
    setImportedMeta(nextImportedMeta)
    setAnalysis(nextAnalysis)
    setAnalysisDirty(false)

    localStorage.setItem(
      analysisStorageKey,
      JSON.stringify(nextAnalysis),
    )

    setMessage(
      `${nextVacancy.role || "Saved job"} at ${
        nextVacancy.company || "the selected company"
      } has been loaded and analysed.`,
    )
  }

  function analyseCurrentVacancy() {
    if (!vacancy.role.trim() && !vacancy.description.trim()) {
      setMessage(
        "Enter a job title or vacancy description before analysing.",
      )

      return
    }

    const nextAnalysis = buildAnalysis(
      vacancy,
      candidateProfile,
      importedMeta?.matchAnalysis,
    )

    setAnalysis(nextAnalysis)
    setAnalysisDirty(false)

    localStorage.setItem(
      analysisStorageKey,
      JSON.stringify(nextAnalysis),
    )

    setMessage(
      `Analysis refreshed: ${nextAnalysis.score}% ${nextAnalysis.label.toLowerCase()}.`,
    )
  }

  function clearAssistant() {
    setVacancy(emptyVacancy)
    setImportedMeta(null)
    setSelectedSavedJobId("")
    setAnalysis(null)
    setAnalysisDirty(false)
    setMessage("AI Assistant cleared. You can paste another vacancy.")

    localStorage.removeItem(assistantDraftStorageKey)
    localStorage.removeItem(assistantHandoffStorageKey)
    localStorage.removeItem(analysisStorageKey)
  }

  function isVacancyAlreadySaved() {
    const savedJobs = readJson(jobsStorageKey, [])
    const safeJobs = Array.isArray(savedJobs) ? savedJobs : []

    const vacancyUrl = normaliseUrl(vacancy.jobUrl)
    const vacancyRole = normaliseText(vacancy.role)
    const vacancyCompany = normaliseText(vacancy.company)
    const vacancyLocation = normaliseText(vacancy.location)

    return safeJobs.some((job) => {
      if (
        vacancy.liveSearchId &&
        job.liveSearchId === vacancy.liveSearchId
      ) {
        return true
      }

      const savedUrl = normaliseUrl(job.jobUrl)

      if (vacancyUrl && savedUrl && vacancyUrl === savedUrl) {
        return true
      }

      return (
        normaliseText(job.role) === vacancyRole &&
        normaliseText(job.company) === vacancyCompany &&
        normaliseText(job.location) === vacancyLocation
      )
    })
  }

  function addVacancyToJobs() {
    if (!vacancy.role.trim() || !vacancy.company.trim()) {
      setMessage(
        "A job title and company are required before adding this vacancy to Jobs.",
      )

      return
    }

    if (isVacancyAlreadySaved()) {
      setMessage(
        `${vacancy.role} at ${vacancy.company} is already in your Jobs tracker.`,
      )

      return
    }

    const latestAnalysis =
      analysis && !analysisDirty
        ? analysis
        : buildAnalysis(
            vacancy,
            candidateProfile,
            importedMeta?.matchAnalysis,
          )

    const savedJobs = readJson(jobsStorageKey, [])
    const safeJobs = Array.isArray(savedJobs) ? savedJobs : []
    const now = new Date().toISOString()

    const sourceNames =
      vacancy.sourceNames.length > 0
        ? vacancy.sourceNames
        : vacancy.sourceName
          ? [vacancy.sourceName]
          : []

    const newJob = {
      id: crypto.randomUUID(),
      role: vacancy.role.trim(),
      company: vacancy.company.trim(),
      location: vacancy.location.trim(),
      salary: vacancy.salary.trim(),
      status: "Saved",
      dateApplied: "",
      jobUrl: normaliseUrl(vacancy.jobUrl),
      contactName: "",
      contactEmail: "",
      notes:
        sourceNames.length > 0
          ? `Imported through AI Assistant from ${sourceNames.join(" and ")}.`
          : "Imported through AI Assistant.",

      description: vacancy.description.trim(),
      descriptionIsSnippet:
        Boolean(
          vacancy.descriptionIsSnippet,
        ),
      descriptionSource:
        vacancy.descriptionSource || "",
      descriptionNotice:
        vacancy.descriptionNotice || "",
      postedAt: vacancy.postedAt || "",
      expiresAt: vacancy.expiresAt || "",
      contractType: vacancy.contractType || "",
      workType: vacancy.workType || "",
      category: vacancy.category || "",
      isRemote: Boolean(vacancy.isRemote),

      liveSearchId: vacancy.liveSearchId || "",
      providerId: vacancy.providerId || "",
      source: vacancy.source || "",
      sourceName: vacancy.sourceName || "",
      sourceNames,
      sourceListings: vacancy.sourceListings,
      importedFromLiveSearch:
        importedMeta?.origin === "live-job-search",

      matchScore: latestAnalysis.score,
      matchLabel: latestAnalysis.label,
      matchedSkills: latestAnalysis.matchedSkills,
      missingSkills: latestAnalysis.missingSkills,
      assistantAnalysis: latestAnalysis,

      createdAt: now,
      updatedAt: now,
    }

    const updatedJobs = [newJob, ...safeJobs]

    localStorage.setItem(
      jobsStorageKey,
      JSON.stringify(updatedJobs),
    )

    localStorage.setItem(
      analysisStorageKey,
      JSON.stringify(latestAnalysis),
    )

    window.dispatchEvent(new Event("jobpilot:jobs-updated"))

    setAnalysis(latestAnalysis)
    setAnalysisDirty(false)
    setMessage(
      `${newJob.role} at ${newJob.company} was added to your Jobs tracker.`,
    )
  }

  const alreadySaved = isVacancyAlreadySaved()

  const profileContext =
    useMemo(
      () =>
        getProfileContext(
          candidateProfile,
        ),
      [candidateProfile],
    )

  const hasVacancy =
    Boolean(
      vacancy.role.trim() ||
        vacancy.company.trim() ||
        vacancy.description.trim(),
    )

  return (
    <div className="min-w-0">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Job-Specific Assistance
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              AI Assistant
            </h1>

            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
              <BrainCircuit size={13} />
              Smart Local Analysis
            </span>

          </div>

          <p className="mt-2 max-w-3xl text-zinc-400">
            Compare one vacancy with your Candidate Profile, review match signals and prepare tailored application content.
          </p>

          <p className="mt-2 text-xs leading-5 text-zinc-600">
            This version uses local rules and saved profile data. It does not contact an online generative AI model.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              "/jobs",
            )
          }
          className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          <ArrowLeft size={16} />
          Back to Jobs
        </button>
      </header>

      <AssistantJobBar
        savedJobs={
          savedJobs
        }
        selectedSavedJobId={
          selectedSavedJobId
        }
        onSelectJob={
          loadSavedJob
        }
        profileContext={
          profileContext
        }
        vacancy={
          vacancy
        }
        importedMeta={
          importedMeta
        }
        analysis={
          analysis
        }
        analysisDirty={
          analysisDirty
        }
        onOpenWorkspace={
          importedMeta?.savedJobId
            ? () =>
                navigate(
                  `/jobs/${importedMeta.savedJobId}`,
                )
            : null
        }
      />

      {message && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-xs text-zinc-400">
          <Lightbulb
            size={14}
            className="mt-0.5 shrink-0 text-zinc-600"
          />

          <span className="leading-5">
            {message}
          </span>
        </div>
      )}

      <div className="jp-grid-panels jp-grid-equal mt-6 gap-6">
        <section className="rounded-xl border border-zinc-800 bg-[#151515]">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
                <FileText size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Vacancy Details
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Review or edit the vacancy information used by the local analysis.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={
                !hasVacancy &&
                !analysis
              }
              onClick={() =>
                setShowClearConfirmation(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={15} />
              Clear Vacancy
            </button>
          </div>

          <div className="p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Job Title">
                <input
                  value={vacancy.role}
                  onChange={(event) =>
                    updateVacancy("role", event.target.value)
                  }
                  placeholder="Administrator"
                  className={inputClass}
                />
              </Field>

              <Field label="Company">
                <input
                  value={vacancy.company}
                  onChange={(event) =>
                    updateVacancy("company", event.target.value)
                  }
                  placeholder="Company name"
                  className={inputClass}
                />
              </Field>

              <Field label="Location">
                <input
                  value={vacancy.location}
                  onChange={(event) =>
                    updateVacancy("location", event.target.value)
                  }
                  placeholder="Preston, Manchester or Remote"
                  className={inputClass}
                />
              </Field>

              <Field label="Salary">
                <input
                  value={vacancy.salary}
                  onChange={(event) =>
                    updateVacancy("salary", event.target.value)
                  }
                  placeholder="£26,000 – £30,000"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Original Job Link">
                <div className="flex h-11 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 focus-within:border-zinc-500">
                  <Link2 size={16} className="text-zinc-600" />

                  <input
                    value={vacancy.jobUrl}
                    onChange={(event) =>
                      updateVacancy("jobUrl", event.target.value)
                    }
                    placeholder="https://example.com/job"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-700"
                  />
                </div>
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Vacancy Description">
                {vacancy.descriptionIsSnippet && (
                  <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-4">
                    <CircleAlert
                      size={17}
                      className="mt-0.5 shrink-0 text-amber-300"
                    />

                    <div>
                      <p className="text-sm font-medium text-amber-200">
                        Provider Description Summary
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-200/65">
                        {vacancy.descriptionNotice ||
                          "The connected source supplied a shortened summary rather than the complete advert. Open the original listing and paste the full description here when you need deeper analysis."}
                      </p>

                      {vacancy.jobUrl && (
                        <a
                          href={
                            vacancy.jobUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-500/10"
                        >
                          <ExternalLink
                            size={14}
                          />
                          Open Full Listing
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <textarea
                  rows="17"
                  value={vacancy.description}
                  onChange={(event) =>
                    updateVacancy("description", event.target.value)
                  }
                  placeholder="Paste the complete vacancy description here..."
                  className={`${inputClass} h-auto resize-y py-3 leading-6`}
                />
              </Field>
            </div>

            {analysisDirty && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0 text-amber-300"
                />

                <p className="text-sm leading-6 text-amber-200/80">
                  The vacancy or Candidate Profile has changed. Re-analyse to
                  refresh the report.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
              <button
                type="button"
                onClick={analyseCurrentVacancy}
                className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                <RefreshCw size={16} />
                {analysis ? "Refresh Analysis" : "Analyse Vacancy"}
              </button>

              <button
                type="button"
                disabled={alreadySaved}
                onClick={addVacancyToJobs}
                className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-default disabled:opacity-60"
              >
                {alreadySaved ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Plus size={16} />
                )}

                {alreadySaved ? "Already in Jobs" : "Add to Jobs"}
              </button>

              {vacancy.jobUrl && (
                <a
                  href={normaliseUrl(vacancy.jobUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  <ExternalLink size={16} />
                  Open Listing
                </a>
              )}
            </div>
          </div>
        </section>

        <AnalysisOverview
          analysis={analysis}
          analysisDirty={analysisDirty}
          candidateProfile={candidateProfile}
          vacancy={
            vacancy
          }
          onAnalyse={analyseCurrentVacancy}
        />
      </div>

      {analysis && (
        <DetailedAnalysis
          analysis={analysis}
          vacancy={vacancy}
          candidateProfile={candidateProfile}
        />
      )}

      {analysis && !analysisDirty && (
        <ApplicationToolkit
          vacancy={vacancy}
          analysis={analysis}
          candidateProfile={candidateProfile}
          workspaceId={
            importedMeta?.savedJobId ||
            vacancy.liveSearchId ||
            vacancy.jobUrl
          }
          onMessage={setMessage}
        />
      )}

      {showClearConfirmation && (
        <ClearAssistantModal
          vacancy={
            vacancy
          }
          onConfirm={() => {
            clearAssistant()

            setShowClearConfirmation(
              false,
            )
          }}
          onClose={() =>
            setShowClearConfirmation(
              false,
            )
          }
        />
      )}
    </div>
  )
}


function AssistantJobBar({
  savedJobs,
  selectedSavedJobId,
  onSelectJob,
  profileContext,
  vacancy,
  importedMeta,
  analysis,
  analysisDirty,
  onOpenWorkspace,
}) {
  const hasVacancy =
    Boolean(
      vacancy.role ||
      vacancy.company ||
      vacancy.description,
    )

  const sortedJobs =
    [...savedJobs].sort(
      (
        first,
        second,
      ) => {
        const firstTime =
          new Date(
            first.updatedAt ||
              first.createdAt ||
              0,
          ).getTime()

        const secondTime =
          new Date(
            second.updatedAt ||
              second.createdAt ||
              0,
          ).getTime()

        return (
          secondTime -
          firstTime
        )
      },
    )

  const sourceLabel =
    importedMeta?.origin ===
      "saved-job"
      ? `My Jobs • ${vacancy.status || importedMeta.savedJobStatus || "Saved"}`
      : importedMeta?.origin ===
          "live-job-search"
        ? `Discover Jobs${
            vacancy.sourceNames
              ?.length
              ? ` • ${vacancy.sourceNames.join(" and ")}`
              : vacancy.sourceName
                ? ` • ${vacancy.sourceName}`
                : ""
          }`
        : hasVacancy
          ? "Manual Vacancy"
          : "No Vacancy Loaded"

  const matchLabel =
    analysis
      ? analysisDirty
        ? "Refresh Required"
        : `${analysis.score}% Match`
      : importedMeta
          ?.matchAnalysis
          ?.score !==
        undefined
        ? `${importedMeta.matchAnalysis.score}% Quick Match`
        : "Not Analysed"

  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-[#151515] p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-600">
            Choose a Tracked Job
          </span>

          <select
            value={
              selectedSavedJobId
            }
            onChange={(event) =>
              onSelectJob(
                event.target.value,
              )
            }
            disabled={
              savedJobs.length ===
              0
            }
            className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {savedJobs.length ===
              0
                ? "No tracked jobs are available"
                : "Choose a tracked job..."}
            </option>

            {sortedJobs.map(
              (job) => (
                <option
                  key={
                    job.id
                  }
                  value={
                    job.id
                  }
                >
                  {job.role ||
                    "Untitled Job"}{" "}
                  —{" "}
                  {job.company ||
                    "Unknown Company"}{" "}
                  ({job.status ||
                    "Saved"})
                </option>
              ),
            )}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
            {savedJobs.length} Tracked Job{savedJobs.length === 1 ? "" : "s"}
          </span>

          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
            {profileContext.name} • {profileContext.targetRoleCount} Target Job{profileContext.targetRoleCount === 1 ? "" : "s"} • {profileContext.skillCount} Skill{profileContext.skillCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300">
            <Briefcase
              size={16}
            />
          </div>

          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold text-zinc-200"
              title={
                vacancy.role
              }
            >
              {vacancy.role ||
                "No Vacancy Selected"}
            </p>

            <p
              className="mt-1 truncate text-xs text-zinc-600"
              title={
                vacancy.company
              }
            >
              {vacancy.company
                ? `${vacancy.company} • ${sourceLabel}`
                : sourceLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold",

              analysisDirty
                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : analysis
                  ? getMatchBadgeClass(
                      Number(
                        analysis.score,
                      ),
                      Boolean(
                        analysis.excludedRole,
                      ),
                    )
                  : "border-zinc-700 bg-zinc-900 text-zinc-400",
            ].join(
              " ",
            )}
          >
            {matchLabel}
          </span>

          {onOpenWorkspace && (
            <button
              type="button"
              onClick={
                onOpenWorkspace
              }
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              <ExternalLink
                size={14}
              />
              Open Workspace
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function ClearAssistantModal({
  vacancy,
  onConfirm,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={
        onClose
      }
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/20 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold">
              Clear Vacancy and Analysis?
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              This removes the current Assistant draft, but does not delete a tracked job from My Jobs.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label="Close clear confirmation"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/35 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {vacancy.role ||
                "Current Vacancy"}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              {vacancy.company ||
                "No company entered"}
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={
              onConfirm
            }
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          >
            <Trash2 size={15} />
            Clear Vacancy
          </button>
        </footer>
      </div>
    </div>
  )
}

function AnalysisOverview({
  analysis,
  analysisDirty,
  candidateProfile,
  vacancy,
  onAnalyse,
}) {
  const [
    copied,
    setCopied,
  ] = useState(false)

  async function copyAnalysisSummary() {
    if (!analysis) {
      return
    }

    const lines = [
      `${vacancy.role || "Vacancy"}${vacancy.company ? ` at ${vacancy.company}` : ""}`,
      `Local Match: ${analysis.score}% — ${analysis.label}`,
      "",
      `Matched Skills: ${analysis.matchedSkills.join(", ") || "None detected"}`,
      `Skills to Review: ${analysis.missingSkills.join(", ") || "None detected"}`,
      "",
      "Why It Matches:",
      ...(analysis.strengths.length
        ? analysis.strengths.map(
            (item) =>
              `- ${item}`,
          )
        : [
            "- No strong match signals were detected automatically.",
          ]),
      "",
      "Things to Review:",
      ...(analysis.concerns.length
        ? analysis.concerns.map(
            (item) =>
              `- ${item}`,
          )
        : [
            "- No major concerns were detected automatically.",
          ]),
      "",
      "Role Understanding:",
      analysis.roleUnderstanding?.summary ||
        "Run the analysis again to generate the expanded role understanding.",
      "",
      "Main Responsibilities:",
      ...(
        analysis.roleUnderstanding
          ?.responsibilities ||
        analysis.responsibilities ||
        []
      ).map(
        (item) =>
          `- ${item}`,
      ),
      "",
      "Essential Requirements:",
      ...(
        analysis.roleUnderstanding
          ?.essentialRequirements ||
        analysis.requirements ||
        []
      ).map(
        (item) =>
          `- ${item}`,
      ),
      "",
      "Interview Topics:",
      ...(
        analysis.roleUnderstanding
          ?.interviewTopics ||
        []
      ).map(
        (item) =>
          `- ${item}`,
      ),
    ]

    try {
      await navigator.clipboard.writeText(
        lines.join(
          "\n",
        ),
      )

      setCopied(
        true,
      )

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1800,
      )
    } catch {
      setCopied(
        false,
      )
    }
  }
  if (!analysis) {
    return (
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#111111] px-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
          <BrainCircuit size={25} />
        </div>

        <h2 className="mt-5 text-lg font-semibold">
          Ready to Analyse
        </h2>

        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
          Load a tracked job or enter vacancy details, then compare the role with your saved Candidate Profile.
        </p>

        <button
          type="button"
          onClick={onAnalyse}
          className="mt-5 flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Sparkles size={16} />
          Analyse Vacancy
        </button>
      </section>
    )
  }

  const profileName =
    candidateProfile.preferredName ||
    candidateProfile.fullName ||
    "your profile"

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
              <Target size={19} />
            </div>

            <div>
              <h2 className="font-semibold">
                Local Profile Comparison
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Compared locally against {profileName}. No online AI request is made.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {analysisDirty && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                Needs Refresh
              </span>
            )}

            <button
              type="button"
              onClick={
                copyAnalysisSummary
              }
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              {copied ? (
                <CheckCircle2 size={14} />
              ) : (
                <Copy size={14} />
              )}

              {copied
                ? "Copied"
                : "Copy Summary"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <div
            className={[
              "mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 text-3xl font-bold",
              getMatchBadgeClass(
                analysis.score,
                Boolean(analysis.excludedRole),
              ),
            ].join(" ")}
          >
            {analysis.score}%
          </div>

          <h3 className="mt-4 text-xl font-semibold">{analysis.label}</h3>

          <p className="mt-2 text-sm text-zinc-500">
            Analysed {formatDateTime(analysis.analysedAt)}
          </p>
        </div>

        {!analysis.profileReady && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0 text-amber-300"
            />

            <p className="text-sm leading-6 text-amber-200/80">
              Add more target roles, skills and preferences to your Candidate
              Profile for a stronger comparison.
            </p>
          </div>
        )}

        {analysis.excludedRole && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <CircleAlert
              size={17}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <p className="text-sm leading-6 text-red-200/80">
              Excluded role detected: {analysis.excludedRole}.
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniScore label="Role Fit" value={analysis.roleScore} maximum={35} />
          <MiniScore label="Skills" value={analysis.skillsScore} maximum={35} />
          <MiniScore label="Location" value={analysis.locationScore} maximum={15} />
          <MiniScore label="Salary" value={analysis.salaryScore} maximum={10} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard
            label="Skills Matched"
            value={analysis.matchedSkills.length}
          />

          <StatCard
            label="Skills to Review"
            value={analysis.missingSkills.length}
          />
        </div>

        <button
          type="button"
          onClick={() => navigateToProfile()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          <UserRound size={16} />
          Review Candidate Profile
        </button>
      </div>
    </section>
  )
}

function navigateToProfile() {
  window.location.hash = "#/profile"
}

function DetailedAnalysis({
  analysis,
  vacancy,
  candidateProfile,
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="jp-grid-panels jp-grid-equal gap-6">
        <AnalysisList
          title="Why It Matches"
          icon={CheckCircle2}
          items={analysis.strengths}
          positive
        />

        <AnalysisList
          title="Things to Review"
          icon={CircleAlert}
          items={analysis.concerns}
        />
      </div>

      <div className="jp-grid-panels jp-grid-equal gap-6">
        <SkillPanel
          title="Matched Skills"
          skills={analysis.matchedSkills}
          emptyMessage="No recognised skills were matched automatically."
          positive
        />

        <SkillPanel
          title="Skills Not Found in Your Profile"
          skills={analysis.missingSkills}
          emptyMessage="No obvious recognised skill gaps were detected."
        />
      </div>

      <RoleUnderstanding
        analysis={
          analysis
        }
        vacancy={
          vacancy
        }
      />

      <section className="rounded-xl border border-zinc-800 bg-[#151515]">
        <div className="flex items-start gap-3 border-b border-zinc-800 px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
            <Lightbulb size={19} />
          </div>

          <div>
            <h2 className="font-semibold">Application Guidance</h2>

            <p className="mt-1 text-sm text-zinc-500">
              Useful profile details to draw on when tailoring this application.
            </p>
          </div>
        </div>

        <div className="jp-grid-cards gap-5 p-4 sm:p-6">
          <GuidanceCard
            title="Professional Summary"
            value={candidateProfile.professionalSummary}
            emptyMessage="Add a professional summary in Candidate Profile."
          />

          <GuidanceCard
            title="Key Strengths"
            value={candidateProfile.strengths}
            emptyMessage="Add your strengths in Candidate Profile."
          />

          <GuidanceCard
            title="Why This Role"
            value={candidateProfile.whyThisRole}
            emptyMessage="Add a reusable motivation statement in Candidate Profile."
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-[#151515] p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Vacancy Source</h2>

            <p className="mt-1 text-sm text-zinc-500">
              {vacancy.sourceNames.length > 0
                ? vacancy.sourceNames.join(" and ")
                : vacancy.sourceName || "Manual input"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-zinc-500">
            {vacancy.location && (
              <span className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <MapPin size={14} />
                {vacancy.location}
              </span>
            )}

            {vacancy.salary && (
              <span className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <PoundSterling size={14} />
                {vacancy.salary}
              </span>
            )}

            {vacancy.company && (
              <span className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <Building2 size={14} />
                {vacancy.company}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function RoleUnderstanding({
  analysis,
  vacancy,
}) {
  const [
    activeView,
    setActiveView,
  ] = useState(
    "overview",
  )

  const insight =
    analysis.roleUnderstanding || {
      summary:
        "This analysis was created before the expanded role-understanding system was added. Select Refresh Analysis to generate the fuller breakdown.",

      family:
        "Not Yet Analysed",

      level:
        "Not Yet Analysed",

      workPattern:
        vacancy.workType ||
        vacancy.contractType ||
        "Not Clearly Stated",

      advertDetail:
        "Limited",

      themes:
        [],

      responsibilities:
        analysis.responsibilities ||
        [],

      essentialRequirements:
        analysis.requirements ||
        [],

      desirableRequirements:
        [],

      toolsAndSystems:
        analysis.vacancySkills ||
        [],

      workingStyle:
        [],

      successMeasures:
        [],

      interviewTopics:
        [],

      sourceNote:
        "Refresh the analysis to separate advert evidence from local inferences.",
    }

  const views = [
    {
      id:
        "overview",

      label:
        "Overview",
    },
    {
      id:
        "responsibilities",

      label:
        "Responsibilities",

      count:
        insight
          .responsibilities
          .length,
    },
    {
      id:
        "requirements",

      label:
        "Requirements",

      count:
        insight
          .essentialRequirements
          .length +
        insight
          .desirableRequirements
          .length,
    },
    {
      id:
        "working-style",

      label:
        "Working Style",

      count:
        insight
          .workingStyle
          .length,
    },
    {
      id:
        "interview",

      label:
        "Interview Prep",

      count:
        insight
          .interviewTopics
          .length,
    },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#151515]">
      <header className="flex flex-col justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
            <Layers3
              size={19}
            />
          </div>

          <div>
            <h2 className="font-semibold">
              Role Understanding
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              A structured view of what the job involves, what the employer appears to need and what to prepare for.
            </p>
          </div>
        </div>

        <span className="w-fit rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
          {insight.advertDetail} Advert Detail
        </span>
      </header>

      <div className="border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div className="flex gap-2 overflow-x-auto">
          {views.map(
            (view) => (
              <button
                key={
                  view.id
                }
                type="button"
                onClick={() =>
                  setActiveView(
                    view.id,
                  )
                }
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",

                  activeView ===
                    view.id
                    ? "border-zinc-600 bg-zinc-800 text-white"
                    : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-300",
                ].join(
                  " ",
                )}
              >
                {
                  view.label
                }

                {Number.isFinite(
                  view.count,
                ) && (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-500">
                    {
                      view.count
                    }
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {activeView ===
          "overview" && (
          <RoleOverview
            insight={
              insight
            }
          />
        )}

        {activeView ===
          "responsibilities" && (
          <div className="jp-grid-panels jp-grid-equal gap-5">
            <InsightListCard
              title="Main Responsibilities"
              icon={
                ListChecks
              }
              items={
                insight.responsibilities
              }
              emptyMessage="The advert does not provide enough clear duty statements."
              sourceLabel="Detected in Advert"
            />

            <InsightListCard
              title="Success Measures"
              icon={
                Gauge
              }
              items={
                insight.successMeasures
              }
              emptyMessage="The advert does not clearly state targets, service levels or quality measures."
              sourceLabel="Detected in Advert"
            />
          </div>
        )}

        {activeView ===
          "requirements" && (
          <div className="space-y-5">
            <div className="jp-grid-panels jp-grid-equal gap-5">
              <InsightListCard
                title="Essential Requirements"
                icon={
                  GraduationCap
                }
                items={
                  insight
                    .essentialRequirements
                }
                emptyMessage="No clearly labelled essential requirements were detected."
                sourceLabel="Detected in Advert"
              />

              <InsightListCard
                title="Desirable Requirements"
                icon={
                  CheckCircle2
                }
                items={
                  insight
                    .desirableRequirements
                }
                emptyMessage="No clearly labelled desirable criteria were detected."
                sourceLabel="Detected in Advert"
              />
            </div>

            <InsightTagCard
              title="Tools and Systems"
              icon={
                Wrench
              }
              items={
                insight
                  .toolsAndSystems
              }
              emptyMessage="No named software, systems or technical tools were detected."
            />
          </div>
        )}

        {activeView ===
          "working-style" && (
          <div className="jp-grid-panels jp-grid-equal gap-5">
            <InsightListCard
              title="Working Style"
              icon={
                Users
              }
              items={
                insight.workingStyle
              }
              emptyMessage="The advert gives limited information about pace, teamwork or working approach."
              sourceLabel="Detected in Advert"
            />

            <InsightTagCard
              title="Responsibility Themes"
              icon={
                Briefcase
              }
              items={
                insight.themes
              }
              emptyMessage="Not enough detailed responsibilities were detected to group into themes."
            />
          </div>
        )}

        {activeView ===
          "interview" && (
          <InsightListCard
            title="Topics to Prepare"
            icon={
              MessageSquareText
            }
            items={
              insight
                .interviewTopics
            }
            emptyMessage="Refresh the analysis after adding a fuller vacancy description to generate preparation topics."
            sourceLabel="Local Inference"
          />
        )}
      </div>

      <footer className="border-t border-zinc-800 bg-zinc-950/25 px-5 py-4 sm:px-6">
        <p className="text-xs leading-5 text-zinc-600">
          {
            insight.sourceNote
          }
        </p>
      </footer>
    </section>
  )
}

function RoleOverview({
  insight,
}) {
  const facts = [
    {
      label:
        "Role Family",

      value:
        insight.family,
    },
    {
      label:
        "Likely Level",

      value:
        insight.level,
    },
    {
      label:
        "Work Pattern",

      value:
        insight.workPattern,
    },
    {
      label:
        "Advert Detail",

      value:
        insight.advertDetail,
    },
  ]

  return (
    <div>
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-5">
        <div className="flex items-start gap-3">
          <BrainCircuit
            size={18}
            className="mt-0.5 shrink-0 text-violet-300"
          />

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300/70">
              Local Inference
            </p>

            <p className="mt-2 text-sm leading-7 text-zinc-300">
              {
                insight.summary
              }
            </p>
          </div>
        </div>
      </div>

      <dl className="jp-grid-compact mt-5 gap-3">
        {facts.map(
          (fact) => (
            <div
              key={
                fact.label
              }
              className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/30 p-4"
            >
              <dt className="text-xs text-zinc-600">
                {
                  fact.label
                }
              </dt>

              <dd
                className="mt-2 break-words text-sm font-medium leading-6 text-zinc-300"
                title={
                  fact.value
                }
              >
                {
                  fact.value
                }
              </dd>
            </div>
          ),
        )}
      </dl>

      <InsightTagCard
        title="Responsibility Themes"
        icon={
          Briefcase
        }
        items={
          insight.themes
        }
        emptyMessage="Add a fuller vacancy description to identify the main responsibility themes."
        compact
      />
    </div>
  )
}

function InsightListCard({
  title,
  icon:
    Icon,
  items,
  emptyMessage,
  sourceLabel,
}) {
  const safeItems =
    Array.isArray(
      items,
    )
      ? items
      : []

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/25 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon
            size={17}
            className="shrink-0 text-sky-300"
          />

          <h3 className="text-sm font-semibold text-zinc-200">
            {title}
          </h3>
        </div>

        {sourceLabel && (
          <span className="shrink-0 rounded-full border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-600">
            {
              sourceLabel
            }
          </span>
        )}
      </div>

      {safeItems.length >
      0 ? (
        <div className="mt-4 space-y-3">
          {safeItems.map(
            (
              item,
              index,
            ) => (
              <div
                key={`${item}-${index}`}
                className="flex items-start gap-3 text-sm leading-6 text-zinc-400"
              >
                <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-500">
                  {index + 1}
                </span>

                <p>
                  {item}
                </p>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          {emptyMessage}
        </p>
      )}
    </article>
  )
}

function InsightTagCard({
  title,
  icon:
    Icon,
  items,
  emptyMessage,
  compact = false,
}) {
  const safeItems =
    Array.isArray(
      items,
    )
      ? items
      : []

  return (
    <article
      className={[
        "rounded-xl border border-zinc-800 bg-zinc-950/25",

        compact
          ? "mt-5 p-4"
          : "p-5",
      ].join(
        " ",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          size={17}
          className="text-sky-300"
        />

        <h3 className="text-sm font-semibold text-zinc-200">
          {title}
        </h3>
      </div>

      {safeItems.length >
      0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {safeItems.map(
            (item) => (
              <span
                key={
                  item
                }
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400"
              >
                {item}
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          {emptyMessage}
        </p>
      )}
    </article>
  )
}

function MiniScore({ label, value, maximum }) {
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((value / maximum) * 100)),
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">{label}</p>

        <p className="text-sm font-semibold">
          {value}
          <span className="text-zinc-600">/{maximum}</span>
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function AnalysisList({
  title,
  icon: Icon,
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
    <section className="rounded-xl border border-zinc-800 bg-[#151515] p-6">
      <div className="flex items-center gap-3">
        <Icon
          size={18}
          className={positive ? "text-emerald-300" : "text-amber-300"}
        />

        <h2 className="font-semibold">{title}</h2>
      </div>

      <div className="mt-5 space-y-3">
        {safeItems.map((item) => (
          <p
            key={item}
            className="flex items-start gap-3 text-sm leading-6 text-zinc-400"
          >
            {positive ? (
              <CheckCircle2
                size={15}
                className="mt-1 shrink-0 text-emerald-300"
              />
            ) : (
              <CircleAlert
                size={15}
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
    <section className="rounded-xl border border-zinc-800 bg-[#151515] p-6">
      <div className="flex items-center gap-3">
        <Sparkles
          size={18}
          className={positive ? "text-emerald-300" : "text-amber-300"}
        />

        <h2 className="font-semibold">{title}</h2>
      </div>

      {Array.isArray(skills) && skills.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className={[
                "rounded-full border px-3 py-1.5 text-xs",
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
        <p className="mt-4 text-sm text-zinc-500">{emptyMessage}</p>
      )}
    </section>
  )
}

function GuidanceCard({ title, value, emptyMessage }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
        {String(value || "").trim() || emptyMessage}
      </p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
      </span>

      {children}
    </label>
  )
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"

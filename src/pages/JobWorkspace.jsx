import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Briefcase,
  Building2,
  Activity,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  HelpCircle,
  History,
  Link2,
  ListTodo,
  LoaderCircle,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
  UserRound,
  X,
} from "lucide-react"

import {
  useNavigate,
  useParams,
} from "react-router-dom"

import {
  appendJobActivity,
  appendJobActivityToJobs,
  buildJobActivityTimeline,
  createJobActivity,
} from "../lib/jobActivity"

import {
  formatPreferenceDate,
  formatPreferenceDateTime,
  getApplicationPreferences,
} from "../lib/uiPreferences"

import {
  getJobStatusClass,
  getMatchScoreClass,
  getPackageStatusClass,
} from "../lib/semanticUi"

import {
  getCoverLetterFormatPreference,
  saveGeneratedCoverLetterToLibrary,
} from "../components/CoverLetterExport"

import CompanyResearchPanel from "../components/CompanyResearchPanel"
import ApplicationReviewChecklist from "../components/ApplicationReviewChecklist"

import {
  buildApplicationPreparation,
  emptyReviewAcknowledgements,
  normaliseReviewAcknowledgements,
} from "../lib/applicationPreparation"

import {
  buildApplicationResearchMotivation,
  buildCompanyResearchLikelyInterviewQuestions,
  buildCompanyResearchQuestions,
  buildCompanyResearchQuickBrief,
  formatResearchDate,
  getResearchSourceNumbers,
  mergeResearchHistory,
} from "../lib/companyResearch"

const jobsStorageKey =
  "jobpilot.jobs"

const queueStorageKey =
  "jobpilot.application-queue"

const profileStorageKey =
  "jobpilot.candidate-profile"

const assistantHandoffStorageKey =
  "jobpilot.assistant-handoff"

const jobsViewStorageKey =
  "jobpilot.jobs-view"

const jobStatuses = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
]

const interviewFormats = [
  "In person",
  "Video call",
  "Telephone",
  "Assessment centre",
  "Other",
]

const interviewChecklistItems = [
  {
    id: "researchCompany",
    label: "Research the company",
  },
  {
    id: "reviewRole",
    label: "Review the job description",
  },
  {
    id: "prepareExamples",
    label: "Prepare interview examples",
    help:
      "Choose real situations from your experience and explain them using Situation, Task, Action and Result.",
  },
  {
    id: "prepareQuestions",
    label: "Prepare questions to ask",
  },
  {
    id: "testSetup",
    label: "Check travel or meeting setup",
  },
]

const commonInterviewQuestions = [
  "Tell me about yourself.",
  "Why do you want this role?",
  "Why do you want to work for this company?",
  "Describe a difficult situation and how you handled it.",
  "What are your main strengths?",
  "What would you like to improve professionally?",
]

const emptyApplicationForm = {
  cvId: "",
  coverLetterId: "",
  recipientName: "",
  recipientEmail: "",
  emailSubject: "",
  emailBody: "",
  tailoredCoverLetter: "",
  tailoredCvSummary: "",
  tailoringKeywords: "",
  notes: "",
  reviewAcknowledgements: { ...emptyReviewAcknowledgements },
}

const emptyGmailStatus = {
  configured: false,
  connected: false,
  email: "",
  needsReconnect: false,
  error: "",
}

function loadStoredArray(
  storageKey,
) {
  try {
    const storedValue =
      localStorage.getItem(
        storageKey,
      )

    const parsedValue =
      storedValue
        ? JSON.parse(
            storedValue,
          )
        : []

    return Array.isArray(
      parsedValue,
    )
      ? parsedValue
      : []
  } catch {
    return []
  }
}

function upsertDocument(
  documents,
  document,
) {
  if (
    !document?.id
  ) {
    return Array.isArray(
      documents,
    )
      ? documents
      : []
  }

  const safeDocuments =
    Array.isArray(
      documents,
    )
      ? documents
      : []

  const exists =
    safeDocuments.some(
      (item) =>
        item.id ===
        document.id,
    )

  return exists
    ? safeDocuments.map(
        (item) =>
          item.id ===
          document.id
            ? document
            : item,
      )
    : [
        document,
        ...safeDocuments,
      ]
}

function loadProfile() {
  try {
    const storedProfile =
      localStorage.getItem(
        profileStorageKey,
      )

    const parsedProfile =
      storedProfile
        ? JSON.parse(
            storedProfile,
          )
        : {}

    return (
      parsedProfile &&
      typeof parsedProfile ===
        "object"
    )
      ? parsedProfile
      : {}
  } catch {
    return {}
  }
}

function normaliseInterviewChecklist(
  value,
) {
  const checklist =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {}

  return Object.fromEntries(
    interviewChecklistItems.map(
      (item) => [
        item.id,
        Boolean(
          checklist[item.id],
        ),
      ],
    ),
  )
}

function normaliseText(
  value,
) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function uniqueTextValues(
  values,
) {
  const seen =
    new Set()

  return values.filter(
    (value) => {
      const cleaned =
        String(value || "")
          .trim()

      const key =
        normaliseText(
          cleaned,
        )

      if (
        !cleaned ||
        !key ||
        seen.has(key)
      ) {
        return false
      }

      seen.add(key)
      return true
    },
  )
}

function splitTextLines(
  value,
) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(
          /^[-•\d.)\s]+/,
          "",
        )
        .trim(),
    )
    .filter(Boolean)
}

function mergeTextLines(
  existing,
  generated,
) {
  return uniqueTextValues([
    ...splitTextLines(
      existing,
    ),
    ...generated,
  ]).join("\n")
}

function trimSuggestion(
  value,
  maximum = 100,
) {
  const cleaned =
    String(value || "")
      .replace(/\s+/g, " ")
      .replace(
        /^[-•\s]+/,
        "",
      )
      .trim()

  if (
    cleaned.length <=
    maximum
  ) {
    return cleaned
  }

  return `${cleaned
    .slice(
      0,
      maximum - 1,
    )
    .replace(
      /[,;:\s]+$/,
      "",
    )}…`
}

function extractDescriptionSentences(
  description,
) {
  return String(
    description || "",
  )
    .replace(/•/g, ". ")
    .replace(
      /[\r\n]+/g,
      ". ",
    )
    .split(
      /(?<=[.!?])\s+/,
    )
    .map((sentence) =>
      sentence
        .replace(
          /^[-–—\s]+/,
          "",
        )
        .trim(),
    )
    .filter(
      (sentence) =>
        sentence.length >= 30,
    )
}

const interviewThemeDefinitions = [
  {
    label:
      "customer service",
    aliases: [
      "customer service",
      "customer support",
      "customer care",
      "complaint",
      "customer queries",
      "client service",
    ],
  },
  {
    label:
      "administration and record keeping",
    aliases: [
      "administration",
      "administrative",
      "record keeping",
      "records",
      "filing",
      "correspondence",
      "office support",
    ],
  },
  {
    label:
      "organisation and prioritisation",
    aliases: [
      "organise",
      "organize",
      "prioritise",
      "prioritize",
      "deadlines",
      "workload",
      "scheduling",
      "diary",
    ],
  },
  {
    label:
      "data entry and accuracy",
    aliases: [
      "data entry",
      "data input",
      "accuracy",
      "accurate",
      "database",
      "spreadsheets",
      "excel",
    ],
  },
  {
    label:
      "accounts and financial administration",
    aliases: [
      "accounts",
      "accounting",
      "invoice",
      "invoicing",
      "ledger",
      "reconciliation",
      "payments",
      "bookkeeping",
    ],
  },
  {
    label:
      "IT support and troubleshooting",
    aliases: [
      "it support",
      "helpdesk",
      "help desk",
      "service desk",
      "technical support",
      "troubleshooting",
      "tickets",
    ],
  },
  {
    label:
      "communication and teamwork",
    aliases: [
      "communication",
      "communicate",
      "teamwork",
      "team player",
      "liaise",
      "collaborate",
      "stakeholders",
    ],
  },
  {
    label:
      "sales and client relationships",
    aliases: [
      "sales",
      "account management",
      "client relationships",
      "business development",
      "targets",
      "upselling",
    ],
  },
  {
    label:
      "problem solving",
    aliases: [
      "problem solving",
      "resolve issues",
      "resolution",
      "investigate",
      "initiative",
      "solutions",
    ],
  },
  {
    label:
      "process improvement and compliance",
    aliases: [
      "process improvement",
      "continuous improvement",
      "compliance",
      "procedures",
      "quality",
      "standards",
      "audit",
    ],
  },
]

function detectInterviewThemes(
  job,
) {
  const sourceText =
    normaliseText([
      job.role,
      job.description,
      ...(job.matchedSkills || []),
      ...(job.missingSkills || []),
    ].join(" "))

  const detected =
    interviewThemeDefinitions
      .filter((theme) =>
        theme.aliases.some(
          (alias) =>
            sourceText.includes(
              normaliseText(
                alias,
              ),
            ),
        ),
      )
      .map(
        (theme) =>
          theme.label,
      )

  if (
    detected.length > 0
  ) {
    return detected.slice(
      0,
      5,
    )
  }

  const role =
    normaliseText(
      job.role,
    )

  if (
    role.includes(
      "admin",
    )
  ) {
    return [
      "administration and record keeping",
      "organisation and prioritisation",
      "communication and teamwork",
    ]
  }

  if (
    role.includes(
      "account",
    )
  ) {
    return [
      "accounts and financial administration",
      "data entry and accuracy",
      "communication and teamwork",
    ]
  }

  if (
    role.includes("it") ||
    role.includes(
      "support",
    )
  ) {
    return [
      "IT support and troubleshooting",
      "problem solving",
      "communication and teamwork",
    ]
  }

  return [
    "communication and teamwork",
    "organisation and prioritisation",
    "problem solving",
  ]
}

function buildQuestionsToAsk(
  job,
) {
  const role =
    job.role ||
    "this role"

  const company =
    job.company ||
    "the company"

  const themes =
    detectInterviewThemes(
      job,
    )

  const descriptionPoints =
    extractDescriptionSentences(
      job.description,
    )

  return uniqueTextValues([
    `By the end of the first 90 days, what would make you confident you had hired the right person for the ${role} role?`,

    descriptionPoints[0]
      ? `The advert puts emphasis on “${trimSuggestion(descriptionPoints[0], 90)}”. What does strong performance in that area look like day to day?`
      : "Which responsibility needs the strongest ownership from the new starter?",

    themes[0]
      ? `What are the biggest day-to-day challenges around ${themes[0]} in this team?`
      : "What is the biggest challenge the team would like the new starter to make easier?",

    themes[1]
      ? `Which systems, tools or processes would I use most often for ${themes[1]}?`
      : "Which systems or processes would I be expected to become confident with first?",

    "How is good performance measured, and how is feedback normally given?",

    `How does the ${role} role work with the rest of the team at ${company}?`,

    "What tends to distinguish someone who is good in this position from someone who is excellent?",

    "What opportunities are there to take on more responsibility or develop once I am settled in?",

    "What will the next stage of the interview process focus on?",
  ]).slice(
    0,
    8,
  )
}

function buildLikelyInterviewQuestions(
  job,
) {
  const role =
    job.role ||
    "this role"

  const company =
    job.company ||
    "the company"

  const themes =
    detectInterviewThemes(
      job,
    )

  const descriptionPoints =
    extractDescriptionSentences(
      job.description,
    )

  const matchedSkills =
    Array.isArray(
      job.matchedSkills,
    )
      ? job.matchedSkills
      : []

  const missingSkills =
    Array.isArray(
      job.missingSkills,
    )
      ? job.missingSkills
      : []

  return uniqueTextValues([
    "Tell me about yourself and the experience that is most relevant to this position.",

    `Why does the ${role} role at ${company} appeal to you specifically?`,

    `What do you understand about what we need from someone in this ${role} position?`,

    descriptionPoints[0]
      ? `The vacancy highlights “${trimSuggestion(descriptionPoints[0], 90)}”. Tell us about experience that would help you handle that responsibility.`
      : "Which part of this role do you think you could contribute to most quickly?",

    themes[0]
      ? `Tell us about a time you demonstrated strong ${themes[0]}. What was the result?`
      : "Tell us about a time you took ownership of an important task.",

    themes[1]
      ? `Describe a situation where ${themes[1]} was important and how you approached it.`
      : "Tell us about a time you had several competing priorities and how you organised them.",

    matchedSkills[0]
      ? `Can you give a specific example of when you used ${matchedSkills[0]} effectively?`
      : "How do you make sure your work stays accurate when things get busy?",

    missingSkills[0]
      ? `You may need to use ${missingSkills[0]} in this role. How would you get up to speed quickly?`
      : "Tell us about a process or system you had to learn quickly. How did you approach it?",

    "Tell us about a difficult customer, colleague or unexpected problem and how you handled it.",

    "What would you want to have achieved by the end of your first six months?",
  ]).slice(
    0,
    9,
  )
}

function buildInterviewExamplePrompts(
  job,
  profile,
) {
  const themes =
    detectInterviewThemes(
      job,
    )

  const currentRole =
    String(
      profile.currentJobTitle ||
      "",
    ).trim()

  const prompts = [
    themes[0]
      ? `A real example showing your experience with ${themes[0]}.`
      : "",

    themes[1]
      ? `A time you used ${themes[1]} while working under pressure.`
      : "",

    themes[2]
      ? `A situation where ${themes[2]} helped you solve a problem.`
      : "",

    "A time you dealt with a difficult customer, colleague or unexpected issue.",

    "A time you organised several tasks and met an important deadline.",

    "A time you spotted an error, protected accuracy or improved a process.",

    "A time you supported a colleague or contributed to a team result.",

    currentRole
      ? `An achievement from your work as ${currentRole} that demonstrates skills relevant to this vacancy.`
      : "",
  ]

  const safePrompts =
    uniqueTextValues(
      prompts,
    ).slice(
      0,
      7,
    )

  const structure =
    getApplicationPreferences()
      .interviewAnswerStructure

  if (
    structure ===
    "free-form"
  ) {
    return safePrompts
  }

  const guidance =
    structure ===
    "star-reflection"
      ? "Structure this as Situation, Task, Action, Result and Reflection."
      : structure ===
          "concise-evidence"
        ? "Answer with brief context, the action you took and the evidence or result."
        : "Structure this as Situation, Task, Action and Result."

  return safePrompts.map(
    (prompt) =>
      `${prompt} — ${guidance}`,
  )
}

const applicationKeywordStopWords =
  new Set([
    "about",
    "after",
    "again",
    "also",
    "among",
    "and",
    "are",
    "been",
    "being",
    "both",
    "but",
    "can",
    "company",
    "could",
    "day",
    "from",
    "have",
    "into",
    "job",
    "more",
    "must",
    "our",
    "role",
    "should",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "through",
    "using",
    "will",
    "with",
    "within",
    "work",
    "working",
    "you",
    "your",
  ])

function splitProfileValues(
  value,
) {
  if (
    Array.isArray(value)
  ) {
    return value
      .map((item) =>
        String(item || "")
          .trim(),
      )
      .filter(Boolean)
  }

  return String(value || "")
    .split(/[\n,;|]/)
    .map((item) =>
      item.trim(),
    )
    .filter(Boolean)
}

function ensureSentence(
  value,
) {
  const cleaned =
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()

  if (!cleaned) {
    return ""
  }

  return /[.!?]$/.test(
    cleaned,
  )
    ? cleaned
    : `${cleaned}.`
}

function getCandidateDisplayName(
  profile,
) {
  return (
    String(
      profile.preferredName ||
      profile.fullName ||
      "",
    ).trim() ||
    "Your Name"
  )
}

function getApplicationSkillValues(
  job,
  profile,
) {
  const profileSkills =
    splitProfileValues(
      profile.skills,
    )

  const matchedSkills =
    Array.isArray(
      job.matchedSkills,
    )
      ? job.matchedSkills
      : []

  return uniqueTextValues([
    ...matchedSkills,
    ...profileSkills,
  ]).slice(
    0,
    6,
  )
}

const tailoringVariationLabels = [
  "Professional and balanced",
  "Concise and direct",
  "Warm and personable",
  "Skills focused",
  "Experience focused",
]

function getTailoringVariationLabel(
  variation,
) {
  const safeVariation =
    Number.isFinite(
      Number(variation),
    )
      ? Number(variation)
      : 0

  return tailoringVariationLabels[
    (
      safeVariation %
      tailoringVariationLabels.length +
      tailoringVariationLabels.length
    ) %
      tailoringVariationLabels.length
  ]
}

function joinNaturalList(
  values,
) {
  const items =
    uniqueTextValues(
      values,
    ).filter(Boolean)

  if (
    items.length === 0
  ) {
    return ""
  }

  if (
    items.length === 1
  ) {
    return items[0]
  }

  if (
    items.length === 2
  ) {
    return `${items[0]} and ${items[1]}`
  }

  return `${items
    .slice(0, -1)
    .join(", ")}, and ${
      items[
        items.length - 1
      ]
    }`
}

function getTailoringContext(
  job,
  profile,
) {
  const role =
    String(
      job.role ||
      "this position",
    ).trim()

  const company =
    String(
      job.company ||
      "your organisation",
    ).trim()

  const candidateName =
    getCandidateDisplayName(
      profile,
    )

  const currentRole =
    String(
      profile.currentJobTitle ||
      "",
    ).trim()

  const professionalSummary =
    ensureSentence(
      profile.professionalSummary,
    )

  const whyThisRole =
    ensureSentence(
      profile.whyThisRole,
    )

  const relevantSkills =
    getApplicationSkillValues(
      job,
      profile,
    )

  const strengths =
    splitProfileValues(
      profile.strengths,
    ).slice(
      0,
      4,
    )

  const themes =
    detectInterviewThemes(
      job,
    ).slice(
      0,
      3,
    )

  const roleFocus =
    themes.length > 0
      ? joinNaturalList(
          themes,
        )
      : "organisation, communication and dependable support"

  const skillList =
    joinNaturalList(
      relevantSkills.slice(
        0,
        5,
      ),
    )

  const strengthList =
    joinNaturalList(
      strengths.slice(
        0,
        3,
      ),
    )

  const applicationResearch =
    buildApplicationResearchMotivation({
      report:
        job.companyResearch ||
        null,

      job,
    })

  return {
    role,
    company,
    candidateName,
    currentRole,
    professionalSummary,
    whyThisRole,
    relevantSkills,
    strengths,
    themes,
    roleFocus,
    skillList,
    strengthList,
    applicationResearch,
  }
}

function lowerFirst(
  value,
) {
  const text =
    String(
      value ||
      "",
    ).trim()

  if (!text) {
    return ""
  }

  return (
    text.charAt(0)
      .toLowerCase() +
    text.slice(1)
  )
}

function cleanSkillLabel(
  value,
) {
  return String(
    value ||
    "",
  )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
}

function humaniseSkill(
  value,
) {
  const skill =
    cleanSkillLabel(
      value,
    )

  const key =
    normaliseText(
      skill,
    )

  if (
    key.includes(
      "customer service",
    )
  ) {
    return "dealing with customer queries in a calm and professional way"
  }

  if (
    key.includes(
      "administration",
    ) ||
    key === "admin"
  ) {
    return "keeping day-to-day administration organised"
  }

  if (
    key.includes(
      "data entry",
    )
  ) {
    return "entering and checking information accurately"
  }

  if (
    key.includes(
      "microsoft excel",
    ) ||
    key === "excel"
  ) {
    return "working confidently with Excel"
  }

  if (
    key.includes(
      "microsoft office",
    ) ||
    key === "office"
  ) {
    return "using Microsoft Office confidently in day-to-day work"
  }

  if (
    key.includes(
      "written communication",
    )
  ) {
    return "writing clearly and professionally"
  }

  if (
    key.includes(
      "communication",
    )
  ) {
    return "communicating clearly with customers and colleagues"
  }

  if (
    key.includes(
      "problem solving",
    )
  ) {
    return "working through problems calmly and practically"
  }

  if (
    key.includes(
      "time management",
    ) ||
    key.includes(
      "priorit",
    )
  ) {
    return "managing changing priorities without losing track of the detail"
  }

  if (
    key.includes(
      "teamwork",
    )
  ) {
    return "working closely with the rest of the team"
  }

  if (
    key.includes(
      "cash handling",
    ) ||
    key.includes(
      "payments",
    )
  ) {
    return "handling payments accurately and responsibly"
  }

  if (
    key.includes(
      "leadership",
    ) ||
    key.includes(
      "supervision",
    ) ||
    key.includes(
      "supervisor",
    )
  ) {
    return "taking responsibility and supporting colleagues when needed"
  }

  if (
    key.includes(
      "it support",
    ) ||
    key.includes(
      "troubleshoot",
    )
  ) {
    return "working through day-to-day technical problems methodically"
  }

  if (
    key.includes(
      "record",
    )
  ) {
    return "keeping records accurate and up to date"
  }

  return skill
    ? `using ${lowerFirst(
        skill,
      )} in a practical way`
    : ""
}

function getNaturalSkillClauses(
  relevantSkills,
  limit =
    3,
) {
  return uniqueTextValues(
    (
      Array.isArray(
        relevantSkills,
      )
        ? relevantSkills
        : []
    )
      .map(
        humaniseSkill,
      )
      .filter(
        Boolean,
      ),
  ).slice(
    0,
    limit,
  )
}

function getProfileMotivationHint(
  whyThisRole,
) {
  const source =
    normaliseText(
      whyThisRole,
    )

  if (!source) {
    return ""
  }

  if (
    source.includes(
      "training",
    ) &&
    (
      source.includes(
        "develop",
      ) ||
      source.includes(
        "progress",
      ) ||
      source.includes(
        "learn",
      )
    )
  ) {
    return "I am also drawn to roles where I can learn the systems properly, settle into the team and keep developing over time."
  }

  if (
    source.includes(
      "progress",
    ) ||
    source.includes(
      "development",
    ) ||
    source.includes(
      "develop",
    )
  ) {
    return "The opportunity to keep developing and take on more responsibility over time also appeals to me."
  }

  if (
    source.includes(
      "administration",
    ) ||
    source.includes(
      "accounts",
    ) ||
    source.includes(
      "support",
    )
  ) {
    return "Moving further into a professional support role is a direction I am genuinely keen to develop in."
  }

  return ""
}

function buildHumanExperienceParagraph(
  context,
  variationIndex,
) {
  const {
    currentRole,
    relevantSkills,
    themes,
  } =
    context

  const skillClauses =
    getNaturalSkillClauses(
      relevantSkills,
      variationIndex ===
        1
        ? 2
        : 3,
    )

  const theme =
    themes?.[0] ||
    ""

  const roleLead =
    currentRole
      ? `In my current role as ${currentRole},`
      : "Through my previous work,"

  const experienceList =
    joinNaturalList(
      skillClauses,
    )

  if (
    experienceList
  ) {
    const relevance =
      theme
        ? `That feels directly relevant to a role where ${lowerFirst(
            theme,
          )} matters day to day.`
        : "Those are habits I would bring with me into this position."

    return `${roleLead} I am used to ${experienceList}. ${relevance}`
  }

  return currentRole
    ? `In my current role as ${currentRole}, I have become used to balancing day-to-day responsibilities, communicating clearly and keeping work moving when priorities change.`
    : "My previous work has taught me to stay organised, communicate clearly and take responsibility for getting things done properly."
}

function buildHumanStrengthSentence(
  strengths,
) {
  const values =
    uniqueTextValues(
      (
        Array.isArray(
          strengths,
        )
          ? strengths
          : splitProfileValues(
              strengths,
            )
      )
        .map(
          (value) =>
            lowerFirst(
              value,
            ),
        )
        .filter(
          Boolean,
        ),
    ).slice(
      0,
      2,
    )

  if (
    values.length ===
    0
  ) {
    return ""
  }

  return `I try to bring ${joinNaturalList(
    values,
  )} to the way I work, especially when things are busy or priorities change.`
}

function buildHumanOpeningParagraph(
  context,
  variationIndex,
) {
  const {
    role,
    company,
    themes,
    currentRole,
  } =
    context

  const firstTheme =
    themes?.[0] ||
    ""

  const secondTheme =
    themes?.[1] ||
    ""

  if (
    variationIndex ===
    1
  ) {
    return `I would like to apply for the ${role} position at ${company}. ${firstTheme ? `The role's focus on ${lowerFirst(firstTheme)} is a good fit with the experience I want to build on next.` : "The vacancy feels like a good match for the practical, organised way I like to work."}`
  }

  if (
    variationIndex ===
    2
  ) {
    return `I was genuinely interested to see the ${role} vacancy at ${company}. ${firstTheme ? `I enjoy work where ${lowerFirst(firstTheme)} is important,` : "I enjoy practical work where people can rely on me,"} and this role feels like a natural next step for me.`
  }

  if (
    variationIndex ===
    3
  ) {
    return `I am applying for the ${role} position at ${company} because the vacancy's emphasis on ${firstTheme || "reliable day-to-day support"}${secondTheme ? ` and ${lowerFirst(secondTheme)}` : ""} matches areas I already work with and would like to develop further.`
  }

  if (
    variationIndex ===
      4 &&
    currentRole
  ) {
    return `I would like to be considered for the ${role} position at ${company}. My experience as ${currentRole} has given me a practical background that I believe would transfer well into this role.`
  }

  return `I am writing to apply for the ${role} position at ${company}. ${firstTheme ? `What stood out to me was the role's focus on ${lowerFirst(firstTheme)}, which fits well with the kind of work I am looking to move further into.` : "The role stood out to me as a good match for my experience and the direction I would like to take next."}`
}

function buildHumanMotivationParagraph(
  context,
  variationIndex,
) {
  const {
    role,
    company,
    themes,
    whyThisRole,
    applicationResearch,
  } =
    context

  const firstTheme =
    themes?.[0] ||
    ""

  const profileHint =
    getProfileMotivationHint(
      whyThisRole,
    )

  let lead

  if (
    variationIndex ===
    2
  ) {
    lead =
      firstTheme
        ? `What appeals to me most is the chance to bring my existing experience into a role centred on ${lowerFirst(firstTheme)}, while becoming part of the team at ${company}.`
        : `What appeals to me most is the chance to bring my existing experience into the team at ${company} and keep developing from there.`
  } else if (
    variationIndex ===
    3
  ) {
    lead =
      `I would value the chance to bring those strengths into the ${role} role and build on them in a more focused setting.`

  } else if (
    variationIndex ===
    4
  ) {
    lead =
      `For me, the attraction of this role is being able to carry useful experience forward while learning how ${company} approaches the work day to day.`
  } else {
    lead =
      `The ${role} position appeals to me because it would let me use the experience I already have while continuing to grow in a role with clear day-to-day responsibility.`
  }

  return [
    lead,
    profileHint,
    applicationResearch
      ?.text ||
      "",
  ]
    .filter(
      Boolean,
    )
    .join(
      " ",
    )
}

function buildHumanClosingParagraph(
  variationIndex,
) {
  if (
    variationIndex ===
    1
  ) {
    return "Thank you for considering my application. I would be happy to discuss my experience and suitability for the role in more detail."
  }

  if (
    variationIndex ===
    2
  ) {
    return "Thank you for taking the time to read my application. I would welcome the chance to speak with you and explain a little more about what I could bring to the team."
  }

  if (
    variationIndex ===
    4
  ) {
    return "Thank you for your consideration. I would welcome the opportunity to discuss how my experience could transfer into the role and where I could contribute most quickly."
  }

  return "Thank you for considering my application. I would welcome the opportunity to discuss the role and how my experience could contribute to the team."
}

function buildTailoredCoverLetter(
  job,
  profile,
  variation = 0,
) {
  const context =
    getTailoringContext(
      job,
      profile,
    )

  const variationIndex =
    (
      Number(
        variation,
      ) %
        tailoringVariationLabels.length +
      tailoringVariationLabels.length
    ) %
      tailoringVariationLabels.length

  const opening =
    buildHumanOpeningParagraph(
      context,
      variationIndex,
    )

  const experience =
    buildHumanExperienceParagraph(
      context,
      variationIndex,
    )

  const strengthSentence =
    buildHumanStrengthSentence(
      context.strengths,
    )

  const motivation =
    buildHumanMotivationParagraph(
      context,
      variationIndex,
    )

  const closing =
    buildHumanClosingParagraph(
      variationIndex,
    )

  const greeting =
    "Dear Hiring Team,"

  const signOff = [
    "Kind regards,",
    context.candidateName,
  ].join(
    "\n",
  )

  const lengthPreference =
    getApplicationPreferences()
      .coverLetterLength

  if (
    lengthPreference ===
    "concise"
  ) {
    const conciseFit =
      [
        experience,
        context.applicationResearch
          ?.text ||
          "",
      ]
        .filter(
          Boolean,
        )
        .join(
          " ",
        )

    return [
      greeting,
      opening,
      conciseFit,
      closing,
      signOff,
    ]
      .filter(
        Boolean,
      )
      .join(
        "\n\n",
      )
  }

  const fitParagraph =
    [
      experience,
      strengthSentence,
    ]
      .filter(
        Boolean,
      )
      .join(
        " ",
      )

  if (
    lengthPreference ===
    "detailed"
  ) {
    const extra =
      context.themes?.[1]
        ? `I would also be keen to understand how the team handles ${lowerFirst(
            context.themes[1],
          )} in practice, and to learn the systems and processes you use to keep that work running smoothly.`
        : "I would also be keen to learn the team's systems and processes properly and become someone colleagues can rely on day to day."

    return [
      greeting,
      opening,
      fitParagraph,
      motivation,
      extra,
      closing,
      signOff,
    ]
      .filter(
        Boolean,
      )
      .join(
        "\n\n",
      )
  }

  return [
    greeting,
    opening,
    fitParagraph,
    motivation,
    closing,
    signOff,
  ]
    .filter(
      Boolean,
    )
    .join(
      "\n\n",
    )
}

function buildTailoredCvProfile(
  job,
  profile,
  variation = 0,
) {
  const context =
    getTailoringContext(
      job,
      profile,
    )

  const {
    role,
    company,
    currentRole,
    professionalSummary,
    roleFocus,
    skillList,
    strengthList,
  } = context

  const baseExperience =
    professionalSummary ||
    (
      currentRole
        ? `Dependable ${currentRole} with transferable experience in customer service, organisation and operational support.`
        : "Dependable and organised professional with transferable experience in customer service, administration and operational support."
    )

  const variants = [
    [
      ensureSentence(
        baseExperience,
      ),

      skillList
        ? `Relevant strengths include ${skillList}.`
        : "",

      strengthList
        ? `Known for ${strengthList}.`
        : "",

      company
        ? `Now seeking to bring these capabilities to the ${role} position at ${company}.`
        : `Now seeking to bring these capabilities to a ${role} position.`,
    ],

    [
      currentRole
        ? `${currentRole} offering a reliable, organised and customer-focused approach.`
        : "Reliable and organised professional offering a customer-focused approach.",

      skillList
        ? `Experienced in ${skillList}.`
        : "",

      `Prepared to apply these transferable strengths within a ${role} position${company ? ` at ${company}` : ""}.`,
    ],

    [
      skillList
        ? `Adaptable professional with strengths across ${skillList}.`
        : "Adaptable professional with strengths across organisation, communication and problem solving.",

      `Comfortable supporting work involving ${roleFocus}.`,

      strengthList
        ? `Recognised for ${strengthList}.`
        : "",

      `Motivated to contribute these qualities as ${company ? `${role} at ${company}` : role}.`,
    ],

    [
      ensureSentence(
        baseExperience,
      ),

      `Brings a practical understanding of ${roleFocus}, alongside a willingness to learn new systems and processes.`,

      skillList
        ? `Key transferable capabilities include ${skillList}.`
        : "",

      `Seeking a ${role} opportunity where accuracy, communication and dependable support are valued.`,
    ],

    [
      currentRole
        ? `Experienced ${currentRole} with a record of handling responsibility, supporting customers and maintaining consistent standards.`
        : "Experienced professional with a record of handling responsibility, supporting customers and maintaining consistent standards.",

      skillList
        ? `Offers transferable experience in ${skillList}.`
        : "",

      strengthList
        ? `Brings ${strengthList} to day-to-day work.`
        : "",

      company
        ? `Ready to apply this background to the ${role} position at ${company}.`
        : `Ready to apply this background to a ${role} position.`,
    ],
  ]

  const selected =
    variants[
      (
        Number(variation) %
        variants.length +
        variants.length
      ) %
        variants.length
    ]

  return selected
    .filter(Boolean)
    .map(
      ensureSentence,
    )
    .join(" ")
}

function getVacancyKeywordValues(
  job,
) {
  const phraseKeywords =
    uniqueTextValues([
      job.role,
      ...(Array.isArray(
        job.matchedSkills,
      )
        ? job.matchedSkills
        : []),
      ...(Array.isArray(
        job.missingSkills,
      )
        ? job.missingSkills
        : []),
      ...detectInterviewThemes(
        job,
      ),
    ])

  const wordCounts =
    new Map()

  const words =
    normaliseText([
      job.role,
      job.description,
      job.category,
      job.contractType,
      job.workType,
    ].join(" "))
      .split(" ")
      .filter(
        (word) =>
          word.length >= 4 &&
          !applicationKeywordStopWords.has(
            word,
          ) &&
          !/^\d+$/.test(
            word,
          ),
      )

  for (
    const word
    of words
  ) {
    wordCounts.set(
      word,
      (
        wordCounts.get(
          word,
        ) || 0
      ) + 1,
    )
  }

  const frequentWords =
    [...wordCounts.entries()]
      .sort(
        (
          [firstWord, firstCount],
          [secondWord, secondCount],
        ) =>
          secondCount -
            firstCount ||
          firstWord.localeCompare(
            secondWord,
          ),
      )
      .slice(
        0,
        12,
      )
      .map(
        ([word]) =>
          word
            .split(" ")
            .map(
              (part) =>
                part.charAt(0)
                  .toUpperCase() +
                part.slice(1),
            )
            .join(" "),
      )

  return {
    phraseKeywords,
    frequentWords,
  }
}

function extractVacancyKeywords(
  job,
  variation = 0,
) {
  const {
    phraseKeywords,
    frequentWords,
  } = getVacancyKeywordValues(
    job,
  )

  const variationIndex =
    (
      Number(variation) %
      tailoringVariationLabels.length +
      tailoringVariationLabels.length
    ) %
      tailoringVariationLabels.length

  let orderedValues

  if (
    variationIndex === 1
  ) {
    orderedValues = [
      ...frequentWords,
      ...phraseKeywords,
    ]
  } else if (
    variationIndex === 2
  ) {
    orderedValues = [
      ...phraseKeywords,
      ...frequentWords,
    ].sort(
      (first, second) =>
        String(first).localeCompare(
          String(second),
        ),
    )
  } else if (
    variationIndex === 3
  ) {
    orderedValues = []

    const maximum =
      Math.max(
        phraseKeywords.length,
        frequentWords.length,
      )

    for (
      let index = 0;
      index < maximum;
      index += 1
    ) {
      if (
        phraseKeywords[index]
      ) {
        orderedValues.push(
          phraseKeywords[index],
        )
      }

      if (
        frequentWords[index]
      ) {
        orderedValues.push(
          frequentWords[index],
        )
      }
    }
  } else if (
    variationIndex === 4
  ) {
    orderedValues = [
      ...phraseKeywords
        .slice()
        .reverse(),
      ...frequentWords
        .slice()
        .reverse(),
    ]
  } else {
    orderedValues = [
      ...phraseKeywords,
      ...frequentWords,
    ]
  }

  return uniqueTextValues(
    orderedValues,
  )
    .slice(
      0,
      16,
    )
    .join(", ")
}

function findNextTailoringVariation({
  currentText,
  builder,
  startVariation,
}) {
  const total =
    tailoringVariationLabels.length

  for (
    let offset = 1;
    offset <= total;
    offset += 1
  ) {
    const candidateVariation =
      (
        startVariation +
        offset
      ) % total

    const candidateText =
      builder(
        candidateVariation,
      )

    if (
      normaliseText(
        candidateText,
      ) !==
      normaliseText(
        currentText,
      )
    ) {
      return {
        variation:
          candidateVariation,

        text:
          candidateText,
      }
    }
  }

  const fallbackVariation =
    (
      startVariation + 1
    ) % total

  return {
    variation:
      fallbackVariation,

    text:
      builder(
        fallbackVariation,
      ),
  }
}

function normaliseUrl(value) {
  const url =
    String(value || "")
      .trim()

  if (!url) {
    return ""
  }

  if (
    url.startsWith(
      "http://",
    ) ||
    url.startsWith(
      "https://",
    )
  ) {
    return url
  }

  return `https://${url}`
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

function formatLocalDate(
  value,
) {
  return formatPreferenceDate(
    value,
  )
}

function createApplicationDraft(
  job,
  profile,
  recipientName,
) {
  const candidateName =
    profile.fullName ||
    profile.preferredName ||
    "Your Name"

  const preferences =
    getApplicationPreferences()

  const greeting =
    recipientName
      ? `Dear ${recipientName},`
      : "Dear Hiring Team,"

  let subject =
    `Application for ${job.role} – ${candidateName}`

  if (
    preferences.emailSubjectFormat ===
    "name-role"
  ) {
    subject =
      `${candidateName} – Application for ${job.role}`
  }

  if (
    preferences.emailSubjectFormat ===
    "role-company"
  ) {
    subject =
      `${job.role} Application – ${job.company}`
  }

  return {
    subject,

    body: [
      greeting,
      "",
      `I am writing to apply for the ${job.role} position at ${job.company}.`,
      "",
      "Please find my CV attached for your consideration. I would welcome the opportunity to discuss how my experience and skills could contribute to your team.",
      "",
      "Thank you for your time and consideration.",
      "",
      "Kind regards,",
      candidateName,
    ].join("\\n"),
  }
}

function getDraftCount(
  applicationPackage,
) {
  if (
    Array.isArray(
      applicationPackage
        ?.gmailDraftHistory,
    )
  ) {
    return (
      applicationPackage
        .gmailDraftHistory
        .length
    )
  }

  if (
    applicationPackage
      ?.gmailDraftCount
  ) {
    return (
      applicationPackage
        .gmailDraftCount
    )
  }

  return applicationPackage
    ?.gmailDraftId
    ? 1
    : 0
}

function getExistingDraftHistory(
  applicationPackage,
) {
  if (
    Array.isArray(
      applicationPackage
        ?.gmailDraftHistory,
    )
  ) {
    return (
      applicationPackage
        .gmailDraftHistory
    )
  }

  if (
    !applicationPackage
      ?.gmailDraftId
  ) {
    return []
  }

  return [
    {
      draftId:
        applicationPackage
          .gmailDraftId,

      messageId:
        applicationPackage
          .gmailDraftMessageId ||
        "",

      createdAt:
        applicationPackage
          .gmailDraftCreatedAt ||
        "",

      gmailAddress:
        applicationPackage
          .gmailDraftAddress ||
        "",

      attachmentNames:
        Array.isArray(
          applicationPackage
            .gmailDraftAttachmentNames,
        )
          ? applicationPackage
              .gmailDraftAttachmentNames
          : [],
    },
  ]
}

function getNextAction(job) {
  if (
    job.nextAction &&
    job.nextAction !==
      "None"
  ) {
    return job.nextAction
  }

  if (
    job.status ===
      "Interview" &&
    job.interviewDate
  ) {
    return "Prepare for interview"
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

  return "No action set"
}

function getNextActionDate(job) {
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

function jobStatusClass(
  status,
) {
  return getJobStatusClass(
    status,
  )
}

function packageStatusClass(
  status,
) {
  return getPackageStatusClass(
    status,
  )
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(
      text,
    )

    return true
  } catch {
    try {
      const textArea =
        document.createElement(
          "textarea",
        )

      textArea.value =
        text

      textArea.style.position =
        "fixed"

      textArea.style.opacity =
        "0"

      document.body.appendChild(
        textArea,
      )

      textArea.focus()
      textArea.select()

      const copied =
        document.execCommand(
          "copy",
        )

      textArea.remove()

      return copied
    } catch {
      return false
    }
  }
}

export default function JobWorkspace() {
  const {
    jobId,
  } = useParams()

  const navigate =
    useNavigate()

  const profile =
    useMemo(
      loadProfile,
      [],
    )

  const [jobs, setJobs] =
    useState(() =>
      loadStoredArray(
        jobsStorageKey,
      ),
    )

  const [queue, setQueue] =
    useState(() =>
      loadStoredArray(
        queueStorageKey,
      ),
    )

  const [
    documents,
    setDocuments,
  ] = useState([])

  const [
    documentsLoading,
    setDocumentsLoading,
  ] = useState(true)

  const [
    documentError,
    setDocumentError,
  ] = useState("")

  const [
    gmailStatus,
    setGmailStatus,
  ] = useState(
    emptyGmailStatus,
  )

  const [
    checkingGmail,
    setCheckingGmail,
  ] = useState(true)

  const [
    editingJob,
    setEditingJob,
  ] = useState(false)

  const [
    showActivityHistory,
    setShowActivityHistory,
  ] = useState(false)

  const [
    showNotesEditor,
    setShowNotesEditor,
  ] = useState(false)

  const [
    notesDraft,
    setNotesDraft,
  ] = useState("")

  const [
    showActionEditor,
    setShowActionEditor,
  ] = useState(false)

  const [
    actionDraft,
    setActionDraft,
  ] = useState({
    nextAction: "None",
    nextActionDate: "",
  })

  const [
    jobForm,
    setJobForm,
  ] = useState(null)

  const [
    showInterviewPrep,
    setShowInterviewPrep,
  ] = useState(false)

  const [
    interviewForm,
    setInterviewForm,
  ] = useState(null)

  const [
    showApplicationReview,
    setShowApplicationReview,
  ] = useState(false)

  const [
    applicationForm,
    setApplicationForm,
  ] = useState(
    emptyApplicationForm,
  )

  const [
    applicationMessage,
    setApplicationMessage,
  ] = useState("")

  const [
    applicationSaving,
    setApplicationSaving,
  ] = useState(false)

  const [
    savingTailoredDocument,
    setSavingTailoredDocument,
  ] = useState(false)

  const [
    creatingGmailDraft,
    setCreatingGmailDraft,
  ] = useState(false)

  useEffect(() => {
    async function loadDocuments() {
      setDocumentsLoading(true)
      setDocumentError("")

      try {
        if (
          !window.jobPilot
            ?.documents
        ) {
          setDocuments([])
          setDocumentError(
            "Document storage is unavailable. Fully restart BreakVeil.",
          )

          return
        }

        const savedDocuments =
          await window.jobPilot.documents.list()

        setDocuments(
          Array.isArray(
            savedDocuments,
          )
            ? savedDocuments
            : [],
        )
      } catch {
        setDocuments([])
        setDocumentError(
          "BreakVeil could not load the Resume Library.",
        )
      } finally {
        setDocumentsLoading(false)
      }
    }

    async function loadGmailStatus() {
      setCheckingGmail(true)

      try {
        if (
          !window.jobPilot
            ?.gmail
        ) {
          setGmailStatus({
            ...emptyGmailStatus,

            error:
              "The Gmail service is unavailable. Fully restart BreakVeil.",
          })

          return
        }

        const result =
          await window.jobPilot.gmail.getStatus()

        setGmailStatus({
          configured:
            Boolean(
              result?.configured,
            ),

          connected:
            Boolean(
              result?.connected,
            ),

          email:
            result?.email || "",

          needsReconnect:
            Boolean(
              result?.needsReconnect,
            ),

          error:
            result?.error || "",
        })
      } catch (error) {
        setGmailStatus({
          ...emptyGmailStatus,

          error:
            error?.message ||
            "BreakVeil could not check Gmail.",
        })
      } finally {
        setCheckingGmail(false)
      }
    }

    function refreshJobs() {
      setJobs(
        loadStoredArray(
          jobsStorageKey,
        ),
      )
    }

    function refreshQueue() {
      setQueue(
        loadStoredArray(
          queueStorageKey,
        ),
      )
    }

    function refreshAll() {
      refreshJobs()
      refreshQueue()
      loadDocuments()
      loadGmailStatus()
    }

    loadDocuments()
    loadGmailStatus()

    window.addEventListener(
      "jobpilot:jobs-updated",
      refreshJobs,
    )

    window.addEventListener(
      "jobpilot:queue-updated",
      refreshQueue,
    )

    window.addEventListener(
      "focus",
      refreshAll,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:jobs-updated",
        refreshJobs,
      )

      window.removeEventListener(
        "jobpilot:queue-updated",
        refreshQueue,
      )

      window.removeEventListener(
        "focus",
        refreshAll,
      )
    }
  }, [])

  const job =
    useMemo(
      () =>
        jobs.find(
          (item) =>
            String(item.id) ===
            String(jobId),
        ),
      [jobs, jobId],
    )

  const applicationPackage =
    useMemo(
      () =>
        queue.find(
          (item) =>
            String(item.jobId) ===
            String(jobId),
        ) || null,
      [queue, jobId],
    )

  const cvs =
    useMemo(
      () =>
        documents.filter(
          (document) =>
            document.category ===
            "CV",
        ),
      [documents],
    )

  const coverLetters =
    useMemo(
      () =>
        documents.filter(
          (document) =>
            document.category ===
            "Cover Letter",
        ),
      [documents],
    )

  const selectedCv =
    useMemo(
      () =>
        documents.find(
          (document) =>
            document.id ===
            applicationPackage?.cvId,
        ) || null,
      [
        documents,
        applicationPackage,
      ],
    )

  const selectedCoverLetter =
    useMemo(
      () =>
        documents.find(
          (document) =>
            document.id ===
            applicationPackage
              ?.coverLetterId,
        ) || null,
      [
        documents,
        applicationPackage,
      ],
    )

  const packageReadiness =
    useMemo(
      () =>
        buildApplicationPreparation({
          job,

          cv:
            selectedCv,

          coverLetterId:
            applicationPackage
              ?.coverLetterId ||
            "",

          coverLetter:
            selectedCoverLetter,

          recipientEmail:
            applicationPackage
              ?.recipientEmail ||
            "",

          emailSubject:
            applicationPackage
              ?.emailSubject ||
            "",

          emailBody:
            applicationPackage
              ?.emailBody ||
            "",

          applicationAnswers:
            applicationPackage
              ?.applicationAnswers,

          reviewAcknowledgements:
            applicationPackage
              ?.reviewAcknowledgements,
        }),
      [
        job,
        selectedCv,
        selectedCoverLetter,
        applicationPackage,
      ],
    )

  const formSelectedCv =
    useMemo(
      () =>
        documents.find(
          (document) =>
            document.id ===
            applicationForm.cvId,
        ) || null,
      [
        documents,
        applicationForm.cvId,
      ],
    )

  const formSelectedCoverLetter =
    useMemo(
      () =>
        documents.find(
          (document) =>
            document.id ===
            applicationForm
              .coverLetterId,
        ) || null,
      [
        documents,
        applicationForm
          .coverLetterId,
      ],
    )

  const formReadiness =
    useMemo(
      () =>
        buildApplicationPreparation({
          job,

          cv:
            formSelectedCv,

          coverLetterId:
            applicationForm
              .coverLetterId,

          coverLetter:
            formSelectedCoverLetter,

          recipientEmail:
            applicationForm
              .recipientEmail,

          emailSubject:
            applicationForm
              .emailSubject,

          emailBody:
            applicationForm
              .emailBody,

          applicationAnswers:
            applicationPackage
              ?.applicationAnswers,

          reviewAcknowledgements:
            applicationForm
              .reviewAcknowledgements,
        }),
      [
        job,
        formSelectedCv,
        formSelectedCoverLetter,
        applicationForm,
        applicationPackage
          ?.applicationAnswers,
      ],
    )

  useEffect(() => {
    if (!job) {
      return
    }

    setJobForm({
      role:
        job.role || "",

      company:
        job.company || "",

      location:
        job.location || "",

      salary:
        job.salary || "",

      status:
        job.status || "Saved",

      jobUrl:
        job.jobUrl || "",
    })

    setNotesDraft(
      job.notes || "",
    )

    setActionDraft({
      nextAction:
        job.nextAction ||
        "None",

      nextActionDate:
        job.nextActionDate ||
        "",
    })
  }, [job])

  function saveJobs(
    updatedJobs,
  ) {
    setJobs(
      updatedJobs,
    )

    localStorage.setItem(
      jobsStorageKey,
      JSON.stringify(
        updatedJobs,
      ),
    )

    window.dispatchEvent(
      new Event(
        "jobpilot:jobs-updated",
      ),
    )
  }

  function saveQueue(
    updatedQueue,
  ) {
    setQueue(
      updatedQueue,
    )

    localStorage.setItem(
      queueStorageKey,
      JSON.stringify(
        updatedQueue,
      ),
    )

    window.dispatchEvent(
      new Event(
        "jobpilot:queue-updated",
      ),
    )
  }

  function updateJobStatus(
    status,
  ) {
    if (
      status === job.status
    ) {
      return
    }

    const today =
      new Date()
        .toISOString()
        .slice(0, 10)

    const updatedAt =
      new Date()
        .toISOString()

    const activity =
      createJobActivity({
        type:
          [
            "Offer",
            "Rejected",
          ].includes(status)
            ? "outcome"
            : "status",

        title:
          status === "Offer"
            ? "Offer recorded"
            : status ===
                "Rejected"
              ? "Application outcome recorded"
              : `Status changed to ${status}`,

        description:
          `Moved from ${job.status || "Saved"} to ${status}.`,

        createdAt:
          updatedAt,

        dedupeKey:
          `status-${job.id}-${status}-${updatedAt}`,

        metadata: {
          previousStatus:
            job.status || "",

          status,
        },
      })

    const updatedJobs =
      jobs.map((item) => {
        if (
          item.id !== job.id
        ) {
          return item
        }

        let nextJob = {
          ...item,

          status,

          updatedAt,
        }

        if (
          status === "Applied" &&
          !nextJob.dateApplied
        ) {
          nextJob.dateApplied =
            today
        }

        if (
          status === "Applied" &&
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
          status === "Interview" &&
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

          if (
            nextJob.interviewDate &&
            !nextJob.nextActionDate
          ) {
            nextJob.nextActionDate =
              nextJob.interviewDate
          }
        }

        nextJob =
          appendJobActivity(
            nextJob,
            activity,
          )

        return nextJob
      })

    saveJobs(
      updatedJobs,
    )
  }

  function saveCompanyResearch(
    nextReport,
  ) {
    if (
      !nextReport ||
      !job
    ) {
      return
    }

    const updatedAt =
      new Date()
        .toISOString()

    const activity =
      createJobActivity({
        type:
          "updated",

        title:
          job.companyResearch
            ? "Company research refreshed"
            : "Company research added",

        description:
          `${nextReport.researchedCompanyName || job.company} research was saved with ${nextReport.sources?.length || 0} cited source${nextReport.sources?.length === 1 ? "" : "s"}.`,

        createdAt:
          updatedAt,

        metadata: {
          researchId:
            nextReport.researchId ||
            "",

          sourceCount:
            nextReport.sources
              ?.length ||
            0,
        },
      })

    const updatedJobs =
      jobs.map(
        (item) => {
          if (
            item.id !==
            job.id
          ) {
            return item
          }

          const previousHistory =
            mergeResearchHistory({
              currentReport:
                item.companyResearch,

              history:
                item.companyResearchHistory,
            })

          const checklist =
            normaliseInterviewChecklist(
              item.interviewChecklist,
            )

          return appendJobActivity(
            {
              ...item,

              companyResearch:
                nextReport,

              companyResearchHistory:
                previousHistory,

              interviewChecklist: {
                ...checklist,

                researchCompany:
                  true,
              },

              updatedAt,
            },
            activity,
          )
        },
      )

    saveJobs(
      updatedJobs,
    )
  }

  function markActionDone() {
    const completedAction =
      getNextAction(job)

    const updatedAt =
      new Date()
        .toISOString()

    const activity =
      createJobActivity({
        type:
          "action",

        title:
          "Next action completed",

        description:
          completedAction &&
          completedAction !==
            "No action set"
            ? completedAction
            : "A tracked action was completed.",

        createdAt:
          updatedAt,

        metadata: {
          completedAction:
            completedAction ||
            "",
        },
      })

    const updatedJobs =
      jobs.map(
        (item) =>
          item.id === job.id
            ? appendJobActivity(
                {
                  ...item,

                  nextAction:
                    "None",

                  nextActionDate:
                    "",

                  followUpDate:
                    "",

                  updatedAt,
                },
                activity,
              )
            : item,
      )

    saveJobs(
      updatedJobs,
    )
  }

  function openMyJobs() {
    try {
      localStorage.setItem(
        jobsViewStorageKey,
        "my-jobs",
      )
    } catch {
      // Navigation still works.
    }

    navigate("/jobs")
  }

  function openAssistant() {
    const handoff = {
      version: 1,

      origin:
        "job-workspace",

      importedAt:
        new Date()
          .toISOString(),

      vacancy: {
        role:
          job.role || "",

        company:
          job.company || "",

        location:
          job.location || "",

        salary:
          job.salary || "",

        jobUrl:
          job.jobUrl || "",

        description:
          job.description || "",

        postedAt:
          job.postedAt || "",

        expiresAt:
          job.expiresAt || "",

        contractType:
          job.contractType || "",

        workType:
          job.workType || "",

        category:
          job.category || "",

        isRemote:
          Boolean(
            job.isRemote,
          ),

        liveSearchId:
          job.liveSearchId || "",

        providerId:
          job.providerId || "",

        source:
          job.source || "",

        sourceName:
          job.sourceName || "",

        sourceNames:
          Array.isArray(
            job.sourceNames,
          )
            ? job.sourceNames
            : [],

        sourceListings:
          Array.isArray(
            job.sourceListings,
          )
            ? job.sourceListings
            : [],
      },

      matchAnalysis: {
        score:
          Number(
            job.matchScore || 0,
          ),

        label:
          job.matchLabel || "",

        matchedSkills:
          Array.isArray(
            job.matchedSkills,
          )
            ? job.matchedSkills
            : [],

        missingSkills:
          Array.isArray(
            job.missingSkills,
          )
            ? job.missingSkills
            : [],
      },
    }

    localStorage.setItem(
      assistantHandoffStorageKey,
      JSON.stringify(
        handoff,
      ),
    )

    navigate(
      "/assistant",
    )
  }

  async function openDocument(
    documentId,
  ) {
    if (!documentId) {
      return
    }

    setDocumentError("")

    try {
      if (
        !window.jobPilot
          ?.documents?.open
      ) {
        setDocumentError(
          "Document storage is unavailable. Fully restart BreakVeil.",
        )

        return
      }

      const result =
        await window.jobPilot.documents.open(
          documentId,
        )

      if (!result?.ok) {
        setDocumentError(
          result?.error ||
          "Windows could not open this document.",
        )
      }
    } catch (error) {
      setDocumentError(
        error?.message ||
        "Windows could not open this document.",
      )
    }
  }

  function openInterviewPrep() {
    setInterviewForm({
      interviewDate:
        job.interviewDate || "",

      interviewTime:
        job.interviewTime || "",

      interviewFormat:
        job.interviewFormat ||
        "In person",

      interviewLocation:
        job.interviewLocation || "",

      interviewLink:
        job.interviewLink || "",

      interviewAttendees:
        job.interviewAttendees || "",

      interviewNotes:
        job.interviewNotes || "",

      interviewQuestionsToAsk:
        job.interviewQuestionsToAsk ||
        "",

      interviewLikelyQuestions:
        job.interviewLikelyQuestions ||
        "",

      interviewExamplePrompts:
        job.interviewExamplePrompts ||
        "",

      interviewChecklist:
        normaliseInterviewChecklist(
          job.interviewChecklist,
        ),
    })

    setShowInterviewPrep(true)
  }

  function updateInterviewForm(
    field,
    value,
  ) {
    setInterviewForm(
      (current) => ({
        ...current,

        [field]:
          value,
      }),
    )
  }

  function toggleInterviewChecklist(
    itemId,
  ) {
    setInterviewForm(
      (current) => ({
        ...current,

        interviewChecklist: {
          ...normaliseInterviewChecklist(
            current
              ?.interviewChecklist,
          ),

          [itemId]:
            !current
              ?.interviewChecklist
              ?.[itemId],
        },
      }),
    )
  }

  function saveInterviewPrep(
    event,
  ) {
    event.preventDefault()

    if (!interviewForm) {
      return
    }

    const updatedAt =
      new Date()
        .toISOString()

    const updatedJobs =
      jobs.map((item) => {
        if (
          item.id !== job.id
        ) {
          return item
        }

        const currentAction =
          item.nextAction

        const shouldSetAction =
          !currentAction ||
          [
            "None",
            "Wait for response",
          ].includes(
            currentAction,
          )

        const hadInterviewDetails =
          Boolean(
            item.interviewDate ||
            item.interviewTime ||
            item.interviewLocation ||
            item.interviewLink,
          )

        const interviewDescription = [
          interviewForm
            .interviewDate,
          interviewForm
            .interviewTime
            ? `at ${interviewForm.interviewTime}`
            : "",
          interviewForm
            .interviewFormat,
          interviewForm
            .interviewLocation
            .trim(),
        ]
          .filter(Boolean)
          .join(" · ")

        const activity =
          createJobActivity({
            type:
              "interview",

            title:
              hadInterviewDetails
                ? "Interview preparation updated"
                : "Interview scheduled",

            description:
              interviewDescription ||
              "Interview preparation details were saved.",

            createdAt:
              updatedAt,

            metadata: {
              interviewDate:
                interviewForm
                  .interviewDate,

              interviewFormat:
                interviewForm
                  .interviewFormat,
            },
          })

        return appendJobActivity({
          ...item,

          interviewDate:
            interviewForm
              .interviewDate,

          interviewTime:
            interviewForm
              .interviewTime,

          interviewFormat:
            interviewForm
              .interviewFormat,

          interviewLocation:
            interviewForm
              .interviewLocation
              .trim(),

          interviewLink:
            normaliseUrl(
              interviewForm
                .interviewLink,
            ),

          interviewAttendees:
            interviewForm
              .interviewAttendees
              .trim(),

          interviewNotes:
            interviewForm
              .interviewNotes
              .trim(),

          interviewQuestionsToAsk:
            interviewForm
              .interviewQuestionsToAsk
              .trim(),

          interviewLikelyQuestions:
            interviewForm
              .interviewLikelyQuestions
              .trim(),

          interviewExamplePrompts:
            interviewForm
              .interviewExamplePrompts
              .trim(),

          interviewChecklist:
            normaliseInterviewChecklist(
              interviewForm
                .interviewChecklist,
            ),

          nextAction:
            shouldSetAction
              ? "Prepare for interview"
              : currentAction,

          nextActionDate:
            shouldSetAction &&
            interviewForm
              .interviewDate
              ? interviewForm
                  .interviewDate
              : item.nextActionDate,

          updatedAt,
        }, activity)
      })

    saveJobs(
      updatedJobs,
    )

    setShowInterviewPrep(false)
  }

  function openApplicationReview() {
    const defaultCv =
      cvs.find(
        (document) =>
          document.isDefault,
      ) || cvs[0]

    const defaultCoverLetter =
      coverLetters.find(
        (document) =>
          document.isDefault,
      ) || coverLetters[0]

    const recipientName =
      applicationPackage
        ?.recipientName ||
      job.contactName ||
      ""

    const recipientEmail =
      applicationPackage
        ?.recipientEmail ||
      job.contactEmail ||
      ""

    const draft =
      createApplicationDraft(
        job,
        profile,
        recipientName,
      )

    setApplicationForm({
      cvId:
        applicationPackage
          ?.cvId ||
        defaultCv?.id ||
        "",

      coverLetterId:
        applicationPackage
          ?.coverLetterId ||
        (
          getApplicationPreferences()
            .includeCoverLetterByDefault
            ? defaultCoverLetter
                ?.id ||
              ""
            : ""
        ),

      recipientName,

      recipientEmail,

      emailSubject:
        applicationPackage
          ?.emailSubject ||
        draft.subject,

      emailBody:
        applicationPackage
          ?.emailBody ||
        draft.body,

      tailoredCoverLetter:
        applicationPackage
          ?.tailoredCoverLetter ||
        "",

      tailoredCvSummary:
        applicationPackage
          ?.tailoredCvSummary ||
        "",

      tailoringKeywords:
        applicationPackage
          ?.tailoringKeywords ||
        "",

      notes:
        applicationPackage
          ?.notes ||
        "",

      reviewAcknowledgements:
        normaliseReviewAcknowledgements(
          applicationPackage
            ?.reviewAcknowledgements,
        ),
    })

    setApplicationMessage("")
    setShowApplicationReview(true)
  }

  function closeApplicationReview() {
    setShowApplicationReview(false)
    setApplicationMessage("")
  }

  function updateApplicationForm(
    field,
    value,
  ) {
    setApplicationForm(
      (current) => ({
        ...current,

        [field]:
          value,

        ...(field === "reviewAcknowledgements"
          ? {}
          : {
              reviewAcknowledgements: {
                ...emptyReviewAcknowledgements,
              },
            }),
      }),
    )

    setApplicationMessage("")
  }

  async function saveTailoredCoverLetterDocument({
    formOverride = applicationForm,
    silent = false,
  } = {}) {
    const coverLetterText =
      String(
        formOverride
          ?.tailoredCoverLetter ||
        "",
      ).trim()

    if (
      coverLetterText.length <
      20
    ) {
      setApplicationMessage(
        "Generate or enter more cover-letter text before creating the attachment.",
      )

      return null
    }

    setSavingTailoredDocument(
      true,
    )

    if (!silent) {
      setApplicationMessage(
        "Creating the tailored cover-letter attachment...",
      )
    }

    try {
      const result =
        await saveGeneratedCoverLetterToLibrary({
          coverLetter:
            coverLetterText,

          candidateProfile:
            profile,

          vacancy:
            job,

          workspaceId:
            job.id,

          sourceJobId:
            job.id,

          format:
            getCoverLetterFormatPreference(),
        })

      const nextDocuments =
        upsertDocument(
          documents,
          result.document,
        )

      const nextForm = {
        ...formOverride,

        coverLetterId:
          result.document.id,
      }

      setDocuments(
        nextDocuments,
      )

      setApplicationForm(
        nextForm,
      )

      const formatLabel =
        result.format ===
          "pdf"
          ? "PDF"
          : "Word"

      const activity =
        createJobActivity({
          type:
            "application",

          title:
            result.replaced
              ? "Tailored cover letter updated"
              : "Tailored cover letter created",

          description:
            `${formatLabel} document saved to Resume Library and selected for this application.`,

          metadata: {
            generatedDocumentId:
              result.document.id,

            generatedFormat:
              result.format,
          },
        })

      saveJobs(
        appendJobActivityToJobs(
          jobs,
          job.id,
          activity,
        ),
      )

      if (!silent) {
        setApplicationMessage(
          result.replaced
            ? `The tailored ${formatLabel} cover letter was updated and selected as the application attachment.`
            : `The tailored ${formatLabel} cover letter was saved to Resume Library and selected as the application attachment.`,
        )
      }

      return {
        ...result,

        documents:
          nextDocuments,

        form:
          nextForm,
      }
    } catch (error) {
      setApplicationMessage(
        error?.message ||
        "BreakVeil could not create the tailored cover-letter attachment.",
      )

      return null
    } finally {
      setSavingTailoredDocument(
        false,
      )
    }
  }

  function buildApplicationRecord(
    status,
    formOverride = applicationForm,
    documentsOverride = documents,
  ) {
    const selectedCvDocument =
      documentsOverride.find(
        (document) =>
          document.id ===
          formOverride.cvId,
      )

    const selectedCoverLetterDocument =
      documentsOverride.find(
        (document) =>
          document.id ===
          formOverride
            .coverLetterId,
      )

    if (!selectedCvDocument) {
      setApplicationMessage(
        "Choose an available CV before saving this application.",
      )

      return null
    }

    const now =
      new Date()
        .toISOString()

    const returningToDraft =
      status === "Draft" &&
      applicationPackage &&
      applicationPackage
        .status !== "Draft"

    return {
      ...(applicationPackage || {}),

      id:
        applicationPackage
          ?.id ||
        crypto.randomUUID(),

      jobId:
        job.id,

      jobRole:
        job.role,

      company:
        job.company,

      cvId:
        selectedCvDocument.id,

      cvTitle:
        selectedCvDocument.title,

      coverLetterId:
        selectedCoverLetterDocument
          ?.id ||
        "",

      coverLetterTitle:
        selectedCoverLetterDocument
          ?.title ||
        "",

      recipientName:
        formOverride
          .recipientName
          .trim(),

      recipientEmail:
        formOverride
          .recipientEmail
          .trim(),

      emailSubject:
        formOverride
          .emailSubject
          .trim(),

      emailBody:
        formOverride
          .emailBody
          .trim(),

      tailoredCoverLetter:
        formOverride
          .tailoredCoverLetter
          .trim(),

      tailoredCvSummary:
        formOverride
          .tailoredCvSummary
          .trim(),

      tailoringKeywords:
        formOverride
          .tailoringKeywords
          .trim(),

      matchScore:
        Number(
          job.matchScore ||
          applicationPackage
            ?.matchScore ||
          0,
        ),

      jobUrl:
        job.jobUrl || "",

      source:
        job.source || "",

      applicationAnswers:
        applicationPackage
          ?.applicationAnswers ||
        [],

      interviewQuestions:
        applicationPackage
          ?.interviewQuestions ||
        [],

      createdFromAssistant:
        Boolean(
          applicationPackage
            ?.createdFromAssistant,
        ),

      notes:
        formOverride
          .notes
          .trim(),

      reviewAcknowledgements:
        status === "Draft"
          ? { ...emptyReviewAcknowledgements }
          : normaliseReviewAcknowledgements(
              formOverride
                .reviewAcknowledgements,
            ),

      reviewedAt:
        status === "Approved"
          ? now
          : status === "Draft"
            ? ""
            : applicationPackage
                ?.reviewedAt ||
              "",

      approvedAt:
        status === "Approved"
          ? now
          : status === "Draft"
            ? ""
            : applicationPackage
                ?.approvedAt ||
              "",

      status,

      sentAt:
        status === "Sent"
          ? applicationPackage
              ?.sentAt ||
            now
          : returningToDraft
            ? ""
            : applicationPackage
                ?.sentAt ||
              "",

      gmailDraftId:
        returningToDraft
          ? ""
          : applicationPackage
              ?.gmailDraftId ||
            "",

      gmailDraftMessageId:
        returningToDraft
          ? ""
          : applicationPackage
              ?.gmailDraftMessageId ||
            "",

      gmailDraftCreatedAt:
        returningToDraft
          ? ""
          : applicationPackage
              ?.gmailDraftCreatedAt ||
            "",

      gmailDraftAddress:
        returningToDraft
          ? ""
          : applicationPackage
              ?.gmailDraftAddress ||
            "",

      gmailDraftAttachmentNames:
        returningToDraft
          ? []
          : applicationPackage
              ?.gmailDraftAttachmentNames ||
            [],

      gmailDraftHistory:
        returningToDraft
          ? []
          : applicationPackage
              ?.gmailDraftHistory ||
            [],

      gmailDraftCount:
        returningToDraft
          ? 0
          : applicationPackage
              ?.gmailDraftCount ||
            0,

      createdAt:
        applicationPackage
          ?.createdAt ||
        now,

      updatedAt:
        now,
    }
  }

  async function persistApplication(
    status,
    successMessage,
    saveOnly = false,
  ) {
    setApplicationSaving(true)

    try {
      let workingForm = {
        ...applicationForm,
      }

      let workingDocuments = [
        ...documents,
      ]

      let generatedAttachmentSaved =
        false

      const selectedFormCoverLetter =
        workingDocuments.find(
          (document) =>
            document.id ===
            workingForm
              .coverLetterId,
        )

      const selectedGeneratedCoverLetter =
        [
          "JobPilot",
          "BreakVeil",
        ].includes(
          selectedFormCoverLetter
            ?.generatedBy,
        ) &&
        selectedFormCoverLetter
          ?.generatedKind ===
            "cover-letter"

      const shouldSaveGeneratedAttachment =
        status !== "Draft" &&
        String(
          workingForm
            .tailoredCoverLetter ||
          "",
        ).trim().length >=
          20 &&
        (
          !selectedFormCoverLetter ||
          selectedGeneratedCoverLetter
        )

      if (
        shouldSaveGeneratedAttachment
      ) {
        const generatedResult =
          await saveTailoredCoverLetterDocument({
            formOverride:
              workingForm,

            silent:
              true,
          })

        if (!generatedResult) {
          return null
        }

        workingForm =
          generatedResult.form

        workingDocuments =
          generatedResult.documents

        generatedAttachmentSaved =
          true
      }

      const workingCv =
        workingDocuments.find(
          (document) =>
            document.id ===
            workingForm.cvId,
        )

      const workingCoverLetter =
        workingDocuments.find(
          (document) =>
            document.id ===
            workingForm
              .coverLetterId,
        )

      const workingReadiness =
        buildApplicationPreparation({
          job,

          cv:
            workingCv,

          coverLetterId:
            workingForm
              .coverLetterId,

          coverLetter:
            workingCoverLetter,

          recipientEmail:
            workingForm
              .recipientEmail,

          emailSubject:
            workingForm
              .emailSubject,

          emailBody:
            workingForm
              .emailBody,

          applicationAnswers:
            applicationPackage
              ?.applicationAnswers,

          reviewAcknowledgements:
            workingForm
              .reviewAcknowledgements,
        })

      const needsHumanApproval =
        status === "Approved" ||
        status === "Sent"

      if (
        status !== "Draft" &&
        !(needsHumanApproval
          ? workingReadiness
              .readyForApproval
          : workingReadiness
              .readyForReview)
      ) {
        const incomplete = needsHumanApproval
          ? workingReadiness
              .reviewTotalCount -
            workingReadiness
              .reviewPassedCount
          : workingReadiness
              .totalCount -
            workingReadiness
              .passedCount

        setApplicationMessage(
          needsHumanApproval
            ? `Tick the ${incomplete} remaining human review check${incomplete === 1 ? "" : "s"} before approving.`
            : `Complete the ${incomplete} remaining readiness check${incomplete === 1 ? "" : "s"} before continuing.`,
        )

        return null
      }

      const record =
        buildApplicationRecord(
          status,
          workingForm,
          workingDocuments,
        )

      if (!record) {
        return null
      }

      const updatedQueue =
        applicationPackage
          ? queue.map(
              (item) =>
                item.id ===
                applicationPackage.id
                  ? record
                  : item,
            )
          : [
              record,
              ...queue,
            ]

      saveQueue(
        updatedQueue,
      )

      const previousStatus =
        applicationPackage
          ?.status ||
        ""

      const applicationTitles = {
        Draft:
          applicationPackage
            ? "Application draft saved"
            : "Application package created",

        "Ready for Review":
          "Application ready for review",

        Approved:
          "Application approved",

        Sent:
          "Application sent",
      }

      const activity =
        createJobActivity({
          type:
            status === "Sent"
              ? "sent"
              : "application",

          title:
            saveOnly
              ? "Application changes saved"
              : applicationTitles[
                  status
                ] ||
                `Application status: ${status}`,

          description:
            saveOnly
              ? "Documents, recipient details, email content or tailored wording were updated without changing the application stage."
              : previousStatus &&
                  previousStatus !== status
                ? `Moved from ${previousStatus} to ${status}.`
                : status === "Draft"
                  ? "Application documents and email details were saved."
                  : "Application package updated.",

          metadata: {
            applicationStatus:
              status,

            applicationCreatedId:
              applicationPackage
                ?.id ||
              record.id,

            previousApplicationStatus:
              previousStatus,
          },
        })

      saveJobs(
        appendJobActivityToJobs(
          jobs,
          job.id,
          activity,
        ),
      )

      setApplicationMessage(
        generatedAttachmentSaved
          ? `${successMessage} The latest tailored cover letter was saved and selected automatically.`
          : successMessage,
      )

      return record
    } finally {
      setApplicationSaving(false)
    }
  }

  async function createGmailDraft() {
    if (
      !applicationPackage ||
      applicationPackage
        .status !==
        "Approved"
    ) {
      setApplicationMessage(
        "Approve the application before creating a Gmail draft.",
      )

      return
    }

    if (
      !packageReadiness.readyForApproval
    ) {
      setApplicationMessage(
        "Complete the readiness checks before creating a Gmail draft.",
      )

      return
    }

    if (
      !gmailStatus.connected
    ) {
      setApplicationMessage(
        "Connect Gmail from Automation before creating a draft.",
      )

      return
    }

    setCreatingGmailDraft(true)
    setApplicationMessage(
      "Creating the Gmail draft and attaching the selected documents...",
    )

    try {
      const result =
        await window.jobPilot.gmail.createDraft({
          recipientEmail:
            applicationPackage
              .recipientEmail,

          emailSubject:
            applicationPackage
              .emailSubject,

          emailBody:
            applicationPackage
              .emailBody,

          cvId:
            applicationPackage
              .cvId,

          coverLetterId:
            applicationPackage
              .coverLetterId,
        })

      if (!result?.ok) {
        setApplicationMessage(
          result?.error ||
          "BreakVeil could not create the Gmail draft.",
        )

        return
      }

      const createdAt =
        result.createdAt ||
        new Date()
          .toISOString()

      const attachmentNames =
        Array.isArray(
          result.attachmentNames,
        )
          ? result.attachmentNames
          : []

      const draftRecord = {
        draftId:
          result.draftId || "",

        messageId:
          result.messageId || "",

        createdAt,

        gmailAddress:
          result.gmailAddress ||
          gmailStatus.email ||
          "",

        attachmentNames,
      }

      const previousHistory =
        getExistingDraftHistory(
          applicationPackage,
        )

      const updatedHistory = [
        ...previousHistory,
        draftRecord,
      ]

      const updatedQueue =
        queue.map(
          (item) =>
            item.id ===
            applicationPackage.id
              ? {
                  ...item,

                  gmailDraftId:
                    draftRecord
                      .draftId,

                  gmailDraftMessageId:
                    draftRecord
                      .messageId,

                  gmailDraftCreatedAt:
                    draftRecord
                      .createdAt,

                  gmailDraftAddress:
                    draftRecord
                      .gmailAddress,

                  gmailDraftAttachmentNames:
                    draftRecord
                      .attachmentNames,

                  gmailDraftHistory:
                    updatedHistory,

                  gmailDraftCount:
                    updatedHistory
                      .length,

                  updatedAt:
                    createdAt,
                }
              : item,
        )

      saveQueue(
        updatedQueue,
      )

      saveJobs(
        appendJobActivityToJobs(
          jobs,
          job.id,
          createJobActivity({
            type:
              "gmail",

            title:
              "Gmail draft created",

            description:
              `${attachmentNames.length} attachment${attachmentNames.length === 1 ? "" : "s"} included.`,

            createdAt,

            dedupeKey:
              `gmail-draft-${applicationPackage.id}-${draftRecord.draftId || createdAt}`,

            metadata: {
              gmailDraftId:
                draftRecord
                  .draftId,

              attachmentCount:
                attachmentNames
                  .length,
            },
          }),
        ),
      )

      setApplicationMessage(
        `Gmail draft created with ${attachmentNames.length} attachment${attachmentNames.length === 1 ? "" : "s"}.`,
      )
    } catch (error) {
      setApplicationMessage(
        error?.message ||
        "BreakVeil could not create the Gmail draft.",
      )
    } finally {
      setCreatingGmailDraft(false)
    }
  }

  async function openGmailDrafts() {
    try {
      if (
        !window.jobPilot
          ?.gmail?.openDrafts
      ) {
        setApplicationMessage(
          "The Gmail service is unavailable. Fully restart BreakVeil.",
        )

        return
      }

      const result =
        await window.jobPilot.gmail.openDrafts()

      if (!result?.ok) {
        setApplicationMessage(
          result?.error ||
          "BreakVeil could not open Gmail Drafts.",
        )
      }
    } catch (error) {
      setApplicationMessage(
        error?.message ||
        "BreakVeil could not open Gmail Drafts.",
      )
    }
  }

  async function copyApplicationEmail() {
    const source =
      applicationPackage ||
      applicationForm

    const copied =
      await copyText(
        [
          `To: ${source.recipientEmail || ""}`,

          `Subject: ${source.emailSubject || ""}`,

          "",

          source.emailBody || "",

          "",

          `CV: ${applicationPackage?.cvTitle || formSelectedCv?.title || "None selected"}`,

          `Cover letter: ${applicationPackage?.coverLetterTitle || formSelectedCoverLetter?.title || "None selected"}`,
        ].join("\n"),
      )

    setApplicationMessage(
      copied
        ? "Application email copied."
        : "BreakVeil could not copy the email.",
    )
  }

  function markApplicationSent() {
    if (
      !applicationPackage ||
      applicationPackage
        .status !==
        "Approved"
    ) {
      setApplicationMessage(
        "Only an approved application can be marked as sent.",
      )

      return
    }

    if (
      !packageReadiness.readyForApproval
    ) {
      setApplicationMessage(
        "Complete the readiness checks before marking the application as sent.",
      )

      return
    }

    const confirmed =
      window.confirm(
        `Confirm that the application for ${job.role} at ${job.company} has been sent?`,
      )

    if (!confirmed) {
      return
    }

    const sentAt =
      new Date()
        .toISOString()

    const updatedQueue =
      queue.map(
        (item) =>
          item.id ===
          applicationPackage.id
            ? {
                ...item,

                status:
                  "Sent",

                sentAt,

                updatedAt:
                  sentAt,
              }
            : item,
      )

    const applicationDate =
      sentAt.slice(
        0,
        10,
      )

    const sentActivity =
      createJobActivity({
        type:
          "sent",

        title:
          "Application sent",

        description:
          applicationPackage
            .recipientEmail
            ? `Sent to ${applicationPackage.recipientEmail}.`
            : "Application recorded as sent.",

        createdAt:
          sentAt,

        dedupeKey:
          `application-sent-${applicationPackage.id}-${sentAt}`,

        metadata: {
          applicationStatus:
            "Sent",

          recipientEmail:
            applicationPackage
              .recipientEmail ||
            "",
        },
      })

    const updatedJobs =
      jobs.map(
        (item) =>
          item.id === job.id
            ? appendJobActivity({
                ...item,

                status:
                  "Applied",

                dateApplied:
                  item.dateApplied ||
                  applicationDate,

                nextAction:
                  item.nextAction &&
                  item.nextAction !==
                    "None"
                    ? item.nextAction
                    : "Wait for response",

                updatedAt:
                  sentAt,
              }, sentActivity)
            : item,
      )

    saveQueue(
      updatedQueue,
    )

    saveJobs(
      updatedJobs,
    )

    setApplicationMessage(
      "Application marked as sent and the job moved to Applied.",
    )
  }

  function openNotesEditor() {
    setNotesDraft(
      job.notes || "",
    )

    setShowNotesEditor(
      true,
    )
  }

  function saveNotes(event) {
    event.preventDefault()

    const nextNotes =
      String(
        notesDraft || "",
      ).trim()

    const currentNotes =
      String(
        job.notes || "",
      ).trim()

    if (
      nextNotes ===
      currentNotes
    ) {
      setShowNotesEditor(
        false,
      )

      return
    }

    const updatedAt =
      new Date()
        .toISOString()

    const activity =
      createJobActivity({
        type:
          "updated",

        title:
          nextNotes
            ? currentNotes
              ? "Job notes updated"
              : "Job notes added"
            : "Job notes cleared",

        description:
          nextNotes
            ? "Private workspace notes were saved."
            : "The saved workspace notes were removed.",

        createdAt:
          updatedAt,

        metadata: {
          notesChanged:
            true,
        },
      })

    const updatedJobs =
      jobs.map(
        (item) =>
          item.id === job.id
            ? appendJobActivity({
                ...item,

                notes:
                  nextNotes,

                updatedAt,
              }, activity)
            : item,
      )

    saveJobs(
      updatedJobs,
    )

    setShowNotesEditor(
      false,
    )
  }

  function openActionEditor() {
    setActionDraft({
      nextAction:
        job.nextAction ||
        "None",

      nextActionDate:
        job.nextActionDate ||
        "",
    })

    setShowActionEditor(
      true,
    )
  }

  function saveNextAction(event) {
    event.preventDefault()

    const enteredAction =
      String(
        actionDraft
          .nextAction ||
        "",
      ).trim()

    const nextAction =
      enteredAction &&
      enteredAction.toLowerCase() !==
        "none"
        ? enteredAction
        : "None"

    const nextActionDate =
      nextAction ===
        "None"
        ? ""
        : actionDraft
            .nextActionDate ||
          ""

    const currentAction =
      String(
        job.nextAction ||
        "None",
      ).trim() ||
      "None"

    const currentDate =
      job.nextActionDate ||
      ""

    if (
      nextAction ===
        currentAction &&
      nextActionDate ===
        currentDate
    ) {
      setShowActionEditor(
        false,
      )

      return
    }

    const updatedAt =
      new Date()
        .toISOString()

    const dueDescription =
      nextActionDate
        ? ` Due ${formatLocalDate(nextActionDate)}.`
        : ""

    const activity =
      createJobActivity({
        type:
          "action",

        title:
          nextAction ===
            "None"
            ? "Next action cleared"
            : currentAction ===
                "None"
              ? "Next action added"
              : "Next action updated",

        description:
          nextAction ===
            "None"
            ? "No next action is currently set."
            : `${nextAction}.${dueDescription}`,

        createdAt:
          updatedAt,

        metadata: {
          previousAction:
            currentAction,

          nextAction,

          nextActionDate,
        },
      })

    const updatedJobs =
      jobs.map(
        (item) =>
          item.id === job.id
            ? appendJobActivity({
                ...item,

                nextAction,

                nextActionDate,

                followUpDate:
                  nextAction ===
                    "None"
                    ? ""
                    : item.followUpDate ||
                      "",

                updatedAt,
              }, activity)
            : item,
      )

    saveJobs(
      updatedJobs,
    )

    setShowActionEditor(
      false,
    )
  }

  function submitJobEdit(event) {
    event.preventDefault()

    if (
      !jobForm.role.trim() ||
      !jobForm.company.trim()
    ) {
      return
    }

    const updatedAt =
      new Date()
        .toISOString()

    const statusChanged =
      jobForm.status !==
      job.status

    const activity =
      createJobActivity({
        type:
          statusChanged
            ? [
                "Offer",
                "Rejected",
              ].includes(
                jobForm.status,
              )
              ? "outcome"
              : "status"
            : "updated",

        title:
          statusChanged
            ? jobForm.status ===
                "Offer"
              ? "Offer recorded"
              : jobForm.status ===
                  "Rejected"
                ? "Application outcome recorded"
                : `Status changed to ${jobForm.status}`
            : "Job details updated",

        description:
          statusChanged
            ? `Moved from ${job.status || "Saved"} to ${jobForm.status}.`
            : "The core vacancy details were edited.",

        createdAt:
          updatedAt,

        metadata: {
          previousStatus:
            job.status || "",

          status:
            jobForm.status,
        },
      })

    const updatedJobs =
      jobs.map(
        (item) =>
          item.id === job.id
            ? appendJobActivity({
                ...item,

                role:
                  jobForm.role
                    .trim(),

                company:
                  jobForm.company
                    .trim(),

                location:
                  jobForm.location
                    .trim(),

                salary:
                  jobForm.salary
                    .trim(),

                status:
                  jobForm.status,

                jobUrl:
                  normaliseUrl(
                    jobForm.jobUrl,
                  ),

                updatedAt,
              }, activity)
            : item,
      )

    saveJobs(
      updatedJobs,
    )

    setEditingJob(false)
  }

  if (!job) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-500">
          <Briefcase size={23} />
        </div>

        <h1 className="mt-5 text-xl font-semibold">
          Job not found
        </h1>

        <p className="mt-2 max-w-md text-sm text-zinc-500">
          This job may have been deleted or is no longer stored in My Jobs.
        </p>

        <button
          type="button"
          onClick={
            openMyJobs
          }
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <ArrowLeft size={16} />
          Return to My Jobs
        </button>
      </div>
    )
  }

  const nextAction =
    getNextAction(job)

  const actionDate =
    getNextActionDate(job)

  const draftCount =
    getDraftCount(
      applicationPackage,
    )

  const interviewChecklist =
    normaliseInterviewChecklist(
      job.interviewChecklist,
    )

  const interviewTasksComplete =
    Object.values(
      interviewChecklist,
    ).filter(Boolean).length

  const interviewQuestionCount =
    String(
      job.interviewQuestionsToAsk ||
      "",
    )
      .split("\n")
      .map((value) =>
        value.trim(),
      )
      .filter(Boolean)
      .length

  const activityTimeline =
    buildJobActivityTimeline(
      job,
      applicationPackage,
    )

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        onClick={
          openMyJobs
        }
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to My Jobs
      </button>

      <header className="mt-6 flex flex-col justify-between gap-5 border-b border-zinc-800 pb-6 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
              {job.role}
            </h1>

            <span
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium",

                jobStatusClass(
                  job.status,
                ),
              ].join(" ")}
            >
              {job.status}
            </span>

            {Number(
              job.matchScore || 0,
            ) > 0 && (
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium",

                  getMatchScoreClass(
                    Number(
                      job.matchScore ||
                        0,
                    ),
                  ),
                ].join(
                  " ",
                )}
              >
                {job.matchScore}%{" "}
                {job.matchLabel ||
                  "match"}
              </span>
            )}
          </div>

          <p className="mt-3 flex items-center gap-2 text-base text-zinc-400">
            <Building2 size={17} />
            {job.company}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
            {job.location && (
              <span className="flex items-center gap-2">
                <MapPin size={15} />
                {job.location}
              </span>
            )}

            {job.salary && (
              <span>
                {job.salary}
              </span>
            )}

            {job.dateApplied && (
              <span className="flex items-center gap-2">
                <CalendarDays size={15} />

                Applied{" "}
                {formatLocalDate(
                  job.dateApplied,
                )}
              </span>
            )}

            {!job.dateApplied &&
              job.postedAt && (
                <span className="flex items-center gap-2">
                  <CalendarDays size={15} />

                  Posted{" "}
                  {formatDate(
                    job.postedAt,
                  )}
                </span>
              )}
          </div>
        </div>

        <select
          value={job.status}
          onChange={(event) =>
            updateJobStatus(
              event.target.value,
            )
          }
          className="h-11 w-fit rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none"
        >
          {jobStatuses.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ),
          )}
        </select>
      </header>

      <div className="jp-grid-sidebar mt-6 gap-6">
        <main className="space-y-5">
          <Section
            title="Overview"
            icon={Briefcase}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Company"
                value={job.company}
              />

              <Detail
                label="Location"
                value={
                  job.location ||
                  "Not specified"
                }
              />

              <Detail
                label="Salary"
                value={
                  job.salary ||
                  "Not specified"
                }
              />

              <Detail
                label="Source"
                value={
                  job.sourceNames
                    ?.join(", ") ||
                  job.sourceName ||
                  "Manually added"
                }
              />
            </div>

            {job.description ? (
              <details className="mt-5 border-t border-zinc-800 pt-4">
                <summary className="cursor-pointer text-sm font-medium text-zinc-300">
                  View job description
                </summary>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
                  {job.description}
                </p>
              </details>
            ) : (
              <div className="mt-5 flex flex-col justify-between gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-zinc-400">
                    No job description saved
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Add the description to improve matching, tailoring and interview suggestions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingJob(true)
                  }
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  <Pencil size={15} />
                  Add description
                </button>
              </div>
            )}
          </Section>

          {(job.contactName ||
            job.contactEmail) && (
            <Section
              title="Hiring contact"
              icon={UserRound}
            >
              <div className="space-y-3 text-sm text-zinc-400">
                {job.contactName && (
                  <p className="flex items-center gap-2">
                    <UserRound size={15} />
                    {job.contactName}
                  </p>
                )}

                {job.contactEmail && (
                  <a
                    href={`mailto:${job.contactEmail}`}
                    className="flex items-center gap-2 transition hover:text-white"
                  >
                    <Mail size={15} />
                    {job.contactEmail}
                  </a>
                )}
              </div>
            </Section>
          )}
          <Section
            title="Notes"
            icon={FileText}
          >
            {job.notes ? (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <p className="min-w-0 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                  {job.notes}
                </p>

                <button
                  type="button"
                  onClick={
                    openNotesEditor
                  }
                  className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  <Pencil size={15} />
                  Edit notes
                </button>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-zinc-400">
                    No notes added
                  </p>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Keep useful reminders, contact details or application context with this job.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openNotesEditor
                  }
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  <Plus size={15} />
                  Add notes
                </button>
              </div>
            )}
          </Section>

          <Section
            title="Next action"
            icon={Target}
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium text-zinc-200">
                  {nextAction}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {nextAction ===
                    "No action set"
                    ? "Add a next step so this job does not get forgotten."
                    : actionDate
                      ? `Due ${formatLocalDate(actionDate)}`
                      : "No due date set"}
                </p>
              </div>

              <div className="flex w-fit flex-wrap gap-2">
                {nextAction !==
                  "No action set" &&
                  nextAction !==
                    "Wait for response" && (
                    <button
                      type="button"
                      onClick={
                        markActionDone
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
                    >
                      <Check size={15} />
                      Mark done
                    </button>
                  )}

                <button
                  type="button"
                  onClick={
                    openActionEditor
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                >
                  <Pencil size={15} />
                  {nextAction ===
                  "No action set"
                    ? "Set next action"
                    : "Edit action"}
                </button>
              </div>
            </div>
          </Section>

          <div
            id="company-research-workspace"
            className="scroll-mt-24"
          >
            <CompanyResearchPanel
              job={
                job
              }
              report={
                job.companyResearch ||
                null
              }
              history={
                Array.isArray(
                  job.companyResearchHistory,
                )
                  ? job.companyResearchHistory
                  : []
              }
              onSave={
                saveCompanyResearch
              }
            />
          </div>

          {job.status ===
            "Interview" && (
            <Section
              title="Interview preparation"
              icon={CalendarCheck2}
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                      {job.interviewDate
                        ? formatLocalDate(
                            job.interviewDate,
                          )
                        : "Date not set"}
                      {job.interviewTime
                        ? ` · ${job.interviewTime}`
                        : ""}
                    </span>

                    {job.interviewFormat && (
                      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                        {job.interviewFormat}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    {job.interviewLocation ||
                      (job.interviewLink
                        ? "Online meeting"
                        : "Location not set")}
                  </p>

                  {job.interviewAttendees && (
                    <p className="mt-1 text-xs text-zinc-600">
                      Meeting with{" "}
                      {job.interviewAttendees}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {job.interviewLink && (
                    <a
                      href={
                        job.interviewLink
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                    >
                      <Link2 size={15} />
                      Open meeting
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={
                      openInterviewPrep
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    <Pencil size={15} />
                    Prepare interview
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                      <ListTodo size={15} />
                      Preparation checklist
                    </p>

                    <span className="text-xs text-zinc-600">
                      {interviewTasksComplete}/
                      {interviewChecklistItems.length}
                    </span>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{
                        width: `${
                          (
                            interviewTasksComplete /
                            interviewChecklistItems.length
                          ) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <p className="text-sm font-medium text-zinc-300">
                    Questions prepared
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-zinc-100">
                    {interviewQuestionCount}
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Questions you plan to ask the interviewer
                  </p>
                </div>
              </div>

              {job.interviewNotes && (
                <p className="mt-4 line-clamp-3 whitespace-pre-wrap border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-500">
                  {job.interviewNotes}
                </p>
              )}
            </Section>
          )}

          <Section
            title="Application"
            icon={ClipboardCheck}
          >
            {documentsLoading ? (
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
                Loading application details
              </div>
            ) : applicationPackage ? (
              <div>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-xs font-medium",

                          packageStatusClass(
                            applicationPackage
                              .status,
                          ),
                        ].join(" ")}
                      >
                        {applicationPackage
                          .status ||
                          "Draft"}
                      </span>

                      <ReadinessBadge
                        readiness={
                          packageReadiness
                        }
                      />

                      {draftCount > 0 && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                          {draftCount} Gmail draft
                          {draftCount === 1
                            ? ""
                            : "s"}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm text-zinc-500">
                      {applicationPackage
                        .recipientEmail ||
                        "Recipient email not added"}
                    </p>

                    {applicationPackage
                      .sentAt && (
                        <p className="mt-1 text-xs text-sky-300">
                          Sent{" "}
                          {formatDateTime(
                            applicationPackage
                              .sentAt,
                          )}
                        </p>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={
                      openApplicationReview
                    }
                    className="shrink-0 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
                  >
                    Review application
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DocumentRow
                    label="CV"
                    title={
                      selectedCv
                        ?.title ||
                      applicationPackage
                        .cvTitle ||
                      "CV unavailable"
                    }
                    available={Boolean(
                      selectedCv,
                    )}
                    onOpen={() =>
                      openDocument(
                        applicationPackage
                          .cvId,
                      )
                    }
                  />

                  <DocumentRow
                    label="Cover letter"
                    title={
                      selectedCoverLetter
                        ?.title ||
                      applicationPackage
                        .coverLetterTitle ||
                      "No cover letter selected"
                    }
                    available={Boolean(
                      selectedCoverLetter,
                    )}
                    optional
                    onOpen={() =>
                      openDocument(
                        applicationPackage
                          .coverLetterId,
                      )
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    No application prepared
                  </p>

                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Choose your documents, generate tailored content, prepare the email and complete the readiness checks here.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openApplicationReview
                  }
                  className="shrink-0 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
                >
                  Prepare application
                </button>
              </div>
            )}

            {documentError && (
              <p className="mt-3 text-xs text-red-300">
                {documentError}
              </p>
            )}
          </Section>

        </main>

        <aside className="h-fit rounded-xl border border-zinc-800 bg-[#151515] p-4 xl:sticky xl:top-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Workspace actions
          </p>

          <div className="mt-4 space-y-2">
            {job.jobUrl && (
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noreferrer"
                className={actionClass}
              >
                <ExternalLink size={16} />
                Open job advert
              </a>
            )}

            <button
              type="button"
              onClick={() =>
                setEditingJob(true)
              }
              className={actionClass}
            >
              <Pencil size={16} />
              Edit job details
            </button>

            <button
              type="button"
              onClick={
                openAssistant
              }
              className={actionClass}
            >
              <Bot size={16} />
              Open AI Assistant
            </button>

            <button
              type="button"
              onClick={() =>
                document
                  .querySelector(
                    "#company-research-workspace",
                  )
                  ?.scrollIntoView({
                    behavior:
                      "smooth",

                    block:
                      "start",
                  })
              }
              className={actionClass}
            >
              <Landmark size={16} />
              Company research
            </button>

            <button
              type="button"
              onClick={() =>
                setShowActivityHistory(
                  true,
                )
              }
              className={actionClass}
            >
              <History size={16} />
              View activity

              <span className="ml-auto rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500">
                {activityTimeline.length}
              </span>
            </button>

          </div>

          <p className="mt-4 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-600">
            Application preparation and delivery remain in the final Application section below the job details.
          </p>
        </aside>
      </div>

      {showActivityHistory && (
        <ActivityHistoryModal
          job={job}
          events={
            activityTimeline
          }
          onClose={() =>
            setShowActivityHistory(
              false,
            )
          }
        />
      )}

      {showNotesEditor && (
        <NotesEditorModal
          job={job}
          value={
            notesDraft
          }
          onChange={
            setNotesDraft
          }
          onSubmit={
            saveNotes
          }
          onClose={() =>
            setShowNotesEditor(
              false,
            )
          }
        />
      )}

      {showActionEditor && (
        <NextActionModal
          job={job}
          form={
            actionDraft
          }
          onChange={(
            field,
            value,
          ) =>
            setActionDraft(
              (current) => ({
                ...current,

                [field]:
                  value,
              }),
            )
          }
          onSubmit={
            saveNextAction
          }
          onClose={() =>
            setShowActionEditor(
              false,
            )
          }
        />
      )}

      {editingJob &&
        jobForm && (
          <EditJobModal
            form={jobForm}
            onChange={(
              field,
              value,
            ) =>
              setJobForm(
                (current) => ({
                  ...current,

                  [field]:
                    value,
                }),
              )
            }
            onSubmit={
              submitJobEdit
            }
            onClose={() =>
              setEditingJob(false)
            }
          />
        )}

      {showInterviewPrep &&
        interviewForm && (
          <InterviewPrepModal
            job={job}
            profile={
              profile
            }
            form={
              interviewForm
            }
            checklist={
              normaliseInterviewChecklist(
                interviewForm
                  .interviewChecklist,
              )
            }
            selectedCv={
              selectedCv
            }
            selectedCoverLetter={
              selectedCoverLetter
            }
            hasApplication={
              Boolean(
                applicationPackage,
              )
            }
            onChange={
              updateInterviewForm
            }
            onToggleChecklist={
              toggleInterviewChecklist
            }
            onSubmit={
              saveInterviewPrep
            }
            onClose={() =>
              setShowInterviewPrep(
                false,
              )
            }
            onOpenDocument={
              openDocument
            }
            onOpenApplication={() => {
              openApplicationReview()
            }}
          />
        )}

      {showApplicationReview && (
        <ApplicationReviewModal
          job={job}
          profile={
            profile
          }
          applicationPackage={
            applicationPackage
          }
          returnToInterview={
            showInterviewPrep
          }
          form={applicationForm}
          readiness={
            formReadiness
          }
          documentsLoading={
            documentsLoading
          }
          cvs={cvs}
          coverLetters={
            coverLetters
          }
          gmailStatus={
            gmailStatus
          }
          checkingGmail={
            checkingGmail
          }
          message={
            applicationMessage
          }
          saving={
            applicationSaving
          }
          creatingGmailDraft={
            creatingGmailDraft
          }
          savingTailoredDocument={
            savingTailoredDocument
          }
          draftCount={
            draftCount
          }
          onChange={
            updateApplicationForm
          }
          onSaveTailoredCoverLetter={
            saveTailoredCoverLetterDocument
          }
          onClose={
            closeApplicationReview
          }
          onSaveDraft={() =>
            persistApplication(
              "Draft",
              "Application returned to Draft.",
            )
          }
          onSaveChanges={() =>
            persistApplication(
              applicationPackage
                ?.status ||
                "Draft",
              applicationPackage
                ? "Application changes saved."
                : "Application saved as a draft.",
              true,
            )
          }
          onSendToReview={() =>
            persistApplication(
              "Ready for Review",
              "Application is ready for review.",
            )
          }
          onApprove={() =>
            persistApplication(
              "Approved",
              "Application approved and ready for delivery.",
            )
          }
          onReopenReview={() =>
            persistApplication(
              "Ready for Review",
              "Application returned to review.",
            )
          }
          onReturnToApproved={() =>
            persistApplication(
              "Approved",
              "Application returned to Approved.",
            )
          }
          onCreateGmailDraft={
            createGmailDraft
          }
          onOpenGmailDrafts={
            openGmailDrafts
          }
          onCopyEmail={
            copyApplicationEmail
          }
          onMarkSent={
            markApplicationSent
          }
          onOpenResumeLibrary={() => {
            closeApplicationReview()
            navigate(
              "/resume-library",
            )
          }}
          onOpenAutomation={() => {
            closeApplicationReview()
            navigate(
              "/automation",
            )
          }}
        />
      )}
    </div>
  )
}

function ActivityHistoryModal({
  job,
  events,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-zinc-800 bg-[#151515] px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                <Activity size={18} />
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Workspace activity
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {job.role} at{" "}
                  {job.company}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </header>

        <div className="p-6">
          <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <History
              size={17}
              className="mt-0.5 shrink-0 text-zinc-500"
            />

            <p className="text-xs leading-5 text-zinc-600">
              BreakVeil records important changes locally. Older jobs may include reconstructed events based on their saved dates, application package and Gmail draft records.
            </p>
          </div>

          {events.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <Activity
                size={25}
                className="text-zinc-700"
              />

              <p className="mt-4 font-medium text-zinc-300">
                No activity recorded
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                New workspace changes will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              {events.map(
                (
                  event,
                  index,
                ) => (
                  <ActivityTimelineItem
                    key={
                      event.id
                    }
                    event={
                      event
                    }
                    last={
                      index ===
                      events.length -
                        1
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex justify-end border-t border-zinc-800 bg-[#151515] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

function ActivityTimelineItem({
  event,
  last,
}) {
  const styles = {
    tracked: {
      icon:
        Briefcase,

      className:
        "border-zinc-700 bg-zinc-800 text-zinc-300",
    },

    updated: {
      icon:
        Pencil,

      className:
        "border-zinc-700 bg-zinc-800 text-zinc-300",
    },

    status: {
      icon:
        Target,

      className:
        "border-violet-500/20 bg-violet-500/10 text-violet-300",
    },

    outcome: {
      icon:
        CheckCircle2,

      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },

    action: {
      icon:
        Check,

      className:
        "border-sky-500/20 bg-sky-500/10 text-sky-300",
    },

    application: {
      icon:
        ClipboardCheck,

      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
    },

    gmail: {
      icon:
        Mail,

      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },

    sent: {
      icon:
        Send,

      className:
        "border-sky-500/20 bg-sky-500/10 text-sky-300",
    },

    interview: {
      icon:
        CalendarCheck2,

      className:
        "border-violet-500/20 bg-violet-500/10 text-violet-300",
    },
  }

  const style =
    styles[event.type] ||
    styles.updated

  const Icon =
    style.icon

  const createdAt =
    new Date(
      event.createdAt,
    )

  const formattedDate =
    Number.isNaN(
      createdAt.getTime(),
    )
      ? "Date unavailable"
      : createdAt.toLocaleString(
          "en-GB",
          {
            day:
              "numeric",

            month:
              "short",

            year:
              "numeric",

            hour:
              "2-digit",

            minute:
              "2-digit",
          },
        )

  return (
    <div className="relative flex gap-4 pb-6">
      {!last && (
        <div className="absolute left-[18px] top-10 h-[calc(100%-1.5rem)] w-px bg-zinc-800" />
      )}

      <div
        className={[
          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",

          style.className,
        ].join(" ")}
      >
        <Icon size={15} />
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/35 p-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {event.title}
            </p>

            {event.description && (
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {event.description}
              </p>
            )}
          </div>

          <span className="shrink-0 text-xs text-zinc-700">
            {formattedDate}
          </span>
        </div>

        <span className="mt-3 inline-flex rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-600">
          {event.actor ===
            "automation"
            ? "Automation"
            : event.actor ===
                "system"
              ? "Recovered"
              : "You"}
        </span>
      </div>
    </div>
  )
}

function InterviewResearchSourceLinks({
  report,
  sourceIds,
}) {
  const numbers =
    getResearchSourceNumbers(
      report,
      sourceIds,
    )

  if (
    !report ||
    numbers.length === 0
  ) {
    return null
  }

  return (
    <span className="ml-1 inline-flex gap-1 align-super text-[10px] font-semibold">
      {numbers.map(
        (number) => {
          const source =
            report.sources?.find(
              (item) =>
                item.number === number,
            )

          return source?.url ? (
            <a
              key={number}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={`Open source ${number}: ${source.publisher}`}
              className="rounded px-0.5 text-indigo-300 underline decoration-indigo-400/40 underline-offset-2 transition hover:text-indigo-100"
            >
              [{number}]
            </a>
          ) : (
            <span
              key={number}
              className="text-indigo-300"
            >
              [{number}]
            </span>
          )
        },
      )}
    </span>
  )
}

function CompanyResearchInterviewContext({
  job,
}) {
  const report =
    job.companyResearch ||
    null

  if (!report) {
    return null
  }

  const quickBrief =
    buildCompanyResearchQuickBrief({
      report,
      job,
    })

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/[0.045]">
      <div className="flex flex-col justify-between gap-3 border-b border-indigo-500/15 px-4 py-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="jp-tone-document flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
            <Landmark size={16} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-zinc-200">
                Company research context
              </p>

              <span className="jp-tone-document rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Quick Brief
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {report.sources?.length || 0} cited source
              {report.sources?.length === 1 ? "" : "s"}
              {report.refreshedAt || report.createdAt
                ? ` • Updated ${formatResearchDate(
                    report.refreshedAt ||
                      report.createdAt,
                  )}`
                : ""}
            </p>
          </div>
        </div>

        <span className="text-xs text-zinc-600">
          Question generators below use this research.
        </span>
      </div>

      {quickBrief.length > 0 && (
        <div className="space-y-2 px-4 py-3">
          {quickBrief.map(
            (item, index) => (
              <p
                key={`${item.text}-${index}`}
                className="text-xs leading-5 text-zinc-400"
              >
                <span className="mr-2 text-indigo-300">
                  •
                </span>

                {item.text}

                <InterviewResearchSourceLinks
                  report={report}
                  sourceIds={item.sourceIds}
                />
              </p>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function InterviewPrepModal({
  job,
  profile,
  form,
  checklist,
  selectedCv,
  selectedCoverLetter,
  hasApplication,
  onChange,
  onToggleChecklist,
  onSubmit,
  onClose,
  onOpenDocument,
  onOpenApplication,
}) {
  const completedTasks =
    Object.values(
      checklist,
    ).filter(Boolean).length

  const [
    smartMessage,
    setSmartMessage,
  ] = useState("")

  const likelyQuestions =
    splitTextLines(
      form.interviewLikelyQuestions,
    )

  const companyResearch =
    job.companyResearch ||
    null

  const researchQuestions =
    buildCompanyResearchQuestions({
      report:
        companyResearch,
      job,
    })

  const researchLikelyQuestions =
    buildCompanyResearchLikelyInterviewQuestions({
      report:
        companyResearch,
      job,
    })

  function generateQuestionsToAsk() {
    const generated =
      uniqueTextValues([
        ...researchQuestions.map(
          (question) =>
            question.text,
        ),

        ...buildQuestionsToAsk(
          job,
        ),
      ]).slice(
        0,
        9,
      )

    onChange(
      "interviewQuestionsToAsk",

      mergeTextLines(
        form.interviewQuestionsToAsk,
        generated,
      ),
    )

    setSmartMessage(
      companyResearch
        ? `${generated.length} questions were suggested using the vacancy and saved company research.`
        : `${generated.length} questions were suggested from the vacancy. Add company research for more employer-specific prompts.`,
    )
  }

  function generateLikelyQuestions() {
    const generated =
      uniqueTextValues([
        ...researchLikelyQuestions.map(
          (question) =>
            question.text,
        ),

        ...buildLikelyInterviewQuestions(
          job,
        ),
      ]).slice(
        0,
        10,
      )

    onChange(
      "interviewLikelyQuestions",

      mergeTextLines(
        form.interviewLikelyQuestions,
        generated,
      ),
    )

    setSmartMessage(
      companyResearch
        ? `${generated.length} likely questions were suggested using the role, vacancy and company research.`
        : `${generated.length} likely interview questions were suggested from the vacancy.`,
    )
  }

  function generateExamplePrompts() {
    const generated =
      buildInterviewExamplePrompts(
        job,
        profile,
      )

    onChange(
      "interviewExamplePrompts",

      mergeTextLines(
        form.interviewExamplePrompts,
        generated,
      ),
    )

    setSmartMessage(
      `${generated.length} interview-example prompts were suggested from the vacancy and Candidate Profile.`,
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[min(94vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 bg-[#151515] px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-lg font-semibold sm:text-xl">
                Interview preparation
              </h2>

              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                {completedTasks}/
                {interviewChecklistItems.length} tasks complete
              </span>
            </div>

            <p className="mt-2 truncate text-sm text-zinc-500">
              {job.role} at{" "}
              {job.company}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close interview preparation"
            title="Close interview preparation"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="jp-scroll-surface min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {smartMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
              <Sparkles
                size={16}
                className="mt-0.5 shrink-0"
              />

              <p>
                {smartMessage}
              </p>
            </div>
          )}

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:gap-6">
              <div className="space-y-6">
              <ModalSection
                title="Interview details"
                description="Record when, where and how the interview will take place."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Date">
                    <input
                      type="date"
                      value={
                        form.interviewDate
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewDate",
                          event.target.value,
                        )
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Time">
                    <input
                      type="time"
                      value={
                        form.interviewTime
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewTime",
                          event.target.value,
                        )
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Format">
                    <select
                      value={
                        form.interviewFormat
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewFormat",
                          event.target.value,
                        )
                      }
                      className={inputClass}
                    >
                      {interviewFormats.map(
                        (format) => (
                          <option
                            key={format}
                            value={format}
                          >
                            {format}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field label="Location">
                    <input
                      value={
                        form.interviewLocation
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewLocation",
                          event.target.value,
                        )
                      }
                      placeholder="Office address or Online"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Meeting link">
                    <input
                      value={
                        form.interviewLink
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewLink",
                          event.target.value,
                        )
                      }
                      placeholder="Teams, Zoom or Meet link"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Interviewers or attendees">
                    <input
                      value={
                        form.interviewAttendees
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewAttendees",
                          event.target.value,
                        )
                      }
                      placeholder="Names or job titles"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </ModalSection>

              <ModalSection
                title="Your preparation"
                description="Keep your notes, example ideas and questions together."
              >
                <Field label="Preparation notes">
                  <textarea
                    rows="6"
                    value={
                      form.interviewNotes
                    }
                    onChange={(event) =>
                      onChange(
                        "interviewNotes",
                        event.target.value,
                      )
                    }
                    placeholder="Company research, reminders and points you want to mention..."
                    className={textareaClass}
                  />
                </Field>

                <CompanyResearchInterviewContext
                  job={
                    job
                  }
                />

                <div className="mt-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-300">
                        Interview examples
                      </span>

                      <span
                        title="BreakVeil suggests situations from your experience that could become Situation, Task, Action and Result answers."
                        className="inline-flex"
                      >
                        <HelpCircle
                          size={14}
                          className="cursor-help text-zinc-600"
                        />
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        generateExamplePrompts
                      }
                      className={smartGenerateButtonClass}
                    >
                      <Sparkles size={14} />
                      Suggest examples
                    </button>
                  </div>

                  <textarea
                    rows="6"
                    value={
                      form.interviewExamplePrompts
                    }
                    onChange={(event) =>
                      onChange(
                        "interviewExamplePrompts",
                        event.target.value,
                      )
                    }
                    placeholder="Add situations from your experience that you could discuss..."
                    className={textareaClass}
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    These are prompts only. Replace them with your own truthful experiences before the interview.
                  </p>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-300">
                      Questions to ask
                    </span>

                    <button
                      type="button"
                      onClick={
                        generateQuestionsToAsk
                      }
                      className={smartGenerateButtonClass}
                    >
                      <Sparkles size={14} />
                      Generate suggestions
                    </button>
                  </div>

                  <textarea
                    rows="7"
                    value={
                      form.interviewQuestionsToAsk
                    }
                    onChange={(event) =>
                      onChange(
                        "interviewQuestionsToAsk",
                        event.target.value,
                      )
                    }
                    placeholder={"What would success look like in the first three months?\nHow is performance measured?\nWhat are the next steps?"}
                    className={textareaClass}
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    Suggestions use the vacancy and, when available, the saved company research. Existing questions are preserved.
                  </p>
                </div>
              </ModalSection>

              <details className="rounded-xl border border-zinc-800 bg-zinc-900/30">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-medium text-zinc-300">
                  <Clock3
                    size={16}
                    className="text-violet-300"
                  />
                  Likely interview questions
                </summary>

                <div className="border-t border-zinc-800 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-zinc-600">
                      Generate role-specific questions from the vacancy and saved company research, or use the general starting list.
                    </p>

                    <button
                      type="button"
                      onClick={
                        generateLikelyQuestions
                      }
                      className={smartGenerateButtonClass}
                    >
                      <Sparkles size={14} />
                      Generate for this job
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(likelyQuestions.length > 0
                      ? likelyQuestions
                      : commonInterviewQuestions
                    ).map(
                      (
                        question,
                        index,
                      ) => (
                        <div
                          key={`${question}-${index}`}
                          className="flex items-start gap-3 text-sm text-zinc-400"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[11px] text-zinc-500">
                            {index + 1}
                          </span>

                          <p className="pt-0.5">
                            {question}
                          </p>
                        </div>
                      ),
                    )}
                  </div>

                  {likelyQuestions.length > 0 && (
                    <textarea
                      rows="7"
                      value={
                        form.interviewLikelyQuestions
                      }
                      onChange={(event) =>
                        onChange(
                          "interviewLikelyQuestions",
                          event.target.value,
                        )
                      }
                      className={`${textareaClass} mt-5`}
                    />
                  )}
                </div>
              </details>
            </div>

              <aside className="grid h-fit gap-4 lg:grid-cols-2 2xl:sticky 2xl:top-4 2xl:block 2xl:space-y-4">
              <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-200">
                      Preparation checklist
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {completedTasks} of{" "}
                      {interviewChecklistItems.length} complete
                    </p>
                  </div>

                  <CalendarCheck2
                    size={19}
                    className="text-emerald-300"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {interviewChecklistItems.map(
                    (item) => (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3 transition hover:border-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={
                            checklist[
                              item.id
                            ]
                          }
                          onChange={() =>
                            onToggleChecklist(
                              item.id,
                            )
                          }
                          className="mt-0.5 h-4 w-4 accent-emerald-500"
                        />

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={[
                                "text-sm leading-5",

                                checklist[
                                  item.id
                                ]
                                  ? "text-zinc-500 line-through"
                                  : "text-zinc-300",
                              ].join(" ")}
                            >
                              {item.label}
                            </span>

                            {item.help && (
                              <span className="group relative inline-flex shrink-0">
                                <HelpCircle
                                  size={14}
                                  className="cursor-help text-zinc-600 transition group-hover:text-zinc-300"
                                  aria-label={`Help for ${item.label}`}
                                />

                                <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-xs font-normal leading-5 text-zinc-300 shadow-xl group-hover:block">
                                  {item.help}
                                </span>
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Quick reference
                </p>

                <div className="mt-3 space-y-2">
                  {job.jobUrl && (
                    <a
                      href={job.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={interviewReferenceClass}
                    >
                      <ExternalLink size={15} />
                      Open job advert
                    </a>
                  )}

                  {selectedCv && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocument(
                          selectedCv.id,
                        )
                      }
                      className={interviewReferenceClass}
                    >
                      <FileText size={15} />
                      Open selected CV
                    </button>
                  )}

                  {selectedCoverLetter && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocument(
                          selectedCoverLetter.id,
                        )
                      }
                      className={interviewReferenceClass}
                    >
                      <FileCheck2 size={15} />
                      Open cover letter
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onOpenApplication}
                    className={interviewReferenceClass}
                  >
                    <ClipboardCheck size={15} />
                    {hasApplication
                      ? "Review application"
                      : "Prepare application"}
                  </button>

                  <p className="px-1 text-xs leading-5 text-zinc-600">
                    Opens above this panel. Your unsaved interview edits remain here until you return.
                  </p>

                  {form.interviewLink && (
                    <a
                      href={normaliseUrl(
                        form.interviewLink,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-200 transition hover:bg-sky-500/20"
                    >
                      <Link2 size={15} />
                      Open meeting link
                    </a>
                  )}
                </div>
              </section>
            </aside>
          </div>

          </div>

          <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-zinc-800 bg-[#151515] px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Save size={15} />
              Save interview
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function ApplicationReviewModal({
  job,
  profile,
  applicationPackage,
  returnToInterview,
  form,
  readiness,
  documentsLoading,
  cvs,
  coverLetters,
  gmailStatus,
  checkingGmail,
  message,
  saving,
  creatingGmailDraft,
  savingTailoredDocument,
  draftCount,
  onChange,
  onSaveTailoredCoverLetter,
  onClose,
  onSaveDraft,
  onSaveChanges,
  onSendToReview,
  onApprove,
  onReopenReview,
  onReturnToApproved,
  onCreateGmailDraft,
  onOpenGmailDrafts,
  onCopyEmail,
  onMarkSent,
  onOpenResumeLibrary,
  onOpenAutomation,
}) {
  const status =
    applicationPackage
      ?.status ||
    "Draft"

  const [
    tailoringMessage,
    setTailoringMessage,
  ] = useState("")

  const [
    tailoringVariation,
    setTailoringVariation,
  ] = useState({
    coverLetter: -1,
    cvProfile: -1,
    keywords: -1,
  })

  const [
    activeTailoringStyle,
    setActiveTailoringStyle,
  ] = useState("")

  const [
    tailoringConfirmation,
    setTailoringConfirmation,
  ] = useState(null)

  const selectedTailoredDocument =
    coverLetters.find(
      (document) =>
        document.id ===
        form.coverLetterId &&
        [
          "JobPilot",
          "BreakVeil",
        ].includes(
          document.generatedBy,
        ) &&
        document.generatedKind ===
          "cover-letter",
    ) || null

  const preferredDocumentFormat =
    getCoverLetterFormatPreference()

  async function saveTailoredAttachment() {
    const result =
      await onSaveTailoredCoverLetter()

    if (result) {
      setTailoringMessage(
        result.replaced
          ? "The generated cover-letter attachment was updated and remains selected for this application."
          : "The generated cover-letter attachment was saved to Resume Library and selected for this application.",
      )
    }
  }

  function getTailoringConfirmationCopy(
    kind,
  ) {
    const copy = {
      coverLetter: {
        title:
          "Generate a new cover-letter version?",

        description:
          "The tailored cover-letter field already contains text. Generating another version will replace the text currently shown in that field.",
      },

      cvProfile: {
        title:
          "Generate a new CV profile?",

        description:
          "The suggested CV profile already contains text. Generating another version will replace the text currently shown in that field.",
      },

      keywords: {
        title:
          "Re-order the vacancy keywords?",

        description:
          "The vacancy keyword field already contains terms. Re-ordering them will replace the current list with another relevance pattern.",
      },

      all: {
        title:
          "Generate a new tailoring set?",

        description:
          "One or more tailored fields already contain text. Continuing will replace the cover letter, CV profile and vacancy keywords with a new variation set.",
      },
    }

    return (
      copy[kind] ||
      copy.all
    )
  }

  function requestTailoringConfirmation(
    kind,
  ) {
    setTailoringConfirmation({
      kind,

      ...getTailoringConfirmationCopy(
        kind,
      ),
    })
  }

  function closeTailoringConfirmation() {
    setTailoringConfirmation(
      null,
    )
  }

  function canReplaceTailoredValue(
    currentValue,
  ) {
    return !String(
      currentValue || "",
    ).trim()
  }

  function performGenerateCoverLetter() {
    const next =
      findNextTailoringVariation({
        currentText:
          form.tailoredCoverLetter,

        startVariation:
          tailoringVariation
            .coverLetter,

        builder:
          (variation) =>
            buildTailoredCoverLetter(
              job,
              profile,
              variation,
            ),
      })

    onChange(
      "tailoredCoverLetter",
      next.text,
    )

    setTailoringVariation(
      (current) => ({
        ...current,

        coverLetter:
          next.variation,
      }),
    )

    const styleLabel =
      getTailoringVariationLabel(
        next.variation,
      )

    setActiveTailoringStyle(
      styleLabel,
    )

    setTailoringMessage(
      job.companyResearch
        ? `Generated a ${styleLabel.toLowerCase()} cover-letter variation using the vacancy, Candidate Profile and saved company research.`
        : `Generated a ${styleLabel.toLowerCase()} cover-letter variation. Each click rotates to a different structure while keeping the saved job facts consistent.`,
    )
  }

  function generateCoverLetter() {
    if (
      !canReplaceTailoredValue(
        form.tailoredCoverLetter,
      )
    ) {
      requestTailoringConfirmation(
        "coverLetter",
      )

      return
    }

    performGenerateCoverLetter()
  }

  function performGenerateCvProfile() {
    const next =
      findNextTailoringVariation({
        currentText:
          form.tailoredCvSummary,

        startVariation:
          tailoringVariation
            .cvProfile,

        builder:
          (variation) =>
            buildTailoredCvProfile(
              job,
              profile,
              variation,
            ),
      })

    onChange(
      "tailoredCvSummary",
      next.text,
    )

    setTailoringVariation(
      (current) => ({
        ...current,

        cvProfile:
          next.variation,
      }),
    )

    const styleLabel =
      getTailoringVariationLabel(
        next.variation,
      )

    setActiveTailoringStyle(
      styleLabel,
    )

    setTailoringMessage(
      `Generated a ${styleLabel.toLowerCase()} CV-profile variation.`,
    )
  }

  function generateCvProfile() {
    if (
      !canReplaceTailoredValue(
        form.tailoredCvSummary,
      )
    ) {
      requestTailoringConfirmation(
        "cvProfile",
      )

      return
    }

    performGenerateCvProfile()
  }

  function performGenerateKeywords() {
    const next =
      findNextTailoringVariation({
        currentText:
          form.tailoringKeywords,

        startVariation:
          tailoringVariation
            .keywords,

        builder:
          (variation) =>
            extractVacancyKeywords(
              job,
              variation,
            ),
      })

    onChange(
      "tailoringKeywords",
      next.text,
    )

    setTailoringVariation(
      (current) => ({
        ...current,

        keywords:
          next.variation,
      }),
    )

    setActiveTailoringStyle(
      getTailoringVariationLabel(
        next.variation,
      ),
    )

    setTailoringMessage(
      next.text
        ? "Vacancy keywords were re-ordered using another relevance pattern. The terms remain grounded in the same saved vacancy."
        : "Add a fuller vacancy description before extracting keywords.",
    )
  }

  function generateKeywords() {
    if (
      !canReplaceTailoredValue(
        form.tailoringKeywords,
      )
    ) {
      requestTailoringConfirmation(
        "keywords",
      )

      return
    }

    performGenerateKeywords()
  }

  function performGenerateAllTailoredContent() {
    const currentHighestVariation =
      Math.max(
        tailoringVariation
          .coverLetter,
        tailoringVariation
          .cvProfile,
        tailoringVariation
          .keywords,
      )

    const nextVariation =
      (
        currentHighestVariation +
        1 +
        tailoringVariationLabels.length
      ) %
        tailoringVariationLabels.length

    onChange(
      "tailoredCoverLetter",
      buildTailoredCoverLetter(
        job,
        profile,
        nextVariation,
      ),
    )

    onChange(
      "tailoredCvSummary",
      buildTailoredCvProfile(
        job,
        profile,
        nextVariation,
      ),
    )

    onChange(
      "tailoringKeywords",
      extractVacancyKeywords(
        job,
        nextVariation,
      ),
    )

    setTailoringVariation({
      coverLetter:
        nextVariation,

      cvProfile:
        nextVariation,

      keywords:
        nextVariation,
    })

    const styleLabel =
      getTailoringVariationLabel(
        nextVariation,
      )

    setActiveTailoringStyle(
      styleLabel,
    )

    setTailoringMessage(
      job.companyResearch
        ? `Generated a complete ${styleLabel.toLowerCase()} variation set. The cover letter also used the saved company research.`
        : `Generated a complete ${styleLabel.toLowerCase()} variation set. Generate again to rotate to the next writing approach.`,
    )
  }

  function generateAllTailoredContent() {
    const hasExistingContent =
      [
        form.tailoredCoverLetter,
        form.tailoredCvSummary,
        form.tailoringKeywords,
      ].some(
        (value) =>
          String(
            value || "",
          ).trim(),
      )

    if (
      hasExistingContent
    ) {
      requestTailoringConfirmation(
        "all",
      )

      return
    }

    performGenerateAllTailoredContent()
  }

  function confirmTailoringRegeneration() {
    const kind =
      tailoringConfirmation
        ?.kind

    closeTailoringConfirmation()

    if (
      kind ===
      "coverLetter"
    ) {
      performGenerateCoverLetter()

      return
    }

    if (
      kind ===
      "cvProfile"
    ) {
      performGenerateCvProfile()

      return
    }

    if (
      kind ===
      "keywords"
    ) {
      performGenerateKeywords()

      return
    }

    performGenerateAllTailoredContent()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={
        onClose
      }
    >
      <div
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-zinc-800 bg-[#151515] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold sm:text-xl">
                Application review
              </h2>

              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs font-medium",

                  packageStatusClass(
                    status,
                  ),
                ].join(" ")}
              >
                {status}
              </span>

              <ReadinessBadge
                readiness={
                  readiness
                }
              />
            </div>

            <p className="mt-2 truncate text-sm text-zinc-500">
              {job.role} at{" "}
              {job.company}
            </p>

            {returnToInterview && (
              <p className="mt-2 flex items-center gap-2 text-xs text-violet-300/80">
                <ArrowLeft size={13} />
                Interview preparation remains open behind this review.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label={
              returnToInterview
                ? "Return to interview preparation"
                : "Close application review"
            }
            title={
              returnToInterview
                ? "Return to interview preparation"
                : "Close application review"
            }
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {message && (
            <div className="mb-5 rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 text-sm text-zinc-200">
              {message}
            </div>
          )}

          <div className="mb-5 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/35 px-4 py-3">
            <Save
              size={15}
              className="mt-0.5 shrink-0 text-zinc-500"
            />

            <p className="text-xs leading-5 text-zinc-600">
              Changes made in this window are stored when you select {status === "Draft" ? "Save draft" : "Save changes"} or move the application to another stage.
            </p>
          </div>

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_290px] 2xl:gap-6">
            <div className="space-y-6">
              <ModalSection
                title="Documents"
                description="Choose the files attached to this application."
              >
                {documentsLoading ? (
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                    Loading Resume Library
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="CV" required>
                      <select
                        value={
                          form.cvId
                        }
                        onChange={(event) =>
                          onChange(
                            "cvId",
                            event.target.value,
                          )
                        }
                        className={
                          inputClass
                        }
                      >
                        <option value="">
                          Choose a CV
                        </option>

                        {cvs.map(
                          (document) => (
                            <option
                              key={
                                document.id
                              }
                              value={
                                document.id
                              }
                            >
                              {document.title}
                              {document.isDefault
                                ? " (Default)"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>

                    <Field label="Cover letter">
                      <select
                        value={
                          form.coverLetterId
                        }
                        onChange={(event) =>
                          onChange(
                            "coverLetterId",
                            event.target.value,
                          )
                        }
                        className={
                          inputClass
                        }
                      >
                        <option value="">
                          No cover letter
                        </option>

                        {coverLetters.map(
                          (document) => (
                            <option
                              key={
                                document.id
                              }
                              value={
                                document.id
                              }
                            >
                              {document.title}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                  </div>
                )}

                <button
                  type="button"
                  onClick={
                    onOpenResumeLibrary
                  }
                  className="mt-3 text-xs font-medium text-sky-300 transition hover:text-sky-200"
                >
                  Open Resume Library
                </button>
              </ModalSection>

              <ModalSection
                title="Recipient and email"
                description="Review the message that will accompany your documents."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Contact name">
                    <input
                      value={
                        form.recipientName
                      }
                      onChange={(event) =>
                        onChange(
                          "recipientName",
                          event.target.value,
                        )
                      }
                      placeholder="Hiring Manager"
                      className={
                        inputClass
                      }
                    />
                  </Field>

                  <Field
                    label="Recipient email"
                    required
                  >
                    <input
                      type="email"
                      value={
                        form.recipientEmail
                      }
                      onChange={(event) =>
                        onChange(
                          "recipientEmail",
                          event.target.value,
                        )
                      }
                      placeholder="recruitment@example.com"
                      className={
                        inputClass
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Email subject" required>
                    <input
                      value={
                        form.emailSubject
                      }
                      onChange={(event) =>
                        onChange(
                          "emailSubject",
                          event.target.value,
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Email message" required>
                    <textarea
                      rows="9"
                      value={
                        form.emailBody
                      }
                      onChange={(event) =>
                        onChange(
                          "emailBody",
                          event.target.value,
                        )
                      }
                      className={
                        textareaClass
                      }
                    />
                  </Field>
                </div>
              </ModalSection>

              <details className="rounded-xl border border-violet-500/20 bg-violet-500/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <Sparkles
                      size={17}
                      className="shrink-0 text-violet-300"
                    />

                    <span>
                      <span className="block text-sm font-medium text-zinc-200">
                        Smart tailored content
                      </span>

                      <span className="mt-1 block text-xs font-normal text-zinc-600">
                        Create and edit a cover letter, CV profile and vacancy keywords for this application.
                      </span>
                    </span>
                  </span>
                </summary>

                <div className="border-t border-violet-500/15 p-5">
                  <div className="flex flex-col justify-between gap-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-medium text-violet-100">
                        Generate the full tailoring pack
                      </p>

                      <p className="mt-1 max-w-2xl text-xs leading-5 text-violet-200/60">
                        BreakVeil uses the saved title, description, skill matches and Candidate Profile. Generated text stays editable and should be reviewed before sending.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        generateAllTailoredContent
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                    >
                      <Sparkles size={15} />
                      {form.tailoredCoverLetter ||
                      form.tailoredCvSummary ||
                      form.tailoringKeywords
                        ? "Generate another set"
                        : "Generate all"}
                    </button>
                  </div>

                  {tailoringMessage && (
                    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          size={16}
                          className="mt-0.5 shrink-0"
                        />

                        <p className="leading-6">
                          {tailoringMessage}
                        </p>
                      </div>

                      {activeTailoringStyle && (
                        <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                          {activeTailoringStyle}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-5 space-y-5">
                    <div>
                      <div className="mb-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-zinc-300">
                              Tailored cover-letter text
                            </p>

                            {selectedTailoredDocument && (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                                Attachment selected
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs leading-5 text-zinc-600">
                            Generate and edit the wording, then save it as the selected {preferredDocumentFormat === "pdf" ? "PDF" : "Word"} attachment.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              savingTailoredDocument ||
                              String(
                                form.tailoredCoverLetter ||
                                "",
                              ).trim().length <
                                20
                            }
                            onClick={
                              saveTailoredAttachment
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {savingTailoredDocument ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <FileCheck2 size={14} />
                            )}

                            {savingTailoredDocument
                              ? "Saving attachment"
                              : selectedTailoredDocument
                                ? "Update attachment"
                                : "Save & select attachment"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              generateCoverLetter
                            }
                            className={smartGenerateButtonClass}
                          >
                            <Sparkles size={14} />
                            {form.tailoredCoverLetter
                              ? "Generate another"
                              : "Generate letter"}
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows="10"
                        value={
                          form.tailoredCoverLetter
                        }
                        onChange={(event) =>
                          onChange(
                            "tailoredCoverLetter",
                            event.target.value,
                          )
                        }
                        placeholder="Select Generate letter or Generate all to create a tailored draft..."
                        className={
                          textareaClass
                        }
                      />

                      <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-zinc-600">
                        <ShieldCheck
                          size={14}
                          className="mt-0.5 shrink-0"
                        />

                        <p>
                          When this application moves to review, BreakVeil automatically creates or updates the generated attachment when no separate uploaded cover letter has been selected.
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-300">
                            Suggested CV profile
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            A shorter vacancy-focused summary for the top of a tailored CV.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={
                            generateCvProfile
                          }
                          className={smartGenerateButtonClass}
                        >
                          <Sparkles size={14} />
                          {form.tailoredCvSummary
                            ? "Generate another"
                            : "Generate profile"}
                        </button>
                      </div>

                      <textarea
                        rows="5"
                        value={
                          form.tailoredCvSummary
                        }
                        onChange={(event) =>
                          onChange(
                            "tailoredCvSummary",
                            event.target.value,
                          )
                        }
                        placeholder="Select Generate profile or Generate all..."
                        className={
                          textareaClass
                        }
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-300">
                            Vacancy keywords
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            Useful terms to reflect naturally in your CV and cover letter.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={
                            generateKeywords
                          }
                          className={smartGenerateButtonClass}
                        >
                          <Sparkles size={14} />
                          {form.tailoringKeywords
                            ? "Re-order keywords"
                            : "Extract keywords"}
                        </button>
                      </div>

                      <textarea
                        rows="3"
                        value={
                          form.tailoringKeywords
                        }
                        onChange={(event) =>
                          onChange(
                            "tailoringKeywords",
                            event.target.value,
                          )
                        }
                        placeholder="Select Extract keywords or Generate all..."
                        className={
                          textareaClass
                        }
                      />
                    </div>

                    <Field label="Internal notes">
                      <textarea
                        rows="3"
                        value={
                          form.notes
                        }
                        onChange={(event) =>
                          onChange(
                            "notes",
                            event.target.value,
                          )
                        }
                        placeholder="Private reminders about this application..."
                        className={
                          textareaClass
                        }
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </div>

            <aside className="h-fit space-y-4 xl:sticky xl:top-24">
              <ReadinessPanel
                readiness={
                  readiness
                }
              />

              {status !== "Draft" && status !== "Sent" && (
                <ApplicationReviewChecklist
                  readiness={readiness}
                  onToggle={(reviewId, checked) =>
                    onChange(
                      "reviewAcknowledgements",
                      {
                        ...readiness.acknowledgements,
                        [reviewId]: checked,
                      },
                    )
                  }
                />
              )}

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Delivery
                </p>

                {checkingGmail ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                    Checking Gmail
                  </p>
                ) : gmailStatus.connected ? (
                  <div className="mt-3">
                    <p className="flex items-center gap-2 text-sm text-emerald-300">
                      <CheckCircle2 size={15} />
                      Gmail connected
                    </p>

                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {gmailStatus.email}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="flex items-center gap-2 text-sm text-amber-300">
                      <AlertTriangle size={15} />
                      Gmail not connected
                    </p>

                    <button
                      type="button"
                      onClick={
                        onOpenAutomation
                      }
                      className="mt-3 text-xs font-medium text-amber-200 underline"
                    >
                      Open Automation
                    </button>
                  </div>
                )}

                {draftCount > 0 && (
                  <p className="mt-3 text-xs text-emerald-300">
                    {draftCount} Gmail draft
                    {draftCount === 1
                      ? ""
                      : "s"}{" "}
                    created
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-zinc-800 bg-[#151515] px-4 py-3 sm:px-6 sm:py-4 xl:flex-row xl:items-center xl:justify-between">
          <ApplicationStatusActions
            status={
              status
            }
            readiness={
              readiness
            }
            gmailConnected={
              gmailStatus.connected
            }
            saving={
              saving
            }
            creatingGmailDraft={
              creatingGmailDraft
            }
            onSaveDraft={
              onSaveDraft
            }
            onSendToReview={
              onSendToReview
            }
            onApprove={
              onApprove
            }
            onReopenReview={
              onReopenReview
            }
            onReturnToApproved={
              onReturnToApproved
            }
            onCreateGmailDraft={
              onCreateGmailDraft
            }
            onOpenGmailDrafts={
              onOpenGmailDrafts
            }
            onCopyEmail={
              onCopyEmail
            }
            onMarkSent={
              onMarkSent
            }
          />

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={
                onClose
              }
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              {returnToInterview
                ? "Back to interview"
                : "Close"}
            </button>

            <button
              type="button"
              disabled={
                saving ||
                documentsLoading
              }
              onClick={
                onSaveChanges
              }
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              <Save size={15} />
              {status === "Draft"
                ? "Save draft"
                : "Save changes"}
            </button>
          </div>
        </footer>
      </div>

      {tailoringConfirmation && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(event) => {
            event.stopPropagation()
            closeTailoringConfirmation()
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tailoring-confirmation-title"
            aria-describedby="tailoring-confirmation-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-violet-500/25 bg-[#181818] shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start gap-4 border-b border-zinc-800 px-5 py-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                <Sparkles size={19} />
              </div>

              <div className="min-w-0">
                <h3
                  id="tailoring-confirmation-title"
                  className="text-base font-semibold text-zinc-100"
                >
                  {tailoringConfirmation.title}
                </h3>

                <p
                  id="tailoring-confirmation-description"
                  className="mt-2 text-sm leading-6 text-zinc-500"
                >
                  {tailoringConfirmation.description}
                </p>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-300"
                />

                <p className="text-xs leading-5 text-amber-200/75">
                  Your current edits in the affected field will be replaced. The application package itself is not updated until you select Save draft.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeTailoringConfirmation
                }
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              >
                Keep current version
              </button>

              <button
                type="button"
                autoFocus
                onClick={
                  confirmTailoringRegeneration
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                <Sparkles size={15} />
                Generate new version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ApplicationStatusActions({
  status,
  readiness,
  gmailConnected,
  saving,
  creatingGmailDraft,
  onSaveDraft,
  onSendToReview,
  onApprove,
  onReopenReview,
  onReturnToApproved,
  onCreateGmailDraft,
  onOpenGmailDrafts,
  onCopyEmail,
  onMarkSent,
}) {
  if (status === "Draft") {
    return (
      <button
        type="button"
        disabled={
          !readiness.readyForReview ||
          saving
        }
        onClick={
          onSendToReview
        }
        className={primaryStatusActionClass}
      >
        <ClipboardCheck size={15} />

        {readiness.readyForReview
          ? "Send to review"
          : "Complete readiness checks"}
      </button>
    )
  }

  if (
    status ===
    "Ready for Review"
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={
            onSaveDraft
          }
          className={secondaryStatusActionClass}
        >
          Return to Draft
        </button>

        <button
          type="button"
          disabled={
            !readiness.readyForApproval ||
            saving
          }
          onClick={
            onApprove
          }
          className={primaryStatusActionClass}
        >
          <ShieldCheck size={15} />
          {readiness.readyForApproval
            ? "Approve application"
            : "Complete human review"}
        </button>
      </div>
    )
  }

  if (
    status ===
    "Approved"
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            !gmailConnected ||
            !readiness.readyForApproval ||
            creatingGmailDraft
          }
          onClick={
            onCreateGmailDraft
          }
          className={primaryStatusActionClass}
        >
          {creatingGmailDraft ? (
            <LoaderCircle
              size={15}
              className="animate-spin"
            />
          ) : (
            <Mail size={15} />
          )}

          {creatingGmailDraft
            ? "Creating draft"
            : "Create Gmail draft"}
        </button>

        {gmailConnected && (
          <button
            type="button"
            onClick={
              onOpenGmailDrafts
            }
            className={
              secondaryStatusActionClass
            }
          >
            <ExternalLink size={15} />
            Open drafts
          </button>
        )}

        <button
          type="button"
          onClick={
            onCopyEmail
          }
          className={
            secondaryStatusActionClass
          }
        >
          <Copy size={15} />
          Copy email
        </button>

        <button
          type="button"
          onClick={
            onMarkSent
          }
          className="inline-flex items-center gap-2 rounded-lg border border-sky-500/20 px-3 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-500/10"
        >
          <Send size={15} />
          Mark sent
        </button>

        <button
          type="button"
          onClick={
            onReopenReview
          }
          className={
            secondaryStatusActionClass
          }
        >
          Return to review
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2 text-sm text-sky-300">
        <Send size={15} />
        Application sent
      </span>

      <button
        type="button"
        onClick={
          onCopyEmail
        }
        className={
          secondaryStatusActionClass
        }
      >
        <Copy size={15} />
        Copy email
      </button>

      <button
        type="button"
        onClick={
          onReturnToApproved
        }
        className={
          secondaryStatusActionClass
        }
      >
        <Undo2 size={14} />
        Return to approved
      </button>
    </div>
  )
}

function ReadinessPanel({
  readiness,
}) {
  return (
    <section
      className={[
        "rounded-xl border p-4",

        readiness.ready
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            Readiness
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {readiness.passedCount} of{" "}
            {readiness.totalCount} complete
          </p>
        </div>

        <ReadinessBadge
          readiness={
            readiness
          }
        />
      </div>

      <div className="mt-4 space-y-2">
        {readiness.checks.map(
          (check) => (
            <div
              key={check.id}
              className="flex items-start gap-2 text-xs"
            >
              {check.passed ? (
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-emerald-300"
                />
              ) : (
                <CircleAlert
                  size={14}
                  className="mt-0.5 shrink-0 text-amber-300"
                />
              )}

              <div>
                <p
                  className={
                    check.passed
                      ? "text-zinc-400"
                      : "text-zinc-300"
                  }
                >
                  {check.label}
                </p>

                {!check.passed && (
                  <p className="mt-0.5 leading-5 text-zinc-600">
                    {check.help}
                  </p>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

function ReadinessBadge({
  readiness,
}) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",

        readiness.ready
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/20 bg-amber-500/10 text-amber-300",
      ].join(" ")}
    >
      {readiness.ready ? (
        <CheckCircle2 size={13} />
      ) : (
        <CircleAlert size={13} />
      )}

      {readiness.ready
        ? "Ready"
        : `${readiness.totalCount - readiness.passedCount} incomplete`}
    </span>
  )
}

function DocumentRow({
  label,
  title,
  available,
  optional = false,
  onOpen,
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400">
          <FileCheck2 size={16} />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-zinc-600">
            {label}
          </p>

          <p
            className={[
              "mt-1 truncate text-sm",

              available
                ? "text-zinc-300"
                : "text-zinc-600",
            ].join(" ")}
          >
            {title}
          </p>
        </div>
      </div>

      {available ? (
        <button
          type="button"
          onClick={
            onOpen
          }
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Open
        </button>
      ) : (
        <span className="shrink-0 text-xs text-zinc-700">
          {optional
            ? "Optional"
            : "Missing"}
        </span>
      )}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-[#151515] p-5">
      <div className="flex items-center gap-3">
        <Icon
          size={18}
          className="text-zinc-500"
        />

        <h2 className="font-semibold text-zinc-200">
          {title}
        </h2>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </section>
  )
}

function ModalSection({
  title,
  description,
  children,
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
      <div>
        <h3 className="font-semibold text-zinc-200">
          {title}
        </h3>

        <p className="mt-1 text-sm text-zinc-600">
          {description}
        </p>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </section>
  )
}

function Detail({
  label,
  value,
}) {
  return (
    <div>
      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-sm text-zinc-300">
        {value}
      </p>
    </div>
  )
}

function NotesEditorModal({
  job,
  value,
  onChange,
  onSubmit,
  onClose,
}) {
  const characterCount =
    String(
      value || "",
    ).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
              <FileText size={18} />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold">
                Job notes
              </h2>

              <p className="mt-1 truncate text-sm text-zinc-500">
                {job.role} at{" "}
                {job.company}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={
            onSubmit
          }
        >
          <div className="p-5 sm:p-6">
            <p className="text-sm leading-6 text-zinc-500">
              Keep private reminders, useful contact details and application context with this job.
            </p>

            <textarea
              autoFocus
              rows="10"
              value={value}
              onChange={(event) =>
                onChange(
                  event.target.value,
                )
              }
              placeholder="Add private notes about this opportunity..."
              className="mt-4 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
            />

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-600">
              <span>
                Stored locally with this job.
              </span>

              <span>
                {characterCount} characters
              </span>
            </div>
          </div>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Save size={15} />
              Save notes
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function NextActionModal({
  job,
  form,
  onChange,
  onSubmit,
  onClose,
}) {
  const suggestions = [
    "Review job",
    "Tailor CV",
    "Prepare application",
    "Submit application",
    "Follow up",
    "Prepare for interview",
    "Wait for response",
  ]

  const hasAction =
    String(
      form.nextAction || "",
    ).trim() &&
    String(
      form.nextAction || "",
    ).trim().toLowerCase() !==
      "none"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
              <Target size={18} />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold">
                Next action
              </h2>

              <p className="mt-1 truncate text-sm text-zinc-500">
                {job.role} at{" "}
                {job.company}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={
            onSubmit
          }
        >
          <div className="space-y-5 p-5 sm:p-6">
            <Field label="What needs doing next?">
              <input
                autoFocus
                value={
                  form.nextAction ===
                    "None"
                    ? ""
                    : form.nextAction
                }
                onChange={(event) =>
                  onChange(
                    "nextAction",
                    event.target.value,
                  )
                }
                placeholder="For example: Follow up with the employer"
                className={
                  inputClass
                }
              />
            </Field>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                Quick choices
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map(
                  (suggestion) => (
                    <button
                      key={
                        suggestion
                      }
                      type="button"
                      onClick={() =>
                        onChange(
                          "nextAction",
                          suggestion,
                        )
                      }
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs transition",

                        form.nextAction ===
                          suggestion
                          ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                          : "border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                      ].join(" ")}
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>

            <Field label="Due date">
              <input
                type="date"
                disabled={
                  !hasAction
                }
                value={
                  hasAction
                    ? form.nextActionDate
                    : ""
                }
                onChange={(event) =>
                  onChange(
                    "nextActionDate",
                    event.target.value,
                  )
                }
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
              />
            </Field>

            <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <CalendarDays
                size={16}
                className="mt-0.5 shrink-0 text-zinc-500"
              />

              <p className="text-xs leading-5 text-zinc-600">
                The next action appears in My Jobs and can be marked complete from either page.
              </p>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/30 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => {
                onChange(
                  "nextAction",
                  "None",
                )

                onChange(
                  "nextActionDate",
                  "",
                )
              }}
              className="rounded-lg border border-red-500/20 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"
            >
              Clear action
            </button>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                <Save size={15} />
                Save action
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}

function EditJobModal({
  form,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={
        onClose
      }
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#151515]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              Edit job
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Update the vacancy, company, status and advert details.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={
            onSubmit
          }
          className="p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Job title">
              <input
                required
                value={form.role}
                onChange={(event) =>
                  onChange(
                    "role",
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            <Field label="Company">
              <input
                required
                value={form.company}
                onChange={(event) =>
                  onChange(
                    "company",
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            <Field label="Location">
              <input
                value={
                  form.location
                }
                onChange={(event) =>
                  onChange(
                    "location",
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            <Field label="Salary">
              <input
                value={
                  form.salary
                }
                onChange={(event) =>
                  onChange(
                    "salary",
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            <Field label="Status">
              <select
                value={
                  form.status
                }
                onChange={(event) =>
                  onChange(
                    "status",
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              >
                {jobStatuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Job advert link">
              <input
                value={
                  form.jobUrl
                }
                onChange={(event) =>
                  onChange(
                    "jobUrl",
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>
          </div>

          <footer className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={
                onClose
              }
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Save size={15} />
              Save changes
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && (
          <span className="ml-1 text-red-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  )
}

const smartGenerateButtonClass =
  "inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"

const interviewReferenceClass =
  "flex w-full items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"

const actionClass =
  "flex w-full items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"

const textareaClass =
  "w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"

const primaryStatusActionClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"

const secondaryStatusActionClass =
  "inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"

import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  getApplicationPreferences,
} from "../lib/uiPreferences"

import {
  emptyReviewAcknowledgements,
} from "../lib/applicationPreparation"

import CoverLetterExport, {
  getCoverLetterFormatPreference,
  saveGeneratedCoverLetterToLibrary,
} from "./CoverLetterExport";

import {
  ArrowRight,
  Briefcase,
  Check,
  Clipboard,
  FileText,
  ListChecks,
  LoaderCircle,
  Mail,
  MessageSquareText,
  RefreshCw,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";

const tailoringStorageKey = "jobpilot.application-tailoring";

const queueStorageKey = "jobpilot.application-queue";

const jobsStorageKey = "jobpilot.jobs";

const reviewQueueFocusKey = "jobpilot.review-queue-focus";

const tabs = [
  {
    id: "cover-letter",
    label: "Cover letter",
    icon: FileText,
  },
  {
    id: "email",
    label: "Application email",
    icon: Mail,
  },
  {
    id: "cv",
    label: "CV tailoring",
    icon: ListChecks,
  },
  {
    id: "answers",
    label: "Application answers",
    icon: MessageSquareText,
  },
  {
    id: "interview",
    label: "Interview prep",
    icon: UserRound,
  },
];

function clean(value) {
  return String(value || "").trim();
}

function readJson(storageKey, fallbackValue) {
  try {
    const storedValue = localStorage.getItem(storageKey);

    return storedValue ? JSON.parse(storedValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJson(storageKey, value) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function readStoredArray(storageKey) {
  const value = readJson(storageKey, []);

  return Array.isArray(value) ? value : [];
}

function normaliseComparisonValue(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normaliseComparisonUrl(value) {
  const rawValue = clean(value);

  if (!rawValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(
      rawValue.startsWith("http") ? rawValue : `https://${rawValue}`,
    );

    parsedUrl.hash = "";

    return parsedUrl.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return rawValue.replace(/\/$/, "").toLowerCase();
  }
}

function findSavedJob({ jobs, vacancy, workspaceId }) {
  const explicitId = clean(workspaceId);

  if (explicitId) {
    const exactJob = jobs.find((job) => job.id === explicitId);

    if (exactJob) {
      return exactJob;
    }
  }

  const vacancyUrl = normaliseComparisonUrl(vacancy.jobUrl);

  if (vacancyUrl) {
    const urlMatch = jobs.find(
      (job) => normaliseComparisonUrl(job.jobUrl) === vacancyUrl,
    );

    if (urlMatch) {
      return urlMatch;
    }
  }

  const role = normaliseComparisonValue(vacancy.role);

  const company = normaliseComparisonValue(vacancy.company);

  const location = normaliseComparisonValue(vacancy.location);

  return jobs.find((job) => {
    const roleMatches = normaliseComparisonValue(job.role) === role;

    const companyMatches = normaliseComparisonValue(job.company) === company;

    const jobLocation = normaliseComparisonValue(job.location);

    const locationMatches =
      !location || !jobLocation || jobLocation === location;

    return roleMatches && companyMatches && locationMatches;
  });
}

function splitValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clean(item)).filter(Boolean);
  }

  return clean(value)
    .split(/[\n,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => clean(value)).filter(Boolean))];
}

function sentence(value) {
  const text = clean(value);

  if (!text) {
    return "";
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function firstSentence(value) {
  const text = clean(value);

  if (!text) {
    return "";
  }

  const match = text.match(/^.*?[.!?](?:\s|$)/);

  return sentence(match?.[0] || text);
}

function lowerFirst(value) {
  const text = clean(value);

  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
}

function getCandidateName(profile) {
  return clean(profile.preferredName) || clean(profile.fullName) || "Your name";
}

function getRole(vacancy) {
  return clean(vacancy.role) || "this position";
}

function getCompany(vacancy) {
  return clean(vacancy.company) || "your organisation";
}

function getWorkspaceKey(vacancy, workspaceId) {
  const explicitId = clean(workspaceId);

  if (explicitId) {
    return explicitId;
  }

  return [
    clean(vacancy.jobUrl),
    clean(vacancy.liveSearchId),
    clean(vacancy.role),
    clean(vacancy.company),
    clean(vacancy.location),
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function getProfileEvidence(profile) {
  const summary = firstSentence(profile.professionalSummary);

  const currentRole = clean(profile.currentJobTitle);

  if (summary) {
    return summary;
  }

  if (currentRole) {
    return `I currently work as ${currentRole}, where I have developed reliable customer service, organisation and problem-solving skills.`;
  }

  return "I have developed practical experience in customer service, organisation, communication and handling responsibility.";
}

function getMatchedSkills(analysis, profile) {
  const matched = Array.isArray(analysis?.matchedSkills)
    ? analysis.matchedSkills
    : [];

  const profileSkills = splitValues(profile.skills);

  return uniqueValues([...matched, ...profileSkills]).slice(0, 6);
}

function getResponsibilityText(analysis) {
  const responsibilities = Array.isArray(analysis?.responsibilities)
    ? analysis.responsibilities
    : [];

  if (responsibilities.length === 0) {
    return "";
  }

  return firstSentence(responsibilities[0]);
}

function createCoverLetter({
  vacancy,
  analysis,
  profile,
}) {
  const role =
    getRole(
      vacancy,
    )

  const company =
    getCompany(
      vacancy,
    )

  const name =
    getCandidateName(
      profile,
    )

  const preferences =
    getApplicationPreferences()

  const matchedSkills =
    getMatchedSkills(
      analysis,
      profile,
    )

  const skillText =
    matchedSkills.length >
      0
      ? matchedSkills
          .slice(
            0,
            preferences.coverLetterLength ===
              "detailed"
              ? 6
              : 4,
          )
          .join(
            ", ",
          )
      : "communication, organisation, customer service and problem solving"

  const profileEvidence =
    getProfileEvidence(
      profile,
    )

  const motivation =
    firstSentence(
      profile.whyThisRole,
    ) ||
    `I am particularly interested in this opportunity because it would allow me to apply my existing strengths while continuing to develop within ${company}.`

  const responsibility =
    getResponsibilityText(
      analysis,
    )

  const responsibilityParagraph =
    responsibility
      ? `The vacancy's focus on ${lowerFirst(responsibility)} particularly interests me. I would approach these responsibilities with care, clear communication and a strong focus on completing work accurately.`
      : "I would bring a dependable and organised approach to the role, with a strong focus on accuracy, communication and providing a positive service."

  const availability = [
    clean(
      profile.noticePeriod,
    )
      ? `My notice period is ${clean(profile.noticePeriod)}.`
      : "",

    clean(
      profile.rightToWork,
    )
      ? `I have ${clean(profile.rightToWork)}.`
      : "",
  ]
    .filter(
      Boolean,
    )
    .join(
      " ",
    )

  const greeting =
    "Dear Hiring Manager,"

  const opening =
    `I am writing to apply for the ${role} position at ${company}. ${profileEvidence}`

  const skills =
    `My experience and profile align particularly well with the role's requirements in ${skillText}. I am comfortable balancing customer needs, administrative responsibilities and changing priorities while remaining organised and professional.`

  const closing =
    `Thank you for considering my application. I would welcome the opportunity to discuss how my experience and approach could contribute to ${company}.`

  let paragraphs = [
    greeting,
    opening,
    skills,
    responsibilityParagraph,
    motivation,
  ]

  if (
    preferences.coverLetterLength ===
    "concise"
  ) {
    paragraphs = [
      greeting,
      opening,
      `${skills} ${motivation}`,
    ]
  }

  if (
    preferences.coverLetterLength ===
    "detailed"
  ) {
    paragraphs.push(
      "I am confident learning new systems and processes, and I value working accurately, communicating progress clearly and supporting the wider team when priorities change.",
    )
  }

  if (availability) {
    paragraphs.push(
      availability,
    )
  }

  paragraphs.push(
    closing,
    "Kind regards,",
    name,
  )

  return paragraphs
    .filter(
      Boolean,
    )
    .join(
      "\\n\\n",
    )
}

function createEmailSubject({
  vacancy,
  profile,
}) {
  const preferences =
    getApplicationPreferences()

  const role =
    getRole(
      vacancy,
    )

  const company =
    getCompany(
      vacancy,
    )

  const name =
    getCandidateName(
      profile,
    )

  if (
    preferences.emailSubjectFormat ===
    "name-role"
  ) {
    return `${name} – Application for ${role}`
  }

  if (
    preferences.emailSubjectFormat ===
    "role-company"
  ) {
    return `${role} Application – ${company}`
  }

  return `Application for ${role} – ${name}`
}

function createEmailBody({ vacancy, analysis, profile }) {
  const role = getRole(vacancy);
  const company = getCompany(vacancy);
  const name = getCandidateName(profile);

  const matchedSkills = getMatchedSkills(analysis, profile).slice(0, 3);

  const skillLine =
    matchedSkills.length > 0
      ? `My experience in ${matchedSkills.join(", ")} appears well aligned with the position.`
      : "My experience and transferable skills appear well aligned with the position.";

  return `Dear Hiring Manager,

Please find attached my application for the ${role} position at ${company}. ${skillLine}

I would be pleased to discuss my application further and provide any additional information required.

Kind regards,

${name}${clean(profile.phone) ? `\n${clean(profile.phone)}` : ""}${clean(profile.email) ? `\n${clean(profile.email)}` : ""}`;
}

function createCvSummary({ vacancy, analysis, profile }) {
  const role = getRole(vacancy);

  const matchedSkills = getMatchedSkills(analysis, profile).slice(0, 5);

  const summary = firstSentence(profile.professionalSummary);

  const base =
    summary ||
    `Dependable and organised professional with experience in customer-facing and supervisory environments.`;

  const skills =
    matchedSkills.length > 0
      ? ` Key strengths relevant to the ${role} position include ${matchedSkills.join(", ")}.`
      : "";

  return `${base}${skills} Known for clear communication, reliability and handling responsibilities accurately in busy environments.`;
}

function createCvSuggestions({ vacancy, analysis, profile }) {
  const role = getRole(vacancy);

  const matchedSkills = getMatchedSkills(analysis, profile);

  const responsibilities = Array.isArray(analysis?.responsibilities)
    ? analysis.responsibilities
    : [];

  const suggestions = [
    `Place the most relevant experience for the ${role} position near the top of your employment history.`,
    matchedSkills.length > 0
      ? `Use genuine examples that demonstrate ${matchedSkills.slice(0, 4).join(", ")}.`
      : "Use genuine examples that demonstrate organisation, communication, reliability and problem solving.",
    "Add measurable detail where accurate, such as the number of staff supported, customers served, records maintained or tasks completed.",
    responsibilities[0]
      ? `Adapt an existing achievement to show experience related to: ${responsibilities[0]}`
      : "Adapt an existing achievement to reflect one of the vacancy's main responsibilities.",
    "Keep each employment bullet focused on an action, the responsibility involved and the positive result.",
  ];

  if (clean(profile.currentJobTitle)) {
    suggestions.push(
      `Make the transferable value of your current role as ${clean(profile.currentJobTitle)} clear without changing your official job title.`,
    );
  }

  return suggestions.map((item) => `• ${item}`).join("\n");
}

function createKeywordText({ vacancy, analysis }) {
  const skills = Array.isArray(analysis?.vacancySkills)
    ? analysis.vacancySkills
    : [];

  const requirements = Array.isArray(analysis?.requirements)
    ? analysis.requirements
    : [];

  const contractValues = [
    vacancy.contractType,
    vacancy.workType,
    vacancy.category,
  ];

  return uniqueValues([
    ...skills,
    ...contractValues,
    ...requirements.slice(0, 4).flatMap((value) =>
      clean(value)
        .split(/\s+/)
        .filter((word) => word.length >= 7)
        .slice(0, 2),
    ),
  ])
    .slice(0, 18)
    .join(", ");
}

function createWhyRoleAnswer({ vacancy, profile, analysis }) {
  const role = getRole(vacancy);
  const company = getCompany(vacancy);

  const motivation = firstSentence(profile.whyThisRole);

  const matchedSkills = getMatchedSkills(analysis, profile).slice(0, 3);

  return `${motivation || `I am interested in the ${role} position because it closely matches the type of work I want to continue developing in.`} The opportunity at ${company} would allow me to use my strengths in ${matchedSkills.length > 0 ? matchedSkills.join(", ") : "communication, organisation and customer service"} while contributing to a professional team. I am looking for a position where I can take responsibility, provide a reliable service and continue building my skills.`;
}

function createHireMeAnswer({ analysis, profile }) {
  const strengths = firstSentence(profile.strengths);

  const skills = getMatchedSkills(analysis, profile).slice(0, 4);

  return `${strengths || "I am dependable, organised and comfortable taking responsibility in busy environments."} I can bring ${skills.length > 0 ? skills.join(", ") : "clear communication, customer service, organisation and problem solving"} to the role. I am also used to balancing planned duties with unexpected tasks, communicating clearly with colleagues and maintaining a professional approach when dealing with customers or sensitive situations.`;
}

function createExperienceAnswer({ vacancy, profile }) {
  const currentRole = clean(profile.currentJobTitle);

  const summary = clean(profile.professionalSummary);

  return `${currentRole ? `In my current role as ${currentRole}, ` : "In my previous and current work, "}I have developed experience that transfers well to the ${getRole(vacancy)} position. ${summary || "This includes serving customers, handling records and payments, resolving problems, prioritising tasks and supporting colleagues during busy shifts."} These responsibilities have strengthened my ability to work accurately, communicate professionally and remain dependable when priorities change.`;
}

function createApplicationAnswers(values) {
  return [
    {
      id: "why-role",
      prompt: "Why do you want this role?",
      answer: createWhyRoleAnswer(values),
    },
    {
      id: "why-you",
      prompt: "Why should we hire you?",
      answer: createHireMeAnswer(values),
    },
    {
      id: "experience",
      prompt: "Tell us about your relevant experience.",
      answer: createExperienceAnswer(values),
    },
  ];
}

function createInterviewQuestions({ vacancy, analysis }) {
  const responsibilities = Array.isArray(analysis?.responsibilities)
    ? analysis.responsibilities
    : [];

  const requirements = Array.isArray(analysis?.requirements)
    ? analysis.requirements
    : [];

  const role = getRole(vacancy);

  return [
    {
      id: "interest",
      question: `What interested you in this ${role} position?`,
      guidance:
        "Explain why the day-to-day work interests you, connect it to your target roles and mention what attracts you to the company. Avoid focusing only on pay or leaving your current job.",
    },
    {
      id: "example",
      question: "Tell us about a time you managed several priorities at once.",
      guidance:
        "Use a real STAR example. Explain the situation, the tasks that competed for attention, how you prioritised them and the result.",
    },
    {
      id: "customer",
      question: "Describe a time you handled a difficult customer or problem.",
      guidance:
        "Choose a genuine example showing calm communication, listening, practical problem solving and an appropriate outcome.",
    },
    {
      id: "responsibility",
      question: responsibilities[0]
        ? `How would you approach this responsibility: ${responsibilities[0]}`
        : "How would you approach the main responsibilities of this position?",
      guidance:
        "Break the work into clear steps. Mention confirming priorities, keeping accurate records, communicating progress and checking the completed work.",
    },
    {
      id: "requirement",
      question: requirements[0]
        ? `What experience do you have that relates to this requirement: ${requirements[0]}`
        : "Which of your skills would be most useful in this role?",
      guidance:
        "Use evidence from work, private projects or other relevant experience. Be honest about any gaps and explain how you would learn.",
    },
    {
      id: "questions",
      question: "What questions would you ask the interviewer?",
      guidance:
        "Ask about the first three months, day-to-day priorities, training, how performance is measured and what a successful person in the role does particularly well.",
    },
  ];
}

function buildApplicationPack(values) {
  const now = new Date().toISOString();

  return {
    coverLetter: createCoverLetter(values),

    emailSubject: createEmailSubject(values),

    emailBody: createEmailBody(values),

    cvSummary: createCvSummary(values),

    cvSuggestions: createCvSuggestions(values),

    keywords: createKeywordText(values),

    applicationAnswers: createApplicationAnswers(values),

    interviewQuestions: createInterviewQuestions(values),

    generatedAt: now,
    updatedAt: now,
  };
}

async function copyToClipboard(value) {
  const text = String(value || "");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);

    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  document.execCommand("copy");
  textarea.remove();
}

export default function ApplicationToolkit({
  vacancy,
  analysis,
  candidateProfile,
  workspaceId = "",
  onMessage,
}) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("cover-letter");

  const [pack, setPack] = useState(null);

  const [copiedKey, setCopiedKey] = useState("");

  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const [isSendingToQueue, setIsSendingToQueue] = useState(false);

  const [
    generatedCoverLetterDocument,
    setGeneratedCoverLetterDocument,
  ] = useState(null);

  const [storageRevision, setStorageRevision] = useState(0);

  const workspaceKey = useMemo(
    () => getWorkspaceKey(vacancy, workspaceId),
    [
      vacancy.jobUrl,
      vacancy.liveSearchId,
      vacancy.role,
      vacancy.company,
      vacancy.location,
      workspaceId,
    ],
  );

  const generationValues = useMemo(
    () => ({
      vacancy,
      analysis,
      profile: candidateProfile || {},
    }),
    [vacancy, analysis, candidateProfile],
  );

  const savedJob = useMemo(
    () =>
      findSavedJob({
        jobs: readStoredArray(jobsStorageKey),

        vacancy,
        workspaceId,
      }),
    [
      vacancy.role,
      vacancy.company,
      vacancy.location,
      vacancy.jobUrl,
      workspaceId,
      storageRevision,
    ],
  );

  const existingPackage = useMemo(() => {
    if (!savedJob) {
      return null;
    }

    return (
      readStoredArray(queueStorageKey).find(
        (applicationPackage) => applicationPackage.jobId === savedJob.id,
      ) || null
    );
  }, [savedJob?.id, storageRevision]);

  useEffect(() => {
    function refreshStorageState() {
      setStorageRevision((current) => current + 1);
    }

    window.addEventListener("jobpilot:jobs-updated", refreshStorageState);

    window.addEventListener("jobpilot:queue-updated", refreshStorageState);

    return () => {
      window.removeEventListener("jobpilot:jobs-updated", refreshStorageState);

      window.removeEventListener("jobpilot:queue-updated", refreshStorageState);
    };
  }, []);

  useEffect(() => {
    const storedPacks = readJson(tailoringStorageKey, {});

    const savedPack = storedPacks?.[workspaceKey];

    setPack(savedPack || buildApplicationPack(generationValues));

    setConfirmRegenerate(false);
  }, [workspaceKey]);

  useEffect(() => {
    if (!pack || !workspaceKey) {
      return;
    }

    const storedPacks = readJson(tailoringStorageKey, {});

    writeJson(tailoringStorageKey, {
      ...storedPacks,

      [workspaceKey]: {
        ...pack,

        updatedAt: new Date().toISOString(),
      },
    });
  }, [pack, workspaceKey]);

  function updatePack(field, value) {
    setPack((currentPack) => ({
      ...currentPack,

      [field]: value,

      updatedAt: new Date().toISOString(),
    }));
  }

  function updateAnswer(answerId, value) {
    setPack((currentPack) => ({
      ...currentPack,

      applicationAnswers: currentPack.applicationAnswers.map((item) =>
        item.id === answerId
          ? {
              ...item,
              answer: value,
            }
          : item,
      ),

      updatedAt: new Date().toISOString(),
    }));
  }

  function updateInterviewGuidance(questionId, value) {
    setPack((currentPack) => ({
      ...currentPack,

      interviewQuestions: currentPack.interviewQuestions.map((item) =>
        item.id === questionId
          ? {
              ...item,
              guidance: value,
            }
          : item,
      ),

      updatedAt: new Date().toISOString(),
    }));
  }

  async function copyValue(value, key, label) {
    try {
      await copyToClipboard(value);

      setCopiedKey(key);

      if (onMessage) {
        onMessage(`${label} copied to the clipboard.`);
      }

      window.setTimeout(() => {
        setCopiedKey("");
      }, 1800);
    } catch {
      if (onMessage) {
        onMessage(`${label} could not be copied.`);
      }
    }
  }

  function getFullPackText() {
    const answers = pack.applicationAnswers
      .map((item) => `${item.prompt}\n${item.answer}`)
      .join("\n\n");

    const interview = pack.interviewQuestions
      .map((item) => `${item.question}\nPreparation: ${item.guidance}`)
      .join("\n\n");

    return `COVER LETTER

${pack.coverLetter}

APPLICATION EMAIL

Subject: ${pack.emailSubject}

${pack.emailBody}

CV SUMMARY

${pack.cvSummary}

CV TAILORING SUGGESTIONS

${pack.cvSuggestions}

VACANCY KEYWORDS

${pack.keywords}

APPLICATION ANSWERS

${answers}

INTERVIEW PREPARATION

${interview}`;
  }

  async function sendToReviewQueue() {
    if (!pack) {
      return;
    }

    if (!savedJob) {
      onMessage?.(
        "Save this vacancy to Jobs before sending it to the Review Queue.",
      );

      return;
    }

    setIsSendingToQueue(true);

    try {
      let documents = [];

      if (window.jobPilot?.documents?.list) {
        const result =
          await window.jobPilot.documents.list();

        documents =
          Array.isArray(result)
            ? result
            : [];
      }

      const cvs =
        documents.filter(
          (document) =>
            document.category ===
            "CV",
        );

      const defaultCV =
        cvs.find(
          (document) =>
            document.isDefault,
        ) ||
        cvs[0];

      const generatedResult =
        await saveGeneratedCoverLetterToLibrary({
          coverLetter:
            pack.coverLetter,

          candidateProfile,

          vacancy,

          workspaceId:
            workspaceKey,

          sourceJobId:
            savedJob.id,

          format:
            getCoverLetterFormatPreference(),
        });

      const generatedCoverLetter =
        generatedResult.document;

      setGeneratedCoverLetterDocument(
        generatedCoverLetter,
      );

      const now =
        new Date()
          .toISOString();

      const queue =
        readStoredArray(
          queueStorageKey,
        );

      const currentExistingPackage =
        queue.find(
          (applicationPackage) =>
            applicationPackage.jobId ===
            savedJob.id,
        );

      if (currentExistingPackage) {
        const updatedQueue =
          queue.map(
            (applicationPackage) => {
              if (
                applicationPackage.id !==
                currentExistingPackage.id
              ) {
                return applicationPackage;
              }

              const canRefreshDraftContent =
                applicationPackage.status ===
                  "Draft" ||
                applicationPackage.status ===
                  "Ready for Review";

              return {
                ...applicationPackage,

                cvId:
                  applicationPackage.cvId ||
                  defaultCV?.id ||
                  "",

                cvTitle:
                  applicationPackage.cvTitle ||
                  defaultCV?.title ||
                  "",

                coverLetterId:
                  generatedCoverLetter.id,

                coverLetterTitle:
                  generatedCoverLetter.title,

                generatedCoverLetter:
                  true,

                generatedCoverLetterFormat:
                  generatedCoverLetter.generatedFormat ||
                  getCoverLetterFormatPreference(),

                ...(canRefreshDraftContent
                  ? {
                      tailoredCoverLetter:
                        pack.coverLetter ||
                        "",

                      tailoredCvSummary:
                        pack.cvSummary ||
                        "",

                      tailoringKeywords:
                        pack.keywords ||
                        "",

                      applicationAnswers:
                        Array.isArray(
                          pack.applicationAnswers,
                        )
                          ? pack.applicationAnswers
                          : [],

                      interviewQuestions:
                        Array.isArray(
                          pack.interviewQuestions,
                        )
                          ? pack.interviewQuestions
                          : [],

                      emailSubject:
                        pack.emailSubject ||
                        applicationPackage.emailSubject ||
                        "",

                      emailBody:
                        pack.emailBody ||
                        applicationPackage.emailBody ||
                        "",

                      status: "Draft",
                      reviewAcknowledgements: {
                        ...emptyReviewAcknowledgements,
                      },
                      reviewedAt: "",
                      approvedAt: "",
                    }
                  : {}),

                updatedAt:
                  now,
              };
            },
          );

        writeJson(
          queueStorageKey,
          updatedQueue,
        );

        localStorage.setItem(
          reviewQueueFocusKey,
          currentExistingPackage.id,
        );

        window.dispatchEvent(
          new Event(
            "jobpilot:queue-updated",
          ),
        );

        setStorageRevision(
          (current) =>
            current + 1,
        );

        onMessage?.(
          generatedResult.replaced
            ? "The generated cover letter was updated and the existing Review Queue package now uses it."
            : "The generated cover letter was saved and attached to the existing Review Queue package.",
        );

        navigate(
          "/review-queue",
        );

        return;
      }

      const packageId =
        crypto.randomUUID();

      const applicationPackage = {
        id:
          packageId,

        jobId:
          savedJob.id,

        jobRole:
          savedJob.role,

        company:
          savedJob.company,

        jobUrl:
          savedJob.jobUrl ||
          vacancy.jobUrl ||
          "",

        source:
          savedJob.source ||
          vacancy.source ||
          "",

        matchScore:
          Number(
            analysis.score ||
            0,
          ),

        cvId:
          defaultCV?.id ||
          "",

        cvTitle:
          defaultCV?.title ||
          "",

        coverLetterId:
          generatedCoverLetter.id,

        coverLetterTitle:
          generatedCoverLetter.title,

        generatedCoverLetter:
          true,

        generatedCoverLetterFormat:
          generatedCoverLetter.generatedFormat ||
          getCoverLetterFormatPreference(),

        tailoredCoverLetter:
          pack.coverLetter ||
          "",

        tailoredCvSummary:
          pack.cvSummary ||
          "",

        tailoringKeywords:
          pack.keywords ||
          "",

        applicationAnswers:
          Array.isArray(
            pack.applicationAnswers,
          )
            ? pack.applicationAnswers
            : [],

        interviewQuestions:
          Array.isArray(
            pack.interviewQuestions,
          )
            ? pack.interviewQuestions
            : [],

        recipientName:
          savedJob.contactName ||
          "",

        recipientEmail:
          savedJob.contactEmail ||
          "",

        emailSubject:
          pack.emailSubject ||
          "",

        emailBody:
          pack.emailBody ||
          "",

        notes:
          `Created from AI Assistant${analysis.score ? ` • ${analysis.score}% profile match` : ""}. Generated cover letter attached automatically.`,

        status:
          "Draft",

        sentAt: "",

        reviewAcknowledgements: {
          ...emptyReviewAcknowledgements,
        },

        reviewedAt: "",
        approvedAt: "",

        gmailDraftId: "",
        gmailDraftMessageId: "",
        gmailDraftCreatedAt: "",
        gmailDraftAddress: "",
        gmailDraftAttachmentNames: [],
        gmailDraftHistory: [],
        gmailDraftCount: 0,

        createdFromAssistant:
          true,

        assistantWorkspaceId:
          workspaceKey,

        createdAt:
          now,

        updatedAt:
          now,
      };

      writeJson(
        queueStorageKey,
        [
          applicationPackage,
          ...queue,
        ],
      );

      localStorage.setItem(
        reviewQueueFocusKey,
        packageId,
      );

      window.dispatchEvent(
        new Event(
          "jobpilot:queue-updated",
        ),
      );

      setStorageRevision(
        (current) =>
          current + 1,
      );

      onMessage?.(
        defaultCV
          ? "The tailored application was added to the Review Queue with your default CV and generated cover letter selected."
          : "The tailored application was added with its generated cover letter. Select a CV before moving it to review.",
      );

      navigate(
        "/review-queue",
      );
    } catch (error) {
      onMessage?.(
        error?.message ||
          "The tailored application could not be added to the Review Queue.",
      );
    } finally {
      setIsSendingToQueue(
        false,
      );
    }
  }

  function regeneratePack() {
    if (!confirmRegenerate) {
      setConfirmRegenerate(true);

      if (onMessage) {
        onMessage(
          "Press Regenerate all again to replace your current application-pack edits.",
        );
      }

      return;
    }

    setPack(buildApplicationPack(generationValues));

    setConfirmRegenerate(false);

    if (onMessage) {
      onMessage(
        "The application pack was regenerated from the current profile and vacancy.",
      );
    }
  }

  if (!pack) {
    return null;
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-violet-500/20 bg-[#151515]">
      <div className="flex flex-col justify-between gap-5 border-b border-zinc-800 px-6 py-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <Sparkles size={21} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                Tailored application pack
              </h2>

              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-300">
                {analysis.score}% match
              </span>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              Editable drafts generated from the current vacancy and Candidate
              Profile.
            </p>

            <p className="mt-1 text-xs text-zinc-700">
              Changes save automatically on this computer. Review every draft
              before using it.
            </p>

            <p
              className={[
                "mt-2 text-xs",

                savedJob
                  ? existingPackage
                    ? "text-emerald-400"
                    : "text-zinc-500"
                  : "text-amber-400",
              ].join(" ")}
            >
              {savedJob
                ? existingPackage
                  ? "A Review Queue package already exists for this job."
                  : generatedCoverLetterDocument
                    ? "Generated cover letter saved. Ready for the Review Queue."
                    : "Ready to transfer with an automatically generated cover letter."
                : "Save this vacancy to Jobs before creating a Review Queue package."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isSendingToQueue}
            onClick={sendToReviewQueue}
            title={
              savedJob
                ? existingPackage
                  ? "Open the existing Review Queue package"
                  : "Create a Review Queue package from these tailored drafts"
                : "Save this vacancy to Jobs first"
            }
            className={[
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",

              existingPackage
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : savedJob
                  ? "bg-white text-black hover:bg-zinc-200"
                  : "border border-zinc-700 bg-zinc-800 text-zinc-500",
            ].join(" ")}
          >
            {isSendingToQueue ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : existingPackage ? (
              <ArrowRight size={16} />
            ) : (
              <Briefcase size={16} />
            )}

            {isSendingToQueue
              ? "Preparing package"
              : existingPackage
                ? "Open Review Queue"
                : "Send to Review Queue"}
          </button>

          <button
            type="button"
            onClick={() =>
              copyValue(getFullPackText(), "full-pack", "Full application pack")
            }
            className={secondaryButtonClass}
          >
            {copiedKey === "full-pack" ? (
              <Check size={16} />
            ) : (
              <Clipboard size={16} />
            )}
            Copy full pack
          </button>

          <button
            type="button"
            onClick={regeneratePack}
            className={[
              "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition",

              confirmRegenerate
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
            ].join(" ")}
          >
            <RefreshCw size={16} />

            {confirmRegenerate ? "Confirm regeneration" : "Regenerate all"}
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-800 px-3 pt-3 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition",

                  activeTab === tab.id
                    ? "border-violet-400 text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300",
                ].join(" ")}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {activeTab === "cover-letter" && (
          <div className="space-y-5">
            <EditorPanel
              title="Tailored cover letter"
              description="Edit the letter here, then export the final version as a formatted Word or PDF document."
              value={pack.coverLetter}
              onChange={(value) => updatePack("coverLetter", value)}
              onCopy={() =>
                copyValue(pack.coverLetter, "cover-letter", "Cover letter")
              }
              copied={copiedKey === "cover-letter"}
              rows={18}
            />

            <CoverLetterExport
              coverLetter={pack.coverLetter}
              candidateProfile={candidateProfile}
              vacancy={vacancy}
              workspaceId={workspaceKey}
              sourceJobId={savedJob?.id || ""}
              onSaved={setGeneratedCoverLetterDocument}
              onMessage={onMessage}
            />
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-5">
            <TextFieldPanel
              title="Email subject"
              value={pack.emailSubject}
              onChange={(value) => updatePack("emailSubject", value)}
              onCopy={() =>
                copyValue(pack.emailSubject, "email-subject", "Email subject")
              }
              copied={copiedKey === "email-subject"}
            />

            <EditorPanel
              title="Application email"
              description="A concise message for sending a CV and optional cover letter."
              value={pack.emailBody}
              onChange={(value) => updatePack("emailBody", value)}
              onCopy={() =>
                copyValue(pack.emailBody, "email-body", "Application email")
              }
              copied={copiedKey === "email-body"}
              rows={13}
            />
          </div>
        )}

        {activeTab === "cv" && (
          <div className="space-y-5">
            <EditorPanel
              title="Suggested CV profile"
              description="Adapt this summary to the profile section at the top of your CV."
              value={pack.cvSummary}
              onChange={(value) => updatePack("cvSummary", value)}
              onCopy={() =>
                copyValue(pack.cvSummary, "cv-summary", "CV profile")
              }
              copied={copiedKey === "cv-summary"}
              rows={7}
            />

            <EditorPanel
              title="Tailoring checklist"
              description="These are editing suggestions, not claims to add without evidence."
              value={pack.cvSuggestions}
              onChange={(value) => updatePack("cvSuggestions", value)}
              onCopy={() =>
                copyValue(
                  pack.cvSuggestions,
                  "cv-suggestions",
                  "CV suggestions",
                )
              }
              copied={copiedKey === "cv-suggestions"}
              rows={11}
            />

            <EditorPanel
              title="Vacancy keywords"
              description="Use only keywords that accurately describe your real experience."
              value={pack.keywords}
              onChange={(value) => updatePack("keywords", value)}
              onCopy={() =>
                copyValue(pack.keywords, "keywords", "Vacancy keywords")
              }
              copied={copiedKey === "keywords"}
              rows={4}
            />
          </div>
        )}

        {activeTab === "answers" && (
          <div className="space-y-5">
            {pack.applicationAnswers.map((item) => (
              <EditorPanel
                key={item.id}
                title={item.prompt}
                value={item.answer}
                onChange={(value) => updateAnswer(item.id, value)}
                onCopy={() =>
                  copyValue(item.answer, `answer:${item.id}`, item.prompt)
                }
                copied={copiedKey === `answer:${item.id}`}
                rows={8}
              />
            ))}
          </div>
        )}

        {activeTab === "interview" && (
          <div className="space-y-4">
            {pack.interviewQuestions.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                      Question {index + 1}
                    </p>

                    <h3 className="mt-2 font-semibold text-zinc-200">
                      {item.question}
                    </h3>
                  </div>

                  <CopyButton
                    copied={copiedKey === `interview:${item.id}`}
                    onClick={() =>
                      copyValue(
                        `${item.question}\n\n${item.guidance}`,
                        `interview:${item.id}`,
                        "Interview preparation",
                      )
                    }
                  />
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-medium text-zinc-500">
                    Answer guidance
                  </span>

                  <textarea
                    rows="5"
                    value={item.guidance}
                    onChange={(event) =>
                      updateInterviewGuidance(item.id, event.target.value)
                    }
                    className={textareaClass}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-800 px-6 py-4 text-xs text-zinc-600">
        <Save size={14} />
        Saved locally
        {pack.updatedAt
          ? ` • ${new Date(pack.updatedAt).toLocaleString()}`
          : ""}
      </div>
    </section>
  );
}

function EditorPanel({
  title,
  description = "",
  value,
  onChange,
  onCopy,
  copied,
  rows = 10,
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-200">{title}</h3>

          {description && (
            <p className="mt-1 text-sm text-zinc-600">{description}</p>
          )}
        </div>

        <CopyButton copied={copied} onClick={onCopy} />
      </div>

      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${textareaClass} mt-4`}
      />
    </div>
  );
}

function TextFieldPanel({ title, value, onChange, onCopy, copied }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-zinc-200">{title}</h3>

        <CopyButton copied={copied} onClick={onCopy} />
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} mt-4`}
      />
    </div>
  );
}

function CopyButton({ copied, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
    >
      {copied ? <Check size={14} /> : <Clipboard size={14} />}

      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500";

const textareaClass =
  "w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-3 text-sm leading-6 text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-zinc-500";

const secondaryButtonClass =
  "flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800";

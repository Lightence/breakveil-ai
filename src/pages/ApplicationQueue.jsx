import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  FileUp,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  X,
} from "lucide-react";

import ConfirmDialog from "../components/ConfirmDialog";
import ApplicationReviewChecklist from "../components/ApplicationReviewChecklist";

import {
  buildApplicationPreparation,
  emptyReviewAcknowledgements,
  normaliseReviewAcknowledgements,
} from "../lib/applicationPreparation";

import {
  formatPreferenceDateTime,
} from "../lib/uiPreferences";

import {
  getPackageStatusClass,
} from "../lib/semanticUi";

const queueStorageKey = "jobpilot.application-queue";
const jobsStorageKey = "jobpilot.jobs";
const profileStorageKey = "jobpilot.candidate-profile";
const reviewQueueFocusKey = "jobpilot.review-queue-focus";
const reviewQueueCreateJobKey = "jobpilot.review-queue-create-job";

const statuses = ["Draft", "Ready for Review", "Approved", "Sent"];

const emptyForm = {
  jobId: "",
  cvId: "",
  coverLetterId: "",
  recipientName: "",
  recipientEmail: "",
  emailSubject: "",
  emailBody: "",
  tailoredCoverLetter: "",
  tailoredCvSummary: "",
  tailoringKeywords: "",
  matchScore: "",
  notes: "",
};

const emptyGmailStatus = {
  configured: false,
  connected: false,
  email: "",
  needsReconnect: false,
  error: "",
};

function loadStoredArray(storageKey) {
  try {
    const savedValue = localStorage.getItem(storageKey);

    return savedValue ? JSON.parse(savedValue) : [];
  } catch {
    return [];
  }
}

function loadProfile() {
  try {
    const savedProfile = localStorage.getItem(profileStorageKey);

    return savedProfile ? JSON.parse(savedProfile) : {};
  } catch {
    return {};
  }
}

function formatDateTime(value) {
  return formatPreferenceDateTime(
    value,
  );
}

function getDraftCount(applicationPackage) {
  if (Array.isArray(applicationPackage.gmailDraftHistory)) {
    return applicationPackage.gmailDraftHistory.length;
  }

  if (applicationPackage.gmailDraftCount) {
    return applicationPackage.gmailDraftCount;
  }

  return applicationPackage.gmailDraftId ? 1 : 0;
}

function getExistingDraftHistory(applicationPackage) {
  if (Array.isArray(applicationPackage.gmailDraftHistory)) {
    return applicationPackage.gmailDraftHistory;
  }

  if (!applicationPackage.gmailDraftId) {
    return [];
  }

  return [
    {
      draftId: applicationPackage.gmailDraftId,
      messageId: applicationPackage.gmailDraftMessageId || "",
      createdAt: applicationPackage.gmailDraftCreatedAt || "",
      gmailAddress: applicationPackage.gmailDraftAddress || "",
      attachmentNames: Array.isArray(
        applicationPackage.gmailDraftAttachmentNames,
      )
        ? applicationPackage.gmailDraftAttachmentNames
        : [],
    },
  ];
}

function createApplicationDraft(job, profile, recipientName) {
  const candidateName =
    profile.fullName || profile.preferredName || "Your Name";

  const greeting = recipientName
    ? `Dear ${recipientName},`
    : "Dear Hiring Team,";

  const subject = `Application for ${job.role} – ${candidateName}`;

  const body = [
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
  ].join("\n");

  return {
    subject,
    body,
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textArea = document.createElement("textarea");

      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      const copied = document.execCommand("copy");

      textArea.remove();

      return copied;
    } catch {
      return false;
    }
  }
}

export default function ApplicationQueue() {
  const [jobs, setJobs] = useState(() => loadStoredArray(jobsStorageKey));

  const [queue, setQueue] = useState(() => loadStoredArray(queueStorageKey));

  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);

  const [editingPackageId, setEditingPackageId] = useState(null);

  const [packagePendingDeletion, setPackagePendingDeletion] = useState(null);

  const [packagePendingSent, setPackagePendingSent] = useState(null);

  const [packagePendingReopen, setPackagePendingReopen] = useState(null);

  const [creatingDraftPackageId, setCreatingDraftPackageId] = useState(null);

  const [gmailStatus, setGmailStatus] = useState(emptyGmailStatus);

  const [isCheckingGmail, setIsCheckingGmail] = useState(true);

  const [form, setForm] = useState(emptyForm);

  const [message, setMessage] = useState("");

  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  const [isImportingCoverLetter, setIsImportingCoverLetter] = useState(false);

  const reviewFocusHandled = useRef(false);

  const profile = useMemo(loadProfile, []);

  useEffect(() => {
    loadDocuments();
    loadGmailStatus();

    function refreshJobs() {
      setJobs(loadStoredArray(jobsStorageKey));
    }

    function refreshQueue() {
      setQueue(loadStoredArray(queueStorageKey));
    }

    function refreshPageData() {
      refreshJobs();
      refreshQueue();
      loadGmailStatus();
    }

    window.addEventListener("focus", refreshPageData);

    window.addEventListener("jobpilot:jobs-updated", refreshJobs);

    window.addEventListener("jobpilot:queue-updated", refreshQueue);

    return () => {
      window.removeEventListener("focus", refreshPageData);

      window.removeEventListener("jobpilot:jobs-updated", refreshJobs);

      window.removeEventListener("jobpilot:queue-updated", refreshQueue);
    };
  }, []);

  useEffect(() => {
    if (reviewFocusHandled.current) {
      return;
    }

    const focusedPackageId =
      localStorage.getItem(
        reviewQueueFocusKey,
      );

    if (focusedPackageId) {
      const focusedPackage =
        queue.find(
          (applicationPackage) =>
            applicationPackage.id ===
            focusedPackageId,
        );

      if (!focusedPackage) {
        return;
      }

      reviewFocusHandled.current = true;

      localStorage.removeItem(
        reviewQueueFocusKey,
      );

      setStatusFilter("All");
      setSearch("");

      openEditPackage(
        focusedPackage,
      );

      setMessage(
        focusedPackage.createdFromAssistant
          ? "The AI-tailored application has been loaded for review."
          : "The selected application package has been opened.",
      );

      return;
    }

    const createForJobId =
      localStorage.getItem(
        reviewQueueCreateJobKey,
      );

    if (!createForJobId) {
      reviewFocusHandled.current = true;
      return;
    }

    if (isLoadingDocuments) {
      return;
    }

    const selectedJob =
      jobs.find(
        (job) =>
          String(job.id) ===
          String(createForJobId),
      );

    if (!selectedJob) {
      reviewFocusHandled.current = true;

      localStorage.removeItem(
        reviewQueueCreateJobKey,
      );

      setMessage(
        "The selected job could not be found.",
      );

      return;
    }

    reviewFocusHandled.current = true;

    localStorage.removeItem(
      reviewQueueCreateJobKey,
    );

    setStatusFilter("All");
    setSearch("");

    openCreatePackageForJob(
      selectedJob,
    );

    setMessage(
      `Choose the documents for ${selectedJob.role} at ${selectedJob.company}.`,
    );
  }, [
    queue,
    jobs,
    documents,
    isLoadingDocuments,
  ]);

  const cvs = useMemo(
    () => documents.filter((document) => document.category === "CV"),
    [documents],
  );

  const coverLetters = useMemo(
    () => documents.filter((document) => document.category === "Cover Letter"),
    [documents],
  );

  const selectedFormJob = jobs.find((job) => job.id === form.jobId);

  const selectedFormCV = documents.find(
    (document) => document.id === form.cvId,
  );

  const selectedFormCoverLetter = documents.find(
    (document) => document.id === form.coverLetterId,
  );

  const formReadiness = buildApplicationPreparation({
    job: selectedFormJob,
    cv: selectedFormCV,
    coverLetterId: form.coverLetterId,
    coverLetter: selectedFormCoverLetter,
    recipientEmail: form.recipientEmail,
    emailSubject: form.emailSubject,
    emailBody: form.emailBody,
  });

  const filteredQueue = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return queue.filter((applicationPackage) => {
      const searchableText = [
        applicationPackage.jobRole,
        applicationPackage.company,
        applicationPackage.cvTitle,
        applicationPackage.coverLetterTitle,
        applicationPackage.recipientName,
        applicationPackage.recipientEmail,
        applicationPackage.emailSubject,
        applicationPackage.gmailDraftAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(searchText);

      const matchesStatus =
        statusFilter === "All" || applicationPackage.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [queue, search, statusFilter]);

  async function loadDocuments() {
    setIsLoadingDocuments(true);

    try {
      if (!window.jobPilot?.documents) {
        setDocuments([]);
        return;
      }

      const savedDocuments = await window.jobPilot.documents.list();

      setDocuments(Array.isArray(savedDocuments) ? savedDocuments : []);
    } catch {
      setDocuments([]);

      setMessage("BreakVeil could not load your Resume Library.");
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  async function importCoverLetterForForm() {
    if (!window.jobPilot?.documents?.addFiles) {
      setMessage(
        "The Resume Library importer is unavailable. Fully restart BreakVeil.",
      );

      return;
    }

    setIsImportingCoverLetter(true);
    setMessage(
      "Choose the Word or PDF cover letter you exported from the AI Assistant.",
    );

    const existingIds = new Set(documents.map((document) => document.id));

    try {
      await window.jobPilot.documents.addFiles("Cover Letter");

      const refreshedDocuments = await window.jobPilot.documents.list();

      const safeDocuments = Array.isArray(refreshedDocuments)
        ? refreshedDocuments
        : [];

      setDocuments(safeDocuments);

      const newCoverLetters = safeDocuments
        .filter(
          (document) =>
            document.category === "Cover Letter" &&
            !existingIds.has(document.id),
        )
        .sort((first, second) => {
          const firstDate = new Date(
            first.createdAt || first.updatedAt || 0,
          ).getTime();

          const secondDate = new Date(
            second.createdAt || second.updatedAt || 0,
          ).getTime();

          return secondDate - firstDate;
        });

      const importedCoverLetter = newCoverLetters[0];

      if (importedCoverLetter) {
        setForm((currentForm) => ({
          ...currentForm,
          coverLetterId: importedCoverLetter.id,
        }));

        setMessage(
          `${importedCoverLetter.title} was imported and selected as this package's cover letter.`,
        );
      } else {
        setMessage(
          "No new cover letter was imported. The file picker may have been cancelled.",
        );
      }
    } catch (error) {
      setMessage(
        error?.message ||
          "BreakVeil could not import the exported cover letter.",
      );
    } finally {
      setIsImportingCoverLetter(false);
    }
  }

  async function loadGmailStatus() {
    setIsCheckingGmail(true);

    try {
      if (!window.jobPilot?.gmail) {
        setGmailStatus({
          ...emptyGmailStatus,

          error: "The Gmail service is unavailable. Fully restart BreakVeil.",
        });

        return;
      }

      const result = await window.jobPilot.gmail.getStatus();

      setGmailStatus({
        configured: Boolean(result?.configured),

        connected: Boolean(result?.connected),

        email: result?.email || "",

        needsReconnect: Boolean(result?.needsReconnect),

        error: result?.error || "",
      });
    } catch (error) {
      setGmailStatus({
        ...emptyGmailStatus,

        error: error?.message || "BreakVeil could not check Gmail.",
      });
    } finally {
      setIsCheckingGmail(false);
    }
  }

  function getPackageReadiness(applicationPackage) {
    const selectedJob = jobs.find((job) => job.id === applicationPackage.jobId);

    const selectedCV = documents.find(
      (document) => document.id === applicationPackage.cvId,
    );

    const selectedCoverLetter = documents.find(
      (document) => document.id === applicationPackage.coverLetterId,
    );

    return buildApplicationPreparation({
      job: selectedJob,
      cv: selectedCV,

      coverLetterId: applicationPackage.coverLetterId,

      coverLetter: selectedCoverLetter,

      recipientEmail: applicationPackage.recipientEmail,

      emailSubject: applicationPackage.emailSubject,

      emailBody: applicationPackage.emailBody,

      applicationAnswers: applicationPackage.applicationAnswers,

      reviewAcknowledgements: applicationPackage.reviewAcknowledgements,
    });
  }

  function saveQueue(updatedQueue) {
    setQueue(updatedQueue);

    localStorage.setItem(queueStorageKey, JSON.stringify(updatedQueue));

    window.dispatchEvent(new Event("jobpilot:queue-updated"));
  }

  function saveJobs(updatedJobs) {
    setJobs(updatedJobs);

    localStorage.setItem(jobsStorageKey, JSON.stringify(updatedJobs));

    window.dispatchEvent(new Event("jobpilot:jobs-updated"));
  }

  function updateForm(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setMessage("");
  }

  function selectJob(jobId) {
    const selectedJob = jobs.find((job) => job.id === jobId);

    if (!selectedJob) {
      updateForm("jobId", jobId);
      return;
    }

    const recipientName = selectedJob.contactName || "";

    const recipientEmail = selectedJob.contactEmail || "";

    const draft = createApplicationDraft(selectedJob, profile, recipientName);

    setForm((currentForm) => ({
      ...currentForm,
      jobId,
      recipientName,
      recipientEmail,
      emailSubject: draft.subject,
      emailBody: draft.body,
      tailoredCoverLetter: "",
      tailoredCvSummary: "",
      tailoringKeywords: "",
      matchScore: "",
    }));

    setMessage("");
  }

  function openCreatePackage() {
    const defaultCV = cvs.find((document) => document.isDefault) || cvs[0];

    const defaultCoverLetter =
      coverLetters.find((document) => document.isDefault) || coverLetters[0];

    setEditingPackageId(null);

    setForm({
      ...emptyForm,
      cvId: defaultCV?.id || "",
      coverLetterId: defaultCoverLetter?.id || "",
    });

    setMessage("");
    setShowForm(true);
  }

  function openCreatePackageForJob(
    selectedJob,
  ) {
    const defaultCV =
      cvs.find(
        (document) =>
          document.isDefault,
      ) || cvs[0];

    const defaultCoverLetter =
      coverLetters.find(
        (document) =>
          document.isDefault,
      ) || coverLetters[0];

    const recipientName =
      selectedJob.contactName || "";

    const recipientEmail =
      selectedJob.contactEmail || "";

    const draft =
      createApplicationDraft(
        selectedJob,
        profile,
        recipientName,
      );

    setEditingPackageId(null);

    setForm({
      ...emptyForm,
      jobId:
        selectedJob.id,
      cvId:
        defaultCV?.id || "",
      coverLetterId:
        defaultCoverLetter?.id || "",
      recipientName,
      recipientEmail,
      emailSubject:
        draft.subject,
      emailBody:
        draft.body,
    });

    setShowForm(true);
  }

  function openEditPackage(applicationPackage) {
    const selectedJob = jobs.find((job) => job.id === applicationPackage.jobId);

    setEditingPackageId(applicationPackage.id);

    setForm({
      jobId: applicationPackage.jobId || "",

      cvId: applicationPackage.cvId || "",

      coverLetterId: applicationPackage.coverLetterId || "",

      recipientName:
        applicationPackage.recipientName || selectedJob?.contactName || "",

      recipientEmail:
        applicationPackage.recipientEmail || selectedJob?.contactEmail || "",

      emailSubject: applicationPackage.emailSubject || "",

      emailBody: applicationPackage.emailBody || "",

      tailoredCoverLetter: applicationPackage.tailoredCoverLetter || "",

      tailoredCvSummary: applicationPackage.tailoredCvSummary || "",

      tailoringKeywords: applicationPackage.tailoringKeywords || "",

      matchScore: applicationPackage.matchScore ?? "",

      notes: applicationPackage.notes || "",
    });

    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingPackageId(null);
    setForm(emptyForm);
  }

  function submitPackage(event) {
    event.preventDefault();

    const selectedJob = jobs.find((job) => job.id === form.jobId);

    const selectedCV = documents.find((document) => document.id === form.cvId);

    const selectedCoverLetter = documents.find(
      (document) => document.id === form.coverLetterId,
    );

    if (!selectedJob) {
      setMessage("Choose a job before creating the application package.");

      return;
    }

    if (!selectedCV) {
      setMessage("Choose a CV before creating the application package.");

      return;
    }

    const duplicatePackage = queue.find(
      (applicationPackage) =>
        applicationPackage.jobId === selectedJob.id &&
        applicationPackage.id !== editingPackageId,
    );

    if (duplicatePackage) {
      setMessage("An application package already exists for this job.");

      return;
    }

    if (editingPackageId) {
      const existingPackage = queue.find(
        (applicationPackage) => applicationPackage.id === editingPackageId,
      );

      const previousDraftCount = existingPackage
        ? getDraftCount(existingPackage)
        : 0;

      const updatedQueue = queue.map((applicationPackage) => {
        if (applicationPackage.id !== editingPackageId) {
          return applicationPackage;
        }

        return {
          ...applicationPackage,

          jobId: selectedJob.id,
          jobRole: selectedJob.role,
          company: selectedJob.company,

          cvId: selectedCV.id,
          cvTitle: selectedCV.title,

          coverLetterId: selectedCoverLetter?.id || "",

          coverLetterTitle: selectedCoverLetter?.title || "",

          recipientName: form.recipientName.trim(),

          recipientEmail: form.recipientEmail.trim(),

          emailSubject: form.emailSubject.trim(),

          emailBody: form.emailBody.trim(),

          tailoredCoverLetter: form.tailoredCoverLetter.trim(),

          tailoredCvSummary: form.tailoredCvSummary.trim(),

          tailoringKeywords: form.tailoringKeywords.trim(),

          matchScore: Number(form.matchScore || 0),

          jobUrl: selectedJob.jobUrl || applicationPackage.jobUrl || "",

          source: selectedJob.source || applicationPackage.source || "",

          notes: form.notes.trim(),

          status: "Draft",
          sentAt: "",
          reviewAcknowledgements: { ...emptyReviewAcknowledgements },
          reviewedAt: "",
          approvedAt: "",

          gmailDraftId: "",
          gmailDraftMessageId: "",
          gmailDraftCreatedAt: "",
          gmailDraftAddress: "",
          gmailDraftAttachmentNames: [],
          gmailDraftHistory: [],
          gmailDraftCount: 0,

          updatedAt: new Date().toISOString(),
        };
      });

      saveQueue(updatedQueue);

      if (previousDraftCount > 0) {
        setMessage(
          `Application updated and returned to Draft. ${previousDraftCount} previous Gmail draft${previousDraftCount === 1 ? "" : "s"} may still remain in Gmail.`,
        );
      } else if (existingPackage?.status === "Draft") {
        setMessage("Application package updated successfully.");
      } else {
        setMessage(
          "Application package updated and returned to Draft for another review.",
        );
      }
    } else {
      const newPackage = {
        id: crypto.randomUUID(),

        jobId: selectedJob.id,
        jobRole: selectedJob.role,
        company: selectedJob.company,

        cvId: selectedCV.id,
        cvTitle: selectedCV.title,

        coverLetterId: selectedCoverLetter?.id || "",

        coverLetterTitle: selectedCoverLetter?.title || "",

        recipientName: form.recipientName.trim(),

        recipientEmail: form.recipientEmail.trim(),

        emailSubject: form.emailSubject.trim(),

        emailBody: form.emailBody.trim(),

        tailoredCoverLetter: form.tailoredCoverLetter.trim(),

        tailoredCvSummary: form.tailoredCvSummary.trim(),

        tailoringKeywords: form.tailoringKeywords.trim(),

        matchScore: Number(form.matchScore || 0),

        jobUrl: selectedJob.jobUrl || "",

        source: selectedJob.source || "",

        applicationAnswers: [],
        interviewQuestions: [],

        createdFromAssistant: false,

        notes: form.notes.trim(),

        status: "Draft",
        sentAt: "",
        reviewAcknowledgements: { ...emptyReviewAcknowledgements },
        reviewedAt: "",
        approvedAt: "",

        gmailDraftId: "",
        gmailDraftMessageId: "",
        gmailDraftCreatedAt: "",
        gmailDraftAddress: "",
        gmailDraftAttachmentNames: [],
        gmailDraftHistory: [],
        gmailDraftCount: 0,

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString(),
      };

      saveQueue([newPackage, ...queue]);

      setMessage("Application package added to the review queue.");
    }

    closeForm();
  }

  function changePackageStatus(packageId, newStatus) {
    const applicationPackage = queue.find((item) => item.id === packageId);

    if (!applicationPackage) {
      return;
    }

    const readiness = getPackageReadiness(applicationPackage);

    const needsHumanApproval = newStatus === "Approved";
    const canContinue = needsHumanApproval
      ? readiness.readyForApproval
      : readiness.readyForReview;

    if (newStatus !== "Draft" && !canContinue) {
      const missingReviewCount =
        readiness.reviewTotalCount - readiness.reviewPassedCount;
      const missingCount = readiness.totalCount - readiness.passedCount;

      setMessage(
        needsHumanApproval && missingReviewCount > 0
          ? `Tick the ${missingReviewCount} remaining human review check${missingReviewCount === 1 ? "" : "s"} before approving.`
          : `This application has ${missingCount} incomplete readiness check${missingCount === 1 ? "" : "s"}. Complete them before continuing.`,
      );

      return;
    }

    const updatedQueue = queue.map((item) =>
      item.id === packageId
        ? {
            ...item,
            status: newStatus,

            reviewAcknowledgements:
              newStatus === "Draft"
                ? { ...emptyReviewAcknowledgements }
                : normaliseReviewAcknowledgements(
                    item.reviewAcknowledgements,
                  ),

            reviewedAt:
              newStatus === "Draft"
                ? ""
                : newStatus === "Approved"
                  ? new Date().toISOString()
                  : item.reviewedAt || "",

            approvedAt:
              newStatus === "Approved"
                ? new Date().toISOString()
                : newStatus === "Draft"
                  ? ""
                  : item.approvedAt || "",

            sentAt: newStatus === "Draft" ? "" : item.sentAt || "",

            updatedAt: new Date().toISOString(),
          }
        : item,
    );

    saveQueue(updatedQueue);

    if (newStatus === "Approved") {
      setMessage(
        gmailStatus.connected
          ? "Application approved. You can now create its Gmail draft."
          : "Application approved. Connect Gmail under Automation to create a Gmail draft.",
      );
    } else {
      setMessage(`Application moved to ${newStatus}.`);
    }
  }

  function updateReviewAcknowledgement(packageId, reviewId, checked) {
    const now = new Date().toISOString();

    const updatedQueue = queue.map((applicationPackage) => {
      if (applicationPackage.id !== packageId) {
        return applicationPackage;
      }

      const acknowledgements = normaliseReviewAcknowledgements(
        applicationPackage.reviewAcknowledgements,
      );

      return {
        ...applicationPackage,
        status:
          applicationPackage.status === "Approved"
            ? "Ready for Review"
            : applicationPackage.status,
        reviewAcknowledgements: {
          ...acknowledgements,
          [reviewId]: checked === true,
        },
        reviewedAt: "",
        approvedAt:
          applicationPackage.status === "Approved"
            ? ""
            : applicationPackage.approvedAt || "",
        updatedAt: now,
      };
    });

    saveQueue(updatedQueue);
    setMessage(
      "Review check saved. BreakVeil will still wait for you to approve the package.",
    );
  }

  async function createPackageGmailDraft(applicationPackage) {
    if (applicationPackage.status !== "Approved") {
      setMessage("Only approved applications can create Gmail drafts.");

      return;
    }

    const readiness = getPackageReadiness(applicationPackage);

    if (!readiness.readyForApproval) {
      setMessage(
        "Complete all application readiness checks before creating a Gmail draft.",
      );

      return;
    }

    if (!gmailStatus.connected) {
      setMessage(
        "Connect Gmail from the Automation page before creating a draft.",
      );

      return;
    }

    setCreatingDraftPackageId(applicationPackage.id);

    const existingDraftCount = getDraftCount(applicationPackage);

    setMessage(
      existingDraftCount > 0
        ? "Creating another Gmail draft with the latest application details..."
        : "Creating the Gmail draft and attaching your selected documents...",
    );

    try {
      const result = await window.jobPilot.gmail.createDraft({
        recipientEmail: applicationPackage.recipientEmail,

        emailSubject: applicationPackage.emailSubject,

        emailBody: applicationPackage.emailBody,

        cvId: applicationPackage.cvId,

        coverLetterId: applicationPackage.coverLetterId,
      });

      if (!result?.ok) {
        setMessage(
          result?.error || "BreakVeil could not create the Gmail draft.",
        );

        return;
      }

      const createdAt = result.createdAt || new Date().toISOString();

      const attachmentNames = Array.isArray(result.attachmentNames)
        ? result.attachmentNames
        : [];

      const newDraftRecord = {
        draftId: result.draftId || "",

        messageId: result.messageId || "",

        createdAt,

        gmailAddress: result.gmailAddress || gmailStatus.email || "",

        attachmentNames,
      };

      const updatedQueue = queue.map((item) => {
        if (item.id !== applicationPackage.id) {
          return item;
        }

        const previousHistory = getExistingDraftHistory(item);

        const updatedHistory = [...previousHistory, newDraftRecord];

        return {
          ...item,

          gmailDraftId: newDraftRecord.draftId,

          gmailDraftMessageId: newDraftRecord.messageId,

          gmailDraftCreatedAt: newDraftRecord.createdAt,

          gmailDraftAddress: newDraftRecord.gmailAddress,

          gmailDraftAttachmentNames: newDraftRecord.attachmentNames,

          gmailDraftHistory: updatedHistory,

          gmailDraftCount: updatedHistory.length,

          updatedAt: createdAt,
        };
      });

      saveQueue(updatedQueue);

      const newDraftCount = existingDraftCount + 1;

      setMessage(
        `${existingDraftCount > 0 ? "Another" : "A"} Gmail draft was created successfully with ${attachmentNames.length} attachment${attachmentNames.length === 1 ? "" : "s"}. This application has now created ${newDraftCount} Gmail draft${newDraftCount === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setMessage(
        error?.message || "BreakVeil could not create the Gmail draft.",
      );
    } finally {
      setCreatingDraftPackageId(null);
    }
  }

  async function openPackageDocument(documentId) {
    if (!documentId) {
      return;
    }

    if (!window.jobPilot?.documents?.open) {
      setMessage(
        "Document storage is unavailable. Fully restart BreakVeil.",
      );

      return;
    }

    try {
      const result =
        await window.jobPilot.documents.open(documentId);

      if (!result?.ok) {
        setMessage(
          result?.error ||
            "Windows could not open the selected document.",
        );
      }
    } catch (error) {
      setMessage(
        error?.message ||
          "Windows could not open the selected document.",
      );
    }
  }

  async function openGmailDrafts() {
    try {
      if (!window.jobPilot?.gmail) {
        setMessage("The Gmail service is unavailable. Fully restart BreakVeil.");

        return;
      }

      const result = await window.jobPilot.gmail.openDrafts();

      if (!result?.ok) {
        setMessage(result?.error || "BreakVeil could not open Gmail Drafts.");
      }
    } catch (error) {
      setMessage(error?.message || "BreakVeil could not open Gmail Drafts.");
    }
  }

  async function copyApplicationEmail(applicationPackage) {
    const emailText = [
      `To: ${applicationPackage.recipientEmail || ""}`,
      `Subject: ${applicationPackage.emailSubject || ""}`,
      "",
      applicationPackage.emailBody || "",
      "",
      `CV: ${applicationPackage.cvTitle || "None selected"}`,
      `Cover letter: ${applicationPackage.coverLetterTitle || "None selected"}`,
    ].join("\n");

    const copied = await copyText(emailText);

    setMessage(
      copied
        ? "Application email copied. Paste it into your email provider and attach the selected documents."
        : "BreakVeil could not copy the email. Please copy it manually from the preview.",
    );
  }

  function requestMarkPackageSent(applicationPackage) {
    const readiness = getPackageReadiness(applicationPackage);

    if (!readiness.readyForApproval) {
      setMessage(
        "Complete the application readiness checks before marking it as sent.",
      );

      return;
    }

    if (applicationPackage.status !== "Approved") {
      setMessage("Only approved applications can be marked as sent.");

      return;
    }

    setPackagePendingSent(applicationPackage);
  }

  function cancelMarkPackageSent() {
    setPackagePendingSent(null);
  }

  function confirmMarkPackageSent() {
    if (!packagePendingSent) {
      return;
    }

    const sentAt = new Date().toISOString();

    const updatedQueue = queue.map((applicationPackage) =>
      applicationPackage.id === packagePendingSent.id
        ? {
            ...applicationPackage,
            status: "Sent",
            sentAt,
            updatedAt: sentAt,
          }
        : applicationPackage,
    );

    const applicationDate = sentAt.slice(0, 10);

    const updatedJobs = jobs.map((job) =>
      job.id === packagePendingSent.jobId
        ? {
            ...job,
            status: "Applied",

            dateApplied: job.dateApplied || applicationDate,

            updatedAt: sentAt,
          }
        : job,
    );

    saveQueue(updatedQueue);
    saveJobs(updatedJobs);

    setPackagePendingSent(null);

    setMessage(
      "Application marked as sent. The linked job has been moved to Applied.",
    );
  }

  function requestReturnToApproved(applicationPackage) {
    setPackagePendingReopen(applicationPackage);
  }

  function cancelReturnToApproved() {
    setPackagePendingReopen(null);
  }

  function confirmReturnToApproved() {
    if (!packagePendingReopen) {
      return;
    }

    const readiness =
      getPackageReadiness(
        packagePendingReopen,
      );

    const restoredStatus =
      readiness.readyForApproval
        ? "Approved"
        : "Ready for Review";

    const updatedQueue = queue.map((applicationPackage) =>
      applicationPackage.id === packagePendingReopen.id
        ? {
            ...applicationPackage,

            status: restoredStatus,
            sentAt: "",

            updatedAt: new Date().toISOString(),
          }
        : applicationPackage,
    );

    saveQueue(updatedQueue);

    setPackagePendingReopen(null);

    setMessage(
      restoredStatus === "Approved"
        ? "The package has returned to Approved. You may create another Gmail draft."
        : "The package has returned to human review because its review confirmations were incomplete.",
    );
  }

  function requestDeletePackage(applicationPackage) {
    setPackagePendingDeletion(applicationPackage);
  }

  function cancelDeletePackage() {
    setPackagePendingDeletion(null);
  }

  function confirmDeletePackage() {
    if (!packagePendingDeletion) {
      return;
    }

    saveQueue(
      queue.filter(
        (applicationPackage) =>
          applicationPackage.id !== packagePendingDeletion.id,
      ),
    );

    const gmailDraftCount = getDraftCount(packagePendingDeletion);

    setPackagePendingDeletion(null);

    setMessage(
      gmailDraftCount > 0
        ? `Application package deleted. Its ${gmailDraftCount} Gmail draft${gmailDraftCount === 1 ? "" : "s"} will remain in Gmail.`
        : "Application package deleted.",
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold">Application Review Queue</h1>

          <p className="mt-2 text-zinc-400">
            Prepare, review and approve tailored application packages before
            Gmail delivery.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreatePackage}
          className="flex w-fit shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Plus size={17} />
          Create package
        </button>
      </div>

      {isCheckingGmail ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#151515] p-4 text-sm text-zinc-400">
          <LoaderCircle size={17} className="animate-spin" />
          Checking Gmail connection
        </div>
      ) : gmailStatus.connected ? (
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Mail size={19} className="mt-0.5 shrink-0 text-emerald-300" />

            <div>
              <p className="text-sm font-medium text-emerald-200">
                Gmail draft mode connected
              </p>

              <p className="mt-1 text-sm text-emerald-200/70">
                Approved packages can create replacement drafts in{" "}
                {gmailStatus.email || "your connected Gmail account"}. Nothing
                is sent automatically.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openGmailDrafts}
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-emerald-500/20 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/10"
          >
            <ExternalLink size={15} />
            Open Gmail Drafts
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={19}
              className="mt-0.5 shrink-0 text-amber-300"
            />

            <div>
              <p className="text-sm font-medium text-amber-200">
                Gmail is not connected
              </p>

              <p className="mt-1 text-sm text-amber-200/70">
                You can continue preparing applications, but Gmail drafts cannot
                be created yet.
              </p>
            </div>
          </div>

          <Link
            to="/automation"
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-amber-500/20 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/10"
          >
            <Mail size={15} />
            Open Automation
          </Link>
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 text-sm text-zinc-200">
          {message}
        </div>
      )}

      <div className="jp-grid-compact mt-8 gap-4">
        {statuses.map((status) => {
          const total = queue.filter(
            (applicationPackage) => applicationPackage.status === status,
          ).length;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={[
                "rounded-xl border p-4 text-left transition",

                statusFilter === status
                  ? "border-zinc-500 bg-zinc-800"
                  : "border-zinc-800 bg-[#151515] hover:border-zinc-700",
              ].join(" ")}
            >
              <p className="text-sm text-zinc-400">{status}</p>

              <p className="mt-1 text-2xl font-bold">{total}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <div className="flex flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-[#151515] px-3">
          <Search size={17} className="text-zinc-500" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search application review queue"
            placeholder="Search jobs, companies, recipients or documents..."
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter application packages by status"
          className="h-11 rounded-lg border border-zinc-800 bg-[#151515] px-3 text-sm outline-none"
        >
          <option value="All">All statuses</option>

          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {statusFilter !== "All" && (
          <button
            type="button"
            onClick={() => setStatusFilter("All")}
            className="h-11 rounded-lg border border-zinc-800 px-4 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            Clear filter
          </button>
        )}
      </div>

      {!isLoadingDocuments && cvs.length === 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-300" />

          <div>
            <p className="text-sm font-medium text-amber-200">
              No CV is available
            </p>

            <p className="mt-1 text-sm text-amber-200/70">
              Import at least one CV before creating an application package.
            </p>

            <Link
              to="/resume-library"
              className="mt-3 inline-flex text-sm font-medium text-amber-100 underline"
            >
              Open Resume Library
            </Link>
          </div>
        </div>
      )}

      {filteredQueue.length === 0 ? (
        <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#111111] px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
            <ClipboardCheck size={24} className="text-zinc-400" />
          </div>

          <h2 className="mt-5 text-lg font-semibold">
            {queue.length === 0
              ? "Your review queue is empty"
              : "No matching packages"}
          </h2>

          <p className="mt-2 max-w-md text-sm text-zinc-500">
            {queue.length === 0
              ? "Create an application package by choosing a saved job, CV and optional cover letter."
              : "Try changing the search or status filter."}
          </p>

          {queue.length === 0 && (
            <button
              type="button"
              onClick={openCreatePackage}
              className="mt-5 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Plus size={17} />
              Create your first package
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filteredQueue.map((applicationPackage) => {
            const readiness = getPackageReadiness(applicationPackage);

            const isCreatingDraft =
              creatingDraftPackageId === applicationPackage.id;

            const draftCount = getDraftCount(applicationPackage);

            const packageCoverLetter =
              documents.find(
                (document) =>
                  document.id ===
                  applicationPackage.coverLetterId,
              ) || null;

            return (
              <article
                key={applicationPackage.id}
                className="rounded-xl border border-zinc-800 bg-[#151515] p-5 transition hover:border-zinc-700"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-zinc-100">
                        {applicationPackage.jobRole}
                      </h2>

                      <StatusBadge status={applicationPackage.status} />

                      <ReadinessBadge readiness={readiness} />

                      {applicationPackage.createdFromAssistant && (
                        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                          <Sparkles size={13} />
                          AI tailored
                          {Number(applicationPackage.matchScore || 0) > 0
                            ? ` • ${applicationPackage.matchScore}%`
                            : ""}
                        </span>
                      )}

                      {draftCount > 0 && <GmailDraftBadge count={draftCount} />}
                    </div>

                    <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                      <Briefcase size={15} />

                      {applicationPackage.company}
                    </p>

                    {applicationPackage.gmailDraftCreatedAt && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                        <Mail size={13} />
                        Latest Gmail draft created{" "}
                        {formatDateTime(applicationPackage.gmailDraftCreatedAt)}
                      </p>
                    )}

                    {applicationPackage.sentAt && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-sky-300">
                        <Send size={13} />
                        Sent {formatDateTime(applicationPackage.sentAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditPackage(applicationPackage)}
                      title="Edit application package"
                      className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                    >
                      <Pencil size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => requestDeletePackage(applicationPackage)}
                      title="Delete application package"
                      className="rounded-lg p-2 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Recipient
                    </p>

                    <p className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
                      <UserRound size={15} />

                      {applicationPackage.recipientName || "Hiring Team"}
                    </p>

                    <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                      <Mail size={15} />

                      {applicationPackage.recipientEmail || "No email entered"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Documents
                    </p>

                    <p className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
                      <FileText size={15} />
                      CV: {applicationPackage.cvTitle}
                    </p>

                    <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                      <FileText size={15} />

                      {applicationPackage.coverLetterTitle
                        ? `Cover letter: ${applicationPackage.coverLetterTitle}`
                        : "No cover letter selected"}
                    </p>

                    {["JobPilot", "BreakVeil"].includes(
                      packageCoverLetter?.generatedBy,
                    ) && (
                      <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                        <Sparkles size={13} />
                        Generated by BreakVeil
                        {packageCoverLetter.generatedFormat
                          ? ` • ${packageCoverLetter.generatedFormat.toUpperCase()}`
                          : ""}
                      </span>
                    )}

                    {applicationPackage.coverLetterId && (
                      <button
                        type="button"
                        onClick={() =>
                          openPackageDocument(
                            applicationPackage.coverLetterId,
                          )
                        }
                        className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                      >
                        <ExternalLink size={14} />
                        Open cover letter
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Email subject
                  </p>

                  <p className="mt-3 text-sm text-zinc-300">
                    {applicationPackage.emailSubject || "No subject entered"}
                  </p>
                </div>

                {applicationPackage.emailBody && (
                  <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Email preview
                    </p>

                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                      {applicationPackage.emailBody}
                    </p>
                  </div>
                )}

                {applicationPackage.tailoredCoverLetter && (
                  <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-violet-300" />

                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                        AI-tailored cover letter
                      </p>
                    </div>

                    <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                      {applicationPackage.tailoredCoverLetter}
                    </p>

                    <p className="mt-3 text-xs text-zinc-600">
                      This text is saved in BreakVeil. Export it from the AI
                      Assistant, then use Import exported cover letter while
                      editing this package to attach the Word or PDF version.
                    </p>
                  </div>
                )}

                {applicationPackage.notes && (
                  <p className="mt-4 rounded-lg bg-zinc-900/70 p-3 text-sm text-zinc-400">
                    {applicationPackage.notes}
                  </p>
                )}

                <ReadinessPanel readiness={readiness} compact />

                {applicationPackage.status !== "Draft" &&
                  applicationPackage.status !== "Sent" && (
                    <div className="mt-4">
                      <ApplicationReviewChecklist
                        readiness={readiness}
                        compact
                        onToggle={(reviewId, checked) =>
                          updateReviewAcknowledgement(
                            applicationPackage.id,
                            reviewId,
                            checked,
                          )
                        }
                      />
                    </div>
                  )}

                <div className="mt-5 flex flex-col justify-between gap-4 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center">
                  <p className="text-xs text-zinc-600">
                    Updated {formatDateTime(applicationPackage.updatedAt)}
                  </p>

                  <PackageActions
                    applicationPackage={applicationPackage}
                    readiness={readiness}
                    gmailConnected={gmailStatus.connected}
                    isCreatingDraft={isCreatingDraft}
                    draftCount={draftCount}
                    onChangeStatus={changePackageStatus}
                    onCreateGmailDraft={createPackageGmailDraft}
                    onOpenGmailDrafts={openGmailDrafts}
                    onCopyEmail={copyApplicationEmail}
                    onRequestSent={requestMarkPackageSent}
                    onRequestReopen={requestReturnToApproved}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeForm}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingPackageId
                    ? "Edit application package"
                    : "Create application package"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Complete the application and check its readiness before
                  review.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={submitPackage} className="p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Job" required>
                  <select
                    required
                    value={form.jobId}
                    onChange={(event) => selectJob(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose a saved job</option>

                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.role} — {job.company}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="CV" required>
                  <select
                    required
                    value={form.cvId}
                    onChange={(event) => updateForm("cvId", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose a CV</option>

                    {cvs.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}

                        {document.isDefault ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Cover letter">
                  <div className="space-y-2">
                    <select
                      value={form.coverLetterId}
                      onChange={(event) =>
                        updateForm("coverLetterId", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">No cover letter</option>

                      {coverLetters.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.title}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isImportingCoverLetter}
                      onClick={importCoverLetterForForm}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isImportingCoverLetter ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <FileUp size={15} />
                      )}

                      {isImportingCoverLetter
                        ? "Importing cover letter"
                        : "Import exported cover letter"}
                    </button>

                    <p className="text-xs leading-5 text-zinc-600">
                      AI Assistant packages select their generated letter
                      automatically. This import button remains available for
                      manually created or externally edited cover letters.
                    </p>
                  </div>
                </Field>
              </div>

              <div className="mt-7">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Recipient details
                </h3>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Contact name">
                    <input
                      value={form.recipientName}
                      onChange={(event) =>
                        updateForm("recipientName", event.target.value)
                      }
                      placeholder="Hiring Manager or recruiter"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Recipient email">
                    <input
                      type="email"
                      value={form.recipientEmail}
                      onChange={(event) =>
                        updateForm("recipientEmail", event.target.value)
                      }
                      placeholder="recruitment@example.com"
                      className={inputClass}
                    />
                  </Field>
                </div>

                {!form.recipientEmail && (
                  <p className="mt-3 text-xs text-zinc-500">
                    You may save the package as a Draft without an email, but it
                    cannot move to review until one is entered.
                  </p>
                )}
              </div>

              <div className="mt-7 space-y-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Application email
                </h3>

                <Field label="Email subject">
                  <input
                    value={form.emailSubject}
                    onChange={(event) =>
                      updateForm("emailSubject", event.target.value)
                    }
                    placeholder="Application for..."
                    className={inputClass}
                  />
                </Field>

                <Field label="Email message">
                  <textarea
                    rows="10"
                    value={form.emailBody}
                    onChange={(event) =>
                      updateForm("emailBody", event.target.value)
                    }
                    placeholder="Write the application email..."
                    className={textareaClass}
                  />
                </Field>

                <Field label="Internal notes">
                  <textarea
                    rows="4"
                    value={form.notes}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    placeholder="Anything you want to review before approving..."
                    className={textareaClass}
                  />
                </Field>
              </div>

              <div className="mt-7 space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-violet-300" />

                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                      AI-tailored content
                    </h3>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-zinc-600">
                    Content transferred from the AI Assistant remains fully
                    editable. The cover-letter text is stored in BreakVeil;
                    choose a Resume Library cover-letter file separately when
                    you need an attachment.
                  </p>
                </div>

                <Field label="Tailored cover letter">
                  <textarea
                    rows="14"
                    value={form.tailoredCoverLetter}
                    onChange={(event) =>
                      updateForm("tailoredCoverLetter", event.target.value)
                    }
                    placeholder="A tailored cover letter from the AI Assistant will appear here."
                    className={textareaClass}
                  />
                </Field>

                <Field label="Suggested CV profile">
                  <textarea
                    rows="6"
                    value={form.tailoredCvSummary}
                    onChange={(event) =>
                      updateForm("tailoredCvSummary", event.target.value)
                    }
                    placeholder="Suggested CV profile wording..."
                    className={textareaClass}
                  />
                </Field>

                <Field label="Vacancy keywords">
                  <textarea
                    rows="4"
                    value={form.tailoringKeywords}
                    onChange={(event) =>
                      updateForm("tailoringKeywords", event.target.value)
                    }
                    placeholder="Relevant vacancy keywords..."
                    className={textareaClass}
                  />
                </Field>
              </div>

              <ReadinessPanel readiness={formReadiness} />

              <div className="mt-6 flex flex-col-reverse justify-end gap-3 border-t border-zinc-800 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  {editingPackageId ? "Save as Draft" : "Create Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(packagePendingSent)}
        title="Confirm application was sent?"
        message={
          packagePendingSent
            ? `Only confirm after you have sent the application for ${packagePendingSent.jobRole} at ${packagePendingSent.company} through Gmail or another email provider. BreakVeil will mark the package as Sent and move the linked job to Applied.`
            : ""
        }
        confirmLabel="Confirm sent"
        cancelLabel="Not yet"
        onConfirm={confirmMarkPackageSent}
        onCancel={cancelMarkPackageSent}
      />

      <ConfirmDialog
        open={Boolean(packagePendingReopen)}
        title="Reopen this application?"
        message={
          packagePendingReopen
            ? `The application for ${packagePendingReopen.jobRole} at ${packagePendingReopen.company} will reopen. It returns to Approved only when its human review confirmations are complete; otherwise it returns to review.`
            : ""
        }
        confirmLabel="Reopen Application"
        cancelLabel="Keep as Sent"
        onConfirm={confirmReturnToApproved}
        onCancel={cancelReturnToApproved}
      />

      <ConfirmDialog
        open={Boolean(packagePendingDeletion)}
        title="Delete this application package?"
        message={
          packagePendingDeletion
            ? `${packagePendingDeletion.jobRole} at ${packagePendingDeletion.company} will be permanently removed from BreakVeil.${getDraftCount(packagePendingDeletion) > 0 ? ` Its ${getDraftCount(packagePendingDeletion)} Gmail draft${getDraftCount(packagePendingDeletion) === 1 ? "" : "s"} will remain in Gmail.` : ""}`
            : ""
        }
        confirmLabel="Delete package"
        cancelLabel="Keep package"
        danger
        onConfirm={confirmDeletePackage}
        onCancel={cancelDeletePackage}
      />
    </div>
  );
}

function ReadinessPanel({ readiness, compact = false }) {
  return (
    <section
      className={[
        "rounded-xl border",

        compact ? "mt-4 p-4" : "mt-7 p-5",

        readiness.ready
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      ].join(" ")}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold">Application readiness</p>

          <p className="mt-1 text-sm text-zinc-500">
            {readiness.passedCount} of {readiness.totalCount} checks completed
          </p>
        </div>

        <ReadinessBadge readiness={readiness} />
      </div>

      <div
        className={[
          "mt-4 grid gap-2",

          compact ? "sm:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2",
        ].join(" ")}
      >
        {readiness.checks.map((check) => (
          <div
            key={check.id}
            className={[
              "flex items-start gap-3 rounded-lg border px-3 py-3",

              check.passed
                ? "border-emerald-500/10 bg-emerald-500/5"
                : "border-zinc-800 bg-zinc-900/50",
            ].join(" ")}
          >
            {check.passed ? (
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-emerald-300"
              />
            ) : (
              <CircleAlert
                size={16}
                className="mt-0.5 shrink-0 text-amber-300"
              />
            )}

            <div>
              <p
                className={[
                  "text-sm",

                  check.passed ? "text-emerald-200" : "text-zinc-300",
                ].join(" ")}
              >
                {check.label}
              </p>

              {!check.passed && !compact && (
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {check.help}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadinessBadge({ readiness }) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",

        readiness.ready
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/20 bg-amber-500/10 text-amber-300",
      ].join(" ")}
    >
      {readiness.ready ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}

      {readiness.ready
        ? "Ready"
        : `${readiness.totalCount - readiness.passedCount} incomplete`}
    </span>
  );
}

function GmailDraftBadge({ count }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
      <Mail size={13} />
      {count} Gmail draft
      {count === 1 ? "" : "s"} created
    </span>
  );
}

function PackageActions({
  applicationPackage,
  readiness,
  gmailConnected,
  isCreatingDraft,
  draftCount,
  onChangeStatus,
  onCreateGmailDraft,
  onOpenGmailDrafts,
  onCopyEmail,
  onRequestSent,
  onRequestReopen,
}) {
  if (applicationPackage.status === "Draft") {
    return (
      <button
        type="button"
        disabled={!readiness.readyForReview}
        onClick={() =>
          onChangeStatus(applicationPackage.id, "Ready for Review")
        }
        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
      >
        <Clock3 size={15} />

        {readiness.readyForReview
          ? "Send to review"
          : "Complete readiness checks"}
      </button>
    );
  }

  if (applicationPackage.status === "Ready for Review") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChangeStatus(applicationPackage.id, "Draft")}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          Return to draft
        </button>

        <button
          type="button"
          disabled={!readiness.readyForApproval}
          onClick={() => onChangeStatus(applicationPackage.id, "Approved")}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          <ShieldCheck size={15} />

          {readiness.readyForApproval
            ? "Approve package"
            : "Complete human review"}
        </button>
      </div>
    );
  }

  if (applicationPackage.status === "Approved") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {gmailConnected ? (
          <button
            type="button"
            disabled={isCreatingDraft || !readiness.readyForApproval}
            onClick={() => onCreateGmailDraft(applicationPackage)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isCreatingDraft ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Mail size={15} />
            )}

            {isCreatingDraft
              ? "Creating Gmail draft"
              : draftCount > 0
                ? "Create another Gmail draft"
                : "Create Gmail draft"}
          </button>
        ) : (
          <Link
            to="/automation"
            className="flex items-center gap-2 rounded-lg border border-amber-500/20 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/10"
          >
            <Mail size={15} />
            Connect Gmail
          </Link>
        )}

        {gmailConnected && (
          <button
            type="button"
            onClick={onOpenGmailDrafts}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            <ExternalLink size={15} />
            Open drafts
          </button>
        )}

        <button
          type="button"
          onClick={() => onCopyEmail(applicationPackage)}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          <Copy size={15} />
          Copy email
        </button>

        <button
          type="button"
          onClick={() => onRequestSent(applicationPackage)}
          className="flex items-center gap-2 rounded-lg border border-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/10"
        >
          <Send size={15} />
          Mark as sent
        </button>

        <button
          type="button"
          onClick={() =>
            onChangeStatus(applicationPackage.id, "Ready for Review")
          }
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          Reopen review
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 flex items-center gap-2 text-sm text-sky-300">
        <Send size={16} />
        Sent {formatDateTime(applicationPackage.sentAt)}
      </span>

      {gmailConnected && (
        <button
          type="button"
          onClick={onOpenGmailDrafts}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          <ExternalLink size={15} />
          Open Gmail
        </button>
      )}

      <button
        type="button"
        onClick={() => onCopyEmail(applicationPackage)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
      >
        <Copy size={15} />
        Copy email
      </button>

      <button
        type="button"
        onClick={() => onRequestReopen(applicationPackage)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
      >
        <Undo2 size={14} />
        Return to Approved
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={[
        "rounded-full border px-2.5 py-1 text-xs font-medium",

        getPackageStatusClass(
          status,
        ),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500";

const textareaClass =
  "w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-500";

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}

        {required && <span className="ml-1 text-red-400">*</span>}
      </span>

      {children}
    </label>
  );
}

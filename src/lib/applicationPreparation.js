export const emptyReviewAcknowledgements = Object.freeze({
  vacancyReviewed: false,
  documentsReviewed: false,
  contentReviewed: false,
})

export const reviewAcknowledgementDefinitions = Object.freeze([
  {
    id: "vacancyReviewed",
    label: "I checked the job details",
    help: "The role, company and vacancy details match the job you want to apply for.",
  },
  {
    id: "documentsReviewed",
    label: "I opened and checked the documents",
    help: "The selected CV and any cover letter are the correct, up-to-date versions.",
  },
  {
    id: "contentReviewed",
    label: "I checked the message and answers",
    help: "The email and any application answers are accurate, honest and ready to use.",
  },
])

export function normaliseReviewAcknowledgements(value) {
  const source = value && typeof value === "object" ? value : {}

  return Object.fromEntries(
    reviewAcknowledgementDefinitions.map(({ id }) => [id, source[id] === true]),
  )
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())
}

export function buildApplicationPreparation({
  job,
  cv,
  coverLetterId,
  coverLetter,
  recipientEmail,
  emailSubject,
  emailBody,
  applicationAnswers,
  reviewAcknowledgements,
}) {
  const checks = [
    {
      id: "job",
      label: "Saved job selected",
      passed: Boolean(job),
      help: "Choose a job from your Jobs tracker.",
    },
    {
      id: "cv",
      label: "CV selected and available",
      passed: Boolean(cv && cv.category === "CV"),
      help: "Choose an available CV from the Resume Library.",
    },
    {
      id: "recipient",
      label: "Valid recipient email",
      passed: isValidEmail(recipientEmail),
      help: "Enter the employer or recruiter's email address.",
    },
    {
      id: "subject",
      label: "Email subject completed",
      passed: Boolean(String(emailSubject || "").trim()),
      help: "Enter a clear application email subject.",
    },
    {
      id: "body",
      label: "Email message completed",
      passed: String(emailBody || "").trim().length >= 20,
      help: "Write an application message of at least 20 characters.",
    },
  ]

  if (coverLetterId) {
    checks.push({
      id: "cover-letter",
      label: "Cover letter available",
      passed: Boolean(coverLetter),
      help: "The selected cover letter is no longer available.",
    })
  }

  if (Array.isArray(applicationAnswers) && applicationAnswers.length > 0) {
    checks.push({
      id: "application-answers",
      label: "Application answers completed",
      passed: applicationAnswers.every(
        (item) => String(item?.answer || "").trim().length >= 20,
      ),
      help: "Complete every saved application answer before review.",
    })
  }

  const acknowledgements = normaliseReviewAcknowledgements(
    reviewAcknowledgements,
  )

  const reviewChecks = reviewAcknowledgementDefinitions.map((definition) => ({
    ...definition,
    passed: acknowledgements[definition.id],
  }))

  const passedCount = checks.filter((check) => check.passed).length
  const reviewPassedCount = reviewChecks.filter((check) => check.passed).length
  const readyForReview = checks.every((check) => check.passed)
  const reviewComplete = reviewChecks.every((check) => check.passed)

  return {
    checks,
    passedCount,
    totalCount: checks.length,
    ready: readyForReview,
    readyForReview,
    acknowledgements,
    reviewChecks,
    reviewPassedCount,
    reviewTotalCount: reviewChecks.length,
    reviewComplete,
    readyForApproval: readyForReview && reviewComplete,
  }
}

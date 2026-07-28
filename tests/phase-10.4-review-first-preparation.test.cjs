const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const root = path.resolve(__dirname, "..")

async function preparationModule() {
  return import(
    pathToFileURL(path.join(root, "src/lib/applicationPreparation.js")).href
  )
}

function completeApplication(overrides = {}) {
  return {
    job: { id: "job-1" },
    cv: { id: "cv-1", category: "CV" },
    coverLetterId: "",
    coverLetter: null,
    recipientEmail: "hiring@example.com",
    emailSubject: "Application for Administrator",
    emailBody: "Please consider my application for this position.",
    applicationAnswers: [],
    reviewAcknowledgements: {},
    ...overrides,
  }
}

test("mechanical checks must pass before a package enters review", async () => {
  const { buildApplicationPreparation } = await preparationModule()
  const readiness = buildApplicationPreparation(
    completeApplication({ cv: null, recipientEmail: "not-an-email" }),
  )

  assert.equal(readiness.readyForReview, false)
  assert.equal(readiness.readyForApproval, false)
})

test("complete fields can enter review but cannot skip human approval", async () => {
  const { buildApplicationPreparation } = await preparationModule()
  const readiness = buildApplicationPreparation(completeApplication())

  assert.equal(readiness.readyForReview, true)
  assert.equal(readiness.reviewComplete, false)
  assert.equal(readiness.readyForApproval, false)
})

test("all explicit human checks unlock approval", async () => {
  const { buildApplicationPreparation } = await preparationModule()
  const readiness = buildApplicationPreparation(
    completeApplication({
      reviewAcknowledgements: {
        vacancyReviewed: true,
        documentsReviewed: true,
        contentReviewed: true,
      },
    }),
  )

  assert.equal(readiness.reviewPassedCount, 3)
  assert.equal(readiness.readyForApproval, true)
})

test("a missing selected cover letter and blank generated answer block review", async () => {
  const { buildApplicationPreparation } = await preparationModule()
  const readiness = buildApplicationPreparation(
    completeApplication({
      coverLetterId: "missing-letter",
      applicationAnswers: [{ prompt: "Why this role?", answer: "" }],
    }),
  )

  assert.equal(readiness.readyForReview, false)
  assert.equal(
    readiness.checks.find((check) => check.id === "cover-letter").passed,
    false,
  )
  assert.equal(
    readiness.checks.find((check) => check.id === "application-answers").passed,
    false,
  )
})

test("acknowledgements only accept real boolean true values", async () => {
  const { normaliseReviewAcknowledgements } = await preparationModule()
  const result = normaliseReviewAcknowledgements({
    vacancyReviewed: "true",
    documentsReviewed: 1,
    contentReviewed: true,
  })

  assert.deepEqual(result, {
    vacancyReviewed: false,
    documentsReviewed: false,
    contentReviewed: true,
  })
})

test("both application screens use the shared review-first gate", () => {
  const queue = fs.readFileSync(
    path.join(root, "src/pages/ApplicationQueue.jsx"),
    "utf8",
  )
  const workspace = fs.readFileSync(
    path.join(root, "src/pages/JobWorkspace.jsx"),
    "utf8",
  )
  const checklist = fs.readFileSync(
    path.join(root, "src/components/ApplicationReviewChecklist.jsx"),
    "utf8",
  )

  for (const source of [queue, workspace]) {
    assert.match(source, /buildApplicationPreparation/)
    assert.match(source, /readyForApproval/)
    assert.match(source, /ApplicationReviewChecklist/)
  }

  assert.match(checklist, /never submits it for you/)
  assert.doesNotMatch(checklist, /fetch\(|\.send\(|submitApplication/)
})

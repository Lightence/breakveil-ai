const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const root = path.resolve(__dirname, "..")

async function healthModule() {
  return import(pathToFileURL(path.join(root, "src/lib/projectHealth.js")).href)
}

async function schemaModule() {
  return import(pathToFileURL(path.join(root, "src/lib/dataSchema.js")).href)
}

function healthyInput(overrides = {}) {
  return {
    checkedAt: "2026-07-28T14:00:00.000Z",
    currentSchemaVersion: 2,
    schemaMetadata: { version: 2 },
    schemaValidation: { issueCount: 0 },
    backupStatus: {
      automaticBackupCount: 2,
      settings: { automaticFrequency: "daily" },
    },
    recoveryStatus: {
      quarantineCount: 1,
      documentIntegrity: { issueCount: 0, critical: false },
      safeMode: { active: false },
    },
    migrationStatus: { snapshotCount: 1 },
    encryptionAvailable: true,
    bridges: {
      dataManagement: true,
      dataRecovery: true,
      dataMigrations: true,
      documents: true,
      jobSources: true,
    },
    ...overrides,
  }
}

test("reports a healthy project when every critical safeguard passes", async () => {
  const { buildProjectHealthReport } = await healthModule()
  const report = buildProjectHealthReport(healthyInput())

  assert.equal(report.overallStatus, "healthy")
  assert.equal(report.summary.failedCount, 0)
  assert.equal(report.summary.warningCount, 0)
})

test("disabled automatic backups are a note, not a false critical failure", async () => {
  const { buildProjectHealthReport } = await healthModule()
  const report = buildProjectHealthReport(
    healthyInput({
      backupStatus: {
        automaticBackupCount: 0,
        settings: { automaticFrequency: "disabled" },
      },
    }),
  )

  assert.equal(report.overallStatus, "ready-with-notes")
  assert.equal(
    report.checks.find((item) => item.id === "automatic-backups").status,
    "warning",
  )
})

test("schema, encryption and protected-service failures need attention", async () => {
  const { buildProjectHealthReport } = await healthModule()
  const report = buildProjectHealthReport(
    healthyInput({
      schemaMetadata: { version: 1 },
      encryptionAvailable: false,
      bridges: {},
    }),
  )

  assert.equal(report.overallStatus, "needs-attention")
  assert.ok(report.summary.failedCount >= 3)
})

test("copied diagnostics cannot carry personal values supplied by services", async () => {
  const {
    buildProjectHealthReport,
    formatPrivacySafeDiagnostics,
  } = await healthModule()
  const secret = "sk-secret-never-copy"
  const email = "private.person@example.com"
  const localPath = "C:\\Users\\Private Person\\Documents\\My CV.pdf"
  const report = buildProjectHealthReport(
    healthyInput({
      backupStatus: {
        ...healthyInput().backupStatus,
        email,
        path: localPath,
        error: secret,
      },
      recoveryStatus: {
        ...healthyInput().recoveryStatus,
        jobTitle: "Secret Company Administrator",
        error: secret,
      },
    }),
  )
  const copied = formatPrivacySafeDiagnostics(report)

  assert.doesNotMatch(copied, /sk-secret-never-copy/)
  assert.doesNotMatch(copied, /private\.person@example\.com/)
  assert.doesNotMatch(copied, /Private Person|My CV|Secret Company/)
  assert.match(copied, /status flags and counts only/)
})

test("schema v2 adds review records and reopens unconfirmed approvals", async () => {
  const {
    currentDataSchemaVersion,
    repairDataSnapshot,
  } = await schemaModule()
  const result = repairDataSnapshot({
    "jobpilot.application-queue": JSON.stringify([
      { id: "approved", status: "Approved" },
      {
        id: "draft",
        status: "Draft",
        reviewAcknowledgements: {
          vacancyReviewed: true,
          documentsReviewed: true,
          contentReviewed: true,
        },
      },
      { id: "sent", status: "Sent" },
    ]),
  })
  const queue = JSON.parse(result.snapshot["jobpilot.application-queue"])

  assert.equal(currentDataSchemaVersion, 2)
  assert.equal(queue[0].status, "Ready for Review")
  assert.deepEqual(queue[0].reviewAcknowledgements, {
    vacancyReviewed: false,
    documentsReviewed: false,
    contentReviewed: false,
  })
  assert.equal(queue[1].reviewAcknowledgements.vacancyReviewed, false)
  assert.equal(queue[2].status, "Sent")
  assert.equal(result.summary.approvalsReopened, 1)
  assert.equal(result.validation.issueCount, 0)
})

test("health UI is wired and release security settings remain enabled", () => {
  const privacy = fs.readFileSync(
    path.join(root, "src/components/DataPrivacySettings.jsx"),
    "utf8",
  )
  const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8")
  const builder = fs.readFileSync(path.join(root, "electron-builder.yml"), "utf8")

  assert.match(privacy, /Project Health Check/)
  assert.match(privacy, /Copy Safe Report/)
  assert.match(privacy, /formatPrivacySafeDiagnostics/)
  assert.match(main, /contextIsolation:\s*true/)
  assert.match(main, /nodeIntegration:\s*false/)
  assert.match(main, /sandbox:\s*true/)
  assert.match(builder, /deleteAppDataOnUninstall:\s*false/)
})

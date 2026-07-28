const test = require("node:test")
const assert = require("node:assert/strict")
const {
  canonicalCompany,
  canonicalTitle,
  canonicalUrl,
  evidence,
  deduplicateJobs,
} = require("../electron/job-duplicate-detection.cjs")

function job(overrides = {}) {
  const source = overrides.source || "adzuna"
  const providerId = overrides.providerId || "1"
  const sourceName = overrides.sourceName || source
  const applyUrl = overrides.applyUrl || `https://example.com/jobs/${providerId}`
  return {
    id: `${source}:${providerId}`, providerId, source, sourceName,
    title: "Software Engineer", company: "Example Limited", location: "London, UK",
    description: "Build reliable customer products with our engineering team using JavaScript and cloud services.",
    postedAt: "2026-07-20T10:00:00Z", applyUrl, url: applyUrl, isRemote: false,
    sources: [source], sourceNames: [sourceName], duplicateCount: 1,
    sourceListings: [{ source, sourceName, providerId, applyUrl, url: applyUrl }],
    ...overrides,
  }
}

test("canonicalises harmless company/title variants and tracking URLs", () => {
  assert.equal(canonicalCompany("Example & Co. Limited"), "example and co")
  assert.equal(canonicalTitle("Sr. Software Eng. - Job Opportunity"), "senior software engineer")
  assert.equal(canonicalUrl("https://WWW.example.com/jobs/42/?utm_source=x&ref=board"), "https://example.com/jobs/42")
})

test("merges exact provider identities and aggregator/direct URL variants", () => {
  const first = job({ applyUrl: "https://jobs.example.com/roles/42?utm_source=adzuna" })
  first.sourceListings[0].applyUrl = first.applyUrl
  const direct = job({ source: "employer:example", sourceName: "Example (Greenhouse)", providerId: "42", applyUrl: "https://jobs.example.com/roles/42", description: "Full description. ".repeat(80) })
  direct.sourceListings[0] = { source: direct.source, sourceName: direct.sourceName, providerId: "42", applyUrl: direct.applyUrl, url: direct.applyUrl }
  const merged = deduplicateJobs([first, direct])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].duplicateCount, 2)
  assert.equal(merged[0].sourceListings.length, 2)
  assert.equal(merged[0].description, direct.description)
})

test("matches minor variants only with multiple compatible signals", () => {
  const variant = job({ source: "jooble", providerId: "2", title: "Software Eng", company: "Example Ltd.", location: "London", applyUrl: "https://board.test/2" })
  assert.equal(evidence(job(), variant).tier, "probable")
  assert.equal(deduplicateJobs([job(), variant]).length, 1)
})

test("keeps common roles separate across seniority, location, date and description", () => {
  const base = job()
  const senior = job({ providerId: "2", title: "Senior Software Engineer", applyUrl: "https://board.test/2" })
  const otherLocation = job({ providerId: "3", location: "Manchester", applyUrl: "https://board.test/3" })
  const unrelated = job({ providerId: "4", description: "Manage payroll, invoices, tax and financial reporting for the accounting department.", postedAt: "2025-01-01", applyUrl: "https://board.test/4" })
  assert.equal(deduplicateJobs([base, senior, otherLocation, unrelated]).length, 4)
})

test("does not merge different requisitions from the same source", () => {
  const first = job({ source: "reed", providerId: "100", applyUrl: "https://reed.example/jobs/100" })
  const second = job({ source: "reed", providerId: "101", applyUrl: "https://reed.example/jobs/101" })
  const separate = deduplicateJobs([first, second])
  assert.equal(separate.length, 2)
  assert.notEqual(separate[0].id, separate[1].id)
})

test("allows remote labels to merge only when remote state is compatible", () => {
  const first = job({ location: "Remote - United Kingdom", isRemote: true })
  const second = job({ source: "jooble", providerId: "2", location: "Remote", isRemote: true, applyUrl: "https://other.test/2" })
  assert.equal(deduplicateJobs([first, second]).length, 1)
})

test("merges three sources with deterministic provenance, id and output", () => {
  const jobs = [
    job({ source: "reed", sourceName: "Reed", providerId: "r1" }),
    job({ source: "adzuna", sourceName: "Adzuna", providerId: "a1" }),
    job({ source: "jooble", sourceName: "Jooble", providerId: "j1" }),
  ]
  const first = deduplicateJobs(jobs)
  const shuffled = deduplicateJobs([jobs[2], jobs[0], jobs[1]])
  assert.equal(first.length, 1)
  assert.equal(first[0].duplicateCount, 3)
  assert.deepEqual(first, shuffled)
  assert.match(first[0].id, /^job:[a-f0-9]{20}$/)
})

test("bounds unusually large hostile descriptions", () => {
  const huge = "alpha beta gamma <script>alert(1)</script> ".repeat(100000)
  const first = job({ description: huge })
  const second = job({ source: "jooble", providerId: "2", applyUrl: "https://board.test/2", description: huge })
  assert.equal(evidence(first, second).match, true)
})

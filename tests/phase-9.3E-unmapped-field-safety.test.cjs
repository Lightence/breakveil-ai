const assert = require("node:assert/strict")
const test = require("node:test")

const {
  getPathValue,
} = require("../electron/custom-job-sources.cjs").__testing

test("an empty optional field mapping returns undefined", () => {
  const sanitisedJob = Object.create(null)
  sanitisedJob.jobTitle = "Administrator"
  sanitisedJob.jobGeo = "UK"

  assert.equal(
    getPathValue(sanitisedJob, ""),
    undefined,
  )
})

test("blank mappings never expose the whole untrusted object for text coercion", () => {
  const sanitisedJob = Object.create(null)
  sanitisedJob.jobTitle = "Administrator"

  const value = getPathValue(
    sanitisedJob,
    "",
  )

  assert.doesNotThrow(() => {
    String(value || "")
  })
})

test("configured field mappings still return their primitive value", () => {
  const sanitisedJob = Object.create(null)
  sanitisedJob.jobTitle = "Administrator"
  sanitisedJob.company = Object.create(null)
  sanitisedJob.company.name = "Example Ltd"

  assert.equal(
    getPathValue(
      sanitisedJob,
      "jobTitle",
    ),
    "Administrator",
  )

  assert.equal(
    getPathValue(
      sanitisedJob,
      "company.name",
    ),
    "Example Ltd",
  )
})

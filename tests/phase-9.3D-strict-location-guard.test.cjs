const assert = require("node:assert/strict")
const test = require("node:test")

const {
  buildStrictLocationSkipNotice,
  findMappedSearchFieldWithRejectedValue,
  findRejectedSearchParameterValue,
} = require("../electron/custom-job-sources.cjs").__testing

test("detects a quoted parameter whose runtime value was rejected", () => {
  const error =
    `Jobicy returned error 400: {"success":false,"error":"Invalid 'geo' value. This value must contain a predefined 'geoSlug'."}`

  assert.equal(
    findRejectedSearchParameterValue(error),
    "geo",
  )
})

test("matches a rejected strict value to the connector location field", () => {
  const result =
    findMappedSearchFieldWithRejectedValue(
      {
        keywords: "tag",
        location: "geo",
        page: "",
        limit: "count",
      },
      "Invalid 'geo' value. This value must contain a predefined 'geoSlug'.",
    )

  assert.deepEqual(
    result,
    {
      rejectedParameter: "geo",
      rejectedField: "location",
    },
  )
})

test("does not misclassify an unrelated rejected value as location", () => {
  const result =
    findMappedSearchFieldWithRejectedValue(
      {
        keywords: "tag",
        location: "geo",
        page: "",
        limit: "count",
      },
      "Invalid 'count' value.",
    )

  assert.equal(
    result.rejectedField,
    "limit",
  )
})

test("builds a clear soft-skip notice without exposing the provider error", () => {
  const notice =
    buildStrictLocationSkipNotice(
      "Jobicy Custom Test",
      "Preston",
    )

  assert.match(
    notice,
    /Skipped for “Preston”/,
  )
  assert.match(
    notice,
    /predefined provider values/,
  )
  assert.doesNotMatch(
    notice,
    /error 400/i,
  )
})

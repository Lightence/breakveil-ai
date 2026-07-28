const test = require("node:test")
const assert = require("node:assert/strict")

const {
  __testing,
} = require("../electron/custom-job-sources.cjs")

const {
  findRejectedSearchParameter,
  normaliseOptionalSearchParameters,
  removeRejectedSearchParameter,
} = __testing

test("blank optional parameter mappings remain blank", () => {
  assert.deepEqual(
    normaliseOptionalSearchParameters({
      keywordParameter: "tag",
      locationParameter: "geo",
      pageParameter: "",
      limitParameter: "count",
    }),
    {
      keywords: "tag",
      location: "geo",
      page: "",
      limit: "count",
    },
  )
})

test("omitted optional parameter mappings are deny-by-default", () => {
  assert.deepEqual(
    normaliseOptionalSearchParameters({}),
    {
      keywords: "",
      location: "",
      page: "",
      limit: "",
    },
  )
})

test("extracts a quoted unsupported parameter from an API error", () => {
  assert.equal(
    findRejectedSearchParameter(
      `Jobicy returned error 400: {"error":"Unexpected parameter 'page'."}`,
    ),
    "page",
  )
})

test("removes only the rejected optional parameter", () => {
  const repaired = removeRejectedSearchParameter(
    {
      keywords: "tag",
      location: "geo",
      page: "page",
      limit: "count",
    },
    "Unexpected parameter 'page'.",
  )

  assert.equal(repaired.removedField, "page")
  assert.equal(repaired.rejectedParameter, "page")
  assert.deepEqual(repaired.searchParameters, {
    keywords: "tag",
    location: "geo",
    page: "",
    limit: "count",
  })
})

test("does not alter parameters for an unrelated API error", () => {
  const original = {
    keywords: "tag",
    location: "geo",
    page: "",
    limit: "count",
  }
  const repaired = removeRejectedSearchParameter(
    original,
    "The provider is temporarily unavailable.",
  )

  assert.equal(repaired.removedField, "")
  assert.deepEqual(repaired.searchParameters, original)
})

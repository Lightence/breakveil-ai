const test = require("node:test")
const assert = require("node:assert/strict")

const {
  __testing,
} = require("../electron/custom-job-sources.cjs")

const {
  createCapabilityProbeQuery,
} = __testing

test("custom connector capability probes do not invent keyword or location values", () => {
  assert.deepEqual(
    createCapabilityProbeQuery(),
    {
      keywords: "",
      location: "",
      page: 1,
      resultsPerSource: 3,
    },
  )
})

test("neutral probe values stay absent when optional filter parameters are mapped", () => {
  const probe = createCapabilityProbeQuery()
  const mappedValues = {}
  const searchParameters = {
    keywords: "tag",
    location: "geo",
    page: "",
    limit: "count",
  }

  if (searchParameters.keywords && probe.keywords) {
    mappedValues[searchParameters.keywords] = probe.keywords
  }

  if (searchParameters.location && probe.location) {
    mappedValues[searchParameters.location] = probe.location
  }

  if (searchParameters.page) {
    mappedValues[searchParameters.page] = String(probe.page || 1)
  }

  if (searchParameters.limit) {
    mappedValues[searchParameters.limit] = String(probe.resultsPerSource)
  }

  assert.deepEqual(mappedValues, {
    count: "3",
  })
})

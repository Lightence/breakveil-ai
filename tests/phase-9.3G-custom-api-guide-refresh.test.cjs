const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const componentPath = path.join(
  __dirname,
  "..",
  "src",
  "components",
  "CustomJobSourcesPanel.jsx",
)

const source = fs.readFileSync(componentPath, "utf8")

test("uses a professional title and descriptive summary", () => {
  assert.ok(source.includes("Custom API Connector Guide"))
  assert.ok(
    source.includes(
      "Configuration reference for API requests, authentication, search parameters, response mapping, testing, approval and connector security.",
    ),
  )
  assert.ok(!source.includes("A plain-English guide"))
})

test("removes test-specific locations and uses a neutral capital-city example", () => {
  assert.ok(!source.includes("Preston"))
  assert.ok(source.includes("London"))
  assert.ok(source.includes("free-text location field"))
  assert.ok(source.includes("region-only field"))
})

test("increases guide typography for readability", () => {
  assert.match(
    source,
    /className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl"/,
  )
  assert.match(
    source,
    /className="mt-1\.5 max-w-3xl text-sm leading-6 text-zinc-400"/,
  )
  assert.match(
    source,
    /className="mt-1\.5 text-sm leading-6 text-zinc-400"/,
  )
  assert.ok(!source.includes('text-[11px] text-violet-200'))
})

test("explains methods, mappings and approval as product documentation", () => {
  for (const expectedText of [
    "Use the provider&apos;s official API documentation as your reference",
    "Requests job data by adding supported search parameters",
    "Enter the path to the array containing the job records",
    "A successful test never enables live searches automatically",
    "API responses are treated as untrusted data",
  ]) {
    assert.ok(
      source.includes(expectedText),
      `Missing documentation text: ${expectedText}`,
    )
  }
})

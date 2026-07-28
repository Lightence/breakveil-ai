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

test("places an information guide opposite the advanced settings control", () => {
  const advancedIndex = source.indexOf(
    "Advanced request and field mapping",
  )
  const helpIndex = source.indexOf(
    'aria-label="Open Custom API Connector Guide"',
  )

  assert.notEqual(advancedIndex, -1)
  assert.notEqual(helpIndex, -1)
  assert.ok(helpIndex > advancedIndex)
  assert.match(source, /<Info size=\{16\} \/>/)
})

test("documents the custom API connector settings", () => {
  for (const expectedText of [
    "Custom API Connector Guide",
    "Request methods",
    "Authentication methods",
    "Search parameter configuration",
    "Response and field mapping",
    "Testing, approval and maintenance",
    "Connector security controls",
    "Configuration example",
  ]) {
    assert.ok(
      source.includes(expectedText),
      `Missing guide section: ${expectedText}`,
    )
  }
})

test("the guide behaves as an accessible dismissible dialog", () => {
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /aria-labelledby="custom-connector-guide-title"/)
  assert.match(source, /event\.key === "Escape"/)
  assert.match(source, /aria-label="Close Custom API Connector Guide"/)
})

test("the guide preserves the secure connector boundaries", () => {
  for (const protection of [
    "HTTPS is required",
    "private networks",
    "API keys and tokens are encrypted locally",
    "downloaded code is never executed",
    "Automatic Discovery",
  ]) {
    assert.ok(
      source.includes(protection),
      `Missing documented protection: ${protection}`,
    )
  }
})

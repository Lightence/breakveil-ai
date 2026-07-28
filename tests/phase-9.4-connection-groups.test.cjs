const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")

const projectRoot = path.resolve(__dirname, "..")

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8")
}

test("Connections page groups built-in sources and adds direct employer feeds", () => {
  const settings = read("src/pages/Settings.jsx")
  const customPanel = read("src/components/CustomJobSourcesPanel.jsx")
  const directPanel = read("src/components/DirectEmployerSourcesPanel.jsx")

  assert.match(settings, /function ConnectionGroup/)
  assert.match(settings, /Built-in Job Sources/)
  assert.match(settings, /<DirectEmployerSourcesPanel/)
  assert.match(customPanel, /collapsed/)
  assert.match(customPanel, /Add Custom Source/)
  assert.match(directPanel, /Direct Employer Feeds/)
  assert.match(directPanel, /Greenhouse/)
  assert.match(directPanel, /Lever/)
  assert.match(directPanel, /SmartRecruiters/)
  assert.match(directPanel, /Automatic Discovery remains off/)
})

test("main process and preload expose the narrow direct-employer bridge", () => {
  const main = read("electron/main.cjs")
  const preload = read("electron/preload.cjs")
  const search = read("electron/job-search-engine.cjs")
  const sources = read("electron/job-sources.cjs")

  assert.match(main, /createDirectEmployerSourceService/)
  assert.match(main, /directEmployerSources\.registerIpc/)
  assert.match(preload, /directEmployerSources:/)
  assert.match(preload, /direct-employer-sources:add-and-test/)
  assert.match(search, /isDirectEmployerSourceId/)
  assert.match(sources, /directEmployerSources\.getStatuses/)
})

test("renderer provider helpers accept direct-employer IDs", async () => {
  const moduleUrl = `${pathToFileURL(
    path.join(projectRoot, "src/lib/jobProviders.js"),
  ).href}?phase94=${Date.now()}`
  const providers = await import(moduleUrl)
  const sourceId =
    "employer:123e4567-e89b-12d3-a456-426614174000"

  assert.equal(providers.isDirectEmployerProviderId(sourceId), true)
  assert.equal(providers.isSupportedJobProviderId(sourceId), true)

  const merged = providers.mergeJobSourceMap({
    [sourceId]: {
      name: "Example Company Careers",
      configured: true,
      directEmployer: true,
      autoDiscoveryEnabled: false,
    },
  })

  assert.equal(merged[sourceId].directEmployer, true)
  assert.equal(merged[sourceId].name, "Example Company Careers")
})

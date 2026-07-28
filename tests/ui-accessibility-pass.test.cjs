const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const root = path.resolve(__dirname, "..")

function read(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  )
}

test("provides a keyboard skip link and named main navigation", () => {
  const layout = read("src/components/Layout.jsx")
  const sidebar = read("src/components/Sidebar.jsx")

  assert.match(layout, /getElementById\(/)
  assert.match(layout, /Skip to main content/)
  assert.match(layout, /id="jobpilot-main-content"/)
  assert.match(sidebar, /aria-label="Main navigation"/)
})

test("sidebar identity follows the saved Candidate Profile", () => {
  const sidebar = read("src/components/Sidebar.jsx")

  assert.match(sidebar, /jobpilot\.candidate-profile/)
  assert.match(sidebar, /profile\?\.preferredName/)
  assert.match(sidebar, /profile\?\.fullName/)
  assert.match(sidebar, /jobpilot:profile-updated/)
  assert.doesNotMatch(sidebar, />\s*Connor\s*</)
})

test("keeps a visible keyboard focus style for interactive controls", () => {
  const styles = read("src/index.css")

  assert.match(styles, /:focus-visible/)
  assert.match(styles, /outline: 2px solid/)
  assert.match(styles, /outline-offset: 3px/)
})

test("long profile and automation panels expose accessible toggles", () => {
  const profile = read("src/pages/Profile.jsx")
  const automation = read("src/pages/Automation.jsx")
  const discovery = read(
    "src/components/JobDiscoveryControlCard.jsx",
  )

  assert.match(profile, /aria-expanded=\{open\}/)
  assert.match(profile, /aria-label=\{`\$\{title\} fields`\}/)
  assert.match(automation, /aria-controls="approved-applications-content"/)
  assert.match(automation, /aria-controls="sending-activity-content"/)
  assert.match(discovery, /aria-controls="automatic-discovery-settings"/)
})

test("empty Smart Match stays compact unless the user chose otherwise", () => {
  const jobs = read("src/pages/Jobs.jsx")

  assert.match(jobs, /return loadDiscoveryResults\(\)\.length > 0/)
  assert.match(jobs, /aria-controls="smart-match-inbox-content"/)
  assert.match(jobs, /aria-label="Smart Match Inbox results"/)
})

test("default documents share a row at normal desktop widths", () => {
  const resumeLibrary = read("src/pages/ResumeLibrary.jsx")

  assert.match(
    resumeLibrary,
    /aria-label="Default application documents"/,
  )
  assert.match(resumeLibrary, /lg:grid-cols-2/)
})

test("review queue search and status filters have accessible names", () => {
  const queue = read("src/pages/ApplicationQueue.jsx")

  assert.match(queue, /aria-label="Search application review queue"/)
  assert.match(
    queue,
    /aria-label="Filter application packages by status"/,
  )
})

test("paired panels fill their grid row instead of leaving page gaps", () => {
  const styles = read("src/index.css")
  const dashboard = read("src/pages/Dashboard.jsx")
  const analytics = read("src/pages/Analytics.jsx")
  const assistant = read("src/pages/Assistant.jsx")
  const automation = read("src/pages/Automation.jsx")
  const dataSettings = read(
    "src/components/DataPrivacySettings.jsx",
  )

  assert.match(styles, /\.jp-grid-equal\s*\{/)
  assert.match(styles, /align-items: stretch !important/)
  assert.match(styles, /\.jp-grid-equal > \*/)
  assert.match(
    styles,
    /\.jp-grid-panels\s*\{[\s\S]*?align-items: stretch/,
  )
  assert.match(dashboard, /jp-grid-panels jp-grid-equal/)
  assert.match(analytics, /jp-grid-panels jp-grid-equal/)
  assert.match(assistant, /jp-grid-panels jp-grid-equal/)
  assert.match(automation, /jp-grid-panels jp-grid-equal/)
  assert.match(dataSettings, /jp-grid-equal mt-6 grid/)
})

test("tracked job controls are not nested inside a fake card button", () => {
  const jobs = read("src/pages/Jobs.jsx")

  assert.doesNotMatch(
    jobs,
    /<article\s+[\s\S]*?role="button"[\s\S]*?Open Workspace/,
  )
  assert.match(
    jobs,
    /aria-label=\{`Application status for \$\{job\.role/,
  )
})

test("search overlays, filters and invalid routes expose safe semantics", () => {
  const app = read("src/App.jsx")
  const jobs = read("src/pages/Jobs.jsx")
  const commandPalette = read(
    "src/components/CommandPalette.jsx",
  )

  assert.match(app, /path="\*"/)
  assert.match(app, /<Navigate/)
  assert.match(jobs, /aria-expanded=\{showAdvancedFilters\}/)
  assert.match(jobs, /aria-controls="live-search-advanced-filters"/)
  assert.match(commandPalette, /role="dialog"/)
  assert.match(commandPalette, /aria-modal="true"/)
  assert.match(commandPalette, /aria-label="Search BreakVeil"/)
})

test("desktop links and packaged content keep release security boundaries", () => {
  const main = read("electron/main.cjs")
  const index = read("index.html")
  const packageJson = read("package.json")

  assert.match(main, /SAFE_EXTERNAL_PROTOCOLS/)
  assert.match(main, /isSafeExternalUrl/)
  assert.match(main, /"will-navigate"/)
  assert.match(main, /&#10003;/)
  assert.match(index, /Content-Security-Policy/)
  assert.match(index, /object-src 'none'/)
  assert.match(packageJson, /"author": "BreakVeil"/)
  assert.doesNotMatch(packageJson, /@google-cloud\/local-auth/)
})

test("open-source releases include GPL and exclude private credentials", () => {
  const license = read("LICENSE")
  const packageJson = read("package.json")
  const packageLock = read("package-lock.json")
  const builder = read("electron-builder.yml")
  const gitignore = read(".gitignore")
  const credentialsExample = read(
    "electron/google/credentials.example.json",
  )
  const settings = read("src/pages/Settings.jsx")
  const releaseWorkflow = read(
    ".github/workflows/release.yml",
  )
  const readme = read("README.md")
  const signingPolicy = read("CODE_SIGNING_POLICY.md")
  const releaseNotes = read("RELEASE_NOTES.md")

  assert.match(license, /GNU GENERAL PUBLIC LICENSE/)
  assert.match(license, /Version 3, 29 June 2007/)
  assert.match(packageJson, /"license": "GPL-3\.0-only"/)
  assert.match(
    packageJson,
    /"package:win": "[^"]*--publish never"/,
  )
  assert.match(packageLock, /"license": "GPL-3\.0-only"/)
  assert.match(builder, /- LICENSE/)
  assert.match(builder, /- PRIVACY\.md/)
  assert.match(
    builder,
    /!electron\/google\/credentials\.json/,
  )
  assert.match(releaseWorkflow, /Publish Windows release/)
  assert.match(
    releaseWorkflow,
    /Private Google credentials were found inside the release package/,
  )
  assert.match(releaseWorkflow, /Get-FileHash/)
  assert.match(readme, /## Code signing policy/)
  assert.match(readme, /## Uninstall BreakVeil/)
  assert.match(signingPolicy, /Free code signing provided by/)
  assert.match(releaseNotes, /## Code signing policy/)
  assert.match(gitignore, /electron\/google\/credentials\.json/)
  assert.match(gitignore, /phase-\*-delivery\//)
  assert.match(credentialsExample, /YOUR_GOOGLE_OAUTH_CLIENT_ID/)
  assert.match(settings, /Open Source & Licence/)
  assert.match(settings, /GPL-3\.0-only/)
})

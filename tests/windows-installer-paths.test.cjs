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

test("Windows installer supports elevated custom destinations", () => {
  const builder = read(
    "electron-builder.yml",
  )

  assert.match(
    builder,
    /oneClick:\s*false/,
  )
  assert.match(
    builder,
    /perMachine:\s*true/,
  )
  assert.match(
    builder,
    /allowToChangeInstallationDirectory:\s*true/,
  )
  assert.match(
    builder,
    /include:\s*build\/installer\.nsh/,
  )
})

test("installer removes only clearly incomplete registrations", () => {
  const installer = read(
    "build/installer.nsh",
  )

  assert.match(
    installer,
    /customUnInstallCheck/,
  )
  assert.match(
    installer,
    /customUnInstallCheckCurrentUser/,
  )
  assert.match(
    installer,
    /FileExists.*UNINSTALL_FILENAME/,
  )
  assert.match(
    installer,
    /FileExists.*APP_EXECUTABLE_FILENAME/,
  )
  assert.match(
    installer,
    /DeleteRegKey.*UNINSTALL_REGISTRY_KEY/,
  )
  assert.match(
    installer,
    /DeleteRegKey.*INSTALL_REGISTRY_KEY/,
  )
})

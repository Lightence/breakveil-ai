const test = require("node:test")
const assert = require("node:assert/strict")

const {
  createPinnedLookup,
  isBlockedHostname,
  isBlockedIpAddress,
  parseHttpsUrl,
  redactSecrets,
  sanitiseUntrustedValue,
  validateFieldPath,
  validateHeaderName,
} = require("../electron/custom-job-source-security.cjs")

const {
  isCustomSourceId,
} = require("../electron/custom-job-sources.cjs")

test("accepts a normal public HTTPS API URL", () => {
  const parsed = parseHttpsUrl(
    "https://api.examplejobs.com/v1/jobs?q=admin",
  )

  assert.equal(parsed.protocol, "https:")
  assert.equal(parsed.hostname, "api.examplejobs.com")
})

test("blocks insecure schemes and embedded credentials", () => {
  assert.throws(
    () => parseHttpsUrl("http://api.examplejobs.com/jobs"),
    /HTTPS/,
  )

  assert.throws(
    () => parseHttpsUrl("file:///C:/Windows/System32/config"),
    /HTTPS/,
  )

  assert.throws(
    () => parseHttpsUrl("https://user:password@api.examplejobs.com/jobs"),
    /username or password/,
  )
})

test("blocks local names and non-standard ports", () => {
  assert.equal(isBlockedHostname("localhost"), true)
  assert.equal(isBlockedHostname("router.local"), true)
  assert.equal(isBlockedHostname("service.internal"), true)

  assert.throws(
    () => parseHttpsUrl("https://localhost/jobs"),
    /local or private/,
  )

  assert.throws(
    () => parseHttpsUrl("https://api.examplejobs.com:8443/jobs"),
    /standard secure HTTPS port/,
  )

  assert.throws(
    () => parseHttpsUrl("https://2130706433/jobs"),
    /private or reserved/,
  )
})

test("blocks private, loopback, link-local and reserved IP ranges", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.5",
    "172.16.1.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
  ]) {
    assert.equal(
      isBlockedIpAddress(address),
      true,
      `${address} should be blocked`,
    )
  }

  assert.equal(isBlockedIpAddress("8.8.8.8"), false)
  assert.equal(isBlockedIpAddress("2606:4700:4700::1111"), false)
})

test("allows safe API-key headers and blocks transport-controlled headers", () => {
  assert.equal(validateHeaderName("X-API-Key"), "X-API-Key")
  assert.equal(validateHeaderName("Authorization-Key"), "Authorization-Key")

  for (const header of ["Host", "Cookie", "Content-Length", "Connection"]) {
    assert.throws(
      () => validateHeaderName(header),
      /controlled by BreakVeil/,
    )
  }
})

test("field paths cannot use prototype-pollution keys", () => {
  assert.equal(
    validateFieldPath("data.jobs", "Results path"),
    "data.jobs",
  )

  assert.throws(
    () => validateFieldPath("data.__proto__.jobs", "Results path"),
    /safe field path/,
  )

  assert.throws(
    () => validateFieldPath("constructor.prototype", "Results path"),
    /safe field path/,
  )
})

test("untrusted JSON rejects dangerous object keys", () => {
  const payload = JSON.parse(
    '{"jobs":[],"__proto__":{"polluted":true}}',
  )

  assert.throws(
    () => sanitiseUntrustedValue(payload),
    /blocked object field/,
  )
})

test("secrets are redacted from errors and encoded URLs", () => {
  const secret = "abc 123+/="
  const message = `Failure for ${secret} and ${encodeURIComponent(secret)}`
  const redacted = redactSecrets(message, [secret])

  assert.equal(redacted.includes(secret), false)
  assert.equal(redacted.includes(encodeURIComponent(secret)), false)
  assert.match(redacted, /\[REDACTED\]/)
})

test("custom source identifiers are tightly formatted", () => {
  assert.equal(
    isCustomSourceId(
      "custom:123e4567-e89b-12d3-a456-426614174000",
    ),
    true,
  )
  assert.equal(isCustomSourceId("custom:../../bad"), false)
  assert.equal(isCustomSourceId("reed"), false)
})


test("pinned DNS lookup supports Node's all-address callback mode", async () => {
  const lookup = createPinnedLookup({
    address: "8.8.8.8",
    family: 4,
  })

  await new Promise((resolve, reject) => {
    lookup(
      "api.examplejobs.com",
      { all: true },
      (error, addresses) => {
        try {
          assert.equal(error, null)
          assert.deepEqual(addresses, [
            {
              address: "8.8.8.8",
              family: 4,
            },
          ])
          resolve()
        } catch (assertionError) {
          reject(assertionError)
        }
      },
    )
  })
})

test("pinned DNS lookup keeps the legacy scalar callback mode", async () => {
  const lookup = createPinnedLookup({
    address: "2606:4700:4700::1111",
    family: 6,
  })

  await new Promise((resolve, reject) => {
    lookup(
      "api.examplejobs.com",
      { all: false },
      (error, address, family) => {
        try {
          assert.equal(error, null)
          assert.equal(address, "2606:4700:4700::1111")
          assert.equal(family, 6)
          resolve()
        } catch (assertionError) {
          reject(assertionError)
        }
      },
    )
  })
})

test("pinned DNS lookup rejects missing or invalid resolved addresses", () => {
  assert.throws(
    () => createPinnedLookup({ address: undefined, family: undefined }),
    /usable address/,
  )
})

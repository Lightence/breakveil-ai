const dns = require("node:dns").promises
const https = require("node:https")
const net = require("node:net")

const REQUEST_TIMEOUT_MS = 15 * 1000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 2
const MAX_JSON_DEPTH = 10
const MAX_ARRAY_ITEMS = 500
const MAX_OBJECT_KEYS = 250
const MAX_STRING_LENGTH = 250 * 1000

const FORBIDDEN_OBJECT_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
])

const FORBIDDEN_HEADER_NAMES = new Set([
  "host",
  "cookie",
  "set-cookie",
  "connection",
  "content-length",
  "transfer-encoding",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "te",
  "trailer",
  "via",
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
])

function cleanSingleLine(value, maximumLength = 500) {
  return String(value || "")
    .replace(/[\r\n\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength)
}

function isBlockedHostname(hostname) {
  const safeHostname = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")

  if (!safeHostname) {
    return true
  }

  if (
    safeHostname === "localhost" ||
    safeHostname === "localhost.localdomain" ||
    safeHostname.endsWith(".localhost") ||
    safeHostname.endsWith(".local") ||
    safeHostname.endsWith(".internal") ||
    safeHostname.endsWith(".lan") ||
    safeHostname.endsWith(".home") ||
    safeHostname.endsWith(".corp") ||
    safeHostname.endsWith(".test") ||
    safeHostname.endsWith(".invalid") ||
    safeHostname.endsWith(".example")
  ) {
    return true
  }

  return false
}

function parseIpv4(address) {
  const parts = String(address || "").split(".")

  if (parts.length !== 4) {
    return null
  }

  const bytes = parts.map((part) => Number(part))

  if (
    bytes.some(
      (byte) =>
        !Number.isInteger(byte) ||
        byte < 0 ||
        byte > 255,
    )
  ) {
    return null
  }

  return bytes
}

function isBlockedIpv4(address) {
  const bytes = parseIpv4(address)

  if (!bytes) {
    return true
  }

  const [a, b, c] = bytes

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function normaliseIpv6(address) {
  return String(address || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0]
}

function expandIpv6(address) {
  let safeAddress = normaliseIpv6(address)

  if (!safeAddress) {
    return null
  }

  const ipv4Match = safeAddress.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)

  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1])

    if (!ipv4) {
      return null
    }

    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16)
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16)
    safeAddress = safeAddress.replace(ipv4Match[1], `${high}:${low}`)
  }

  const pieces = safeAddress.split("::")

  if (pieces.length > 2) {
    return null
  }

  const left = pieces[0]
    ? pieces[0].split(":").filter(Boolean)
    : []
  const right = pieces.length === 2 && pieces[1]
    ? pieces[1].split(":").filter(Boolean)
    : []
  const missing = 8 - left.length - right.length

  if (
    missing < 0 ||
    (pieces.length === 1 && missing !== 0)
  ) {
    return null
  }

  const hextets = [
    ...left,
    ...Array(pieces.length === 2 ? missing : 0).fill("0"),
    ...right,
  ]

  if (
    hextets.length !== 8 ||
    hextets.some((part) => !/^[0-9a-f]{1,4}$/.test(part))
  ) {
    return null
  }

  return hextets.map((part) => Number.parseInt(part, 16))
}

function ipv4FromHextets(high, low) {
  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255,
  ].join(".")
}

function isBlockedIpv6(address) {
  const hextets = expandIpv6(address)

  if (!hextets) {
    return true
  }

  const [first, second] = hextets
  const allZero = hextets.every((value) => value === 0)
  const loopback = hextets.slice(0, 7).every((value) => value === 0) && hextets[7] === 1

  if (allZero || loopback) {
    return true
  }

  if (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && second === 0x0db8) ||
    (first === 0x2001 && second === 0x0000)
  ) {
    return true
  }

  const firstFiveZero = hextets.slice(0, 5).every((value) => value === 0)
  const firstSixZero = hextets.slice(0, 6).every((value) => value === 0)

  if (
    firstFiveZero &&
    hextets[5] === 0xffff
  ) {
    return isBlockedIpv4(
      ipv4FromHextets(
        hextets[6],
        hextets[7],
      ),
    )
  }

  if (firstSixZero) {
    return isBlockedIpv4(
      ipv4FromHextets(
        hextets[6],
        hextets[7],
      ),
    )
  }

  if (
    first === 0x0064 &&
    second === 0xff9b &&
    hextets.slice(2, 6).every((value) => value === 0)
  ) {
    return isBlockedIpv4(
      ipv4FromHextets(
        hextets[6],
        hextets[7],
      ),
    )
  }

  if (first === 0x2002) {
    return isBlockedIpv4(
      ipv4FromHextets(
        hextets[1],
        hextets[2],
      ),
    )
  }

  return false
}

function isBlockedIpAddress(address) {
  const family = net.isIP(String(address || ""))

  if (family === 4) {
    return isBlockedIpv4(address)
  }

  if (family === 6) {
    return isBlockedIpv6(address)
  }

  return true
}

function parseHttpsUrl(rawUrl, label = "API URL") {
  const safeRawUrl = cleanSingleLine(rawUrl, 2048)

  if (!safeRawUrl) {
    throw new Error(`Enter the ${label.toLowerCase()}.`)
  }

  let parsed

  try {
    parsed = new URL(safeRawUrl)
  } catch {
    throw new Error(`${label} is not a valid web address.`)
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`)
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain a username or password.`)
  }

  if (parsed.port && parsed.port !== "443") {
    throw new Error(`${label} must use the standard secure HTTPS port.`)
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`${label} points to a local or private network name and was blocked.`)
  }

  if (
    net.isIP(parsed.hostname) &&
    isBlockedIpAddress(parsed.hostname)
  ) {
    throw new Error(`${label} points to a private or reserved network address and was blocked.`)
  }

  parsed.hash = ""

  return parsed
}

async function validateResolvedDestination(parsedUrl) {
  const hostname = parsedUrl.hostname

  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new Error(
        "The API destination is a private or reserved network address. BreakVeil did not contact it.",
      )
    }

    return [hostname]
  }

  let addresses

  try {
    addresses = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    })
  } catch {
    throw new Error("The API hostname could not be resolved safely.")
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error("The API hostname did not resolve to a usable address.")
  }

  for (const entry of addresses) {
    if (isBlockedIpAddress(entry?.address)) {
      throw new Error(
        "The API hostname resolves to a local, private or reserved network address. BreakVeil did not contact it.",
      )
    }
  }

  return addresses.map((entry) => entry.address)
}

function validateHeaderName(value) {
  const headerName = cleanSingleLine(value, 64)

  if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(headerName)) {
    throw new Error("The API-key header name is not valid.")
  }

  if (FORBIDDEN_HEADER_NAMES.has(headerName.toLowerCase())) {
    throw new Error("That header is controlled by BreakVeil and cannot be changed.")
  }

  return headerName
}

function validateParameterName(value, label, { required = false } = {}) {
  const parameterName = cleanSingleLine(value, 64)

  if (!parameterName && !required) {
    return ""
  }

  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(parameterName)) {
    throw new Error(`${label} contains unsupported characters.`)
  }

  if (FORBIDDEN_OBJECT_KEYS.has(parameterName.toLowerCase())) {
    throw new Error(`${label} uses a blocked field name.`)
  }

  return parameterName
}

function validateFieldPath(value, label, { required = false } = {}) {
  const fieldPath = cleanSingleLine(value, 240)

  if (!fieldPath && !required) {
    return ""
  }

  if (!fieldPath) {
    throw new Error(`${label} is required.`)
  }

  const parts = fieldPath.split(".")

  if (
    parts.length > 12 ||
    parts.some(
      (part) =>
        !/^[A-Za-z0-9_$-]{1,80}$/.test(part) ||
        FORBIDDEN_OBJECT_KEYS.has(part.toLowerCase()),
    )
  ) {
    throw new Error(`${label} is not a safe field path.`)
  }

  return parts.join(".")
}

function redactSecrets(value, secrets = []) {
  let output = String(value || "")

  for (const secretValue of secrets) {
    const secret = String(secretValue || "")

    if (!secret) {
      continue
    }

    output = output.split(secret).join("[REDACTED]")

    try {
      const encodedSecret = encodeURIComponent(secret)
      output = output.split(encodedSecret).join("[REDACTED]")
    } catch {
      // The plain value was already redacted.
    }
  }

  return output.slice(0, 1200)
}

function sanitiseUntrustedValue(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) {
    throw new Error("The API response is nested too deeply and was blocked.")
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value
  }

  if (typeof value === "string") {
    return value.slice(0, MAX_STRING_LENGTH)
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitiseUntrustedValue(item, depth + 1))
  }

  if (typeof value === "object") {
    const output = Object.create(null)
    const entries = Object.entries(value)

    if (entries.length > MAX_OBJECT_KEYS) {
      throw new Error("An API object contains too many fields and was blocked.")
    }

    for (const [key, childValue] of entries) {
      const safeKey = String(key || "").slice(0, 120)

      if (FORBIDDEN_OBJECT_KEYS.has(safeKey.toLowerCase())) {
        throw new Error("The API response contains a blocked object field.")
      }

      output[safeKey] = sanitiseUntrustedValue(childValue, depth + 1)
    }

    return output
  }

  return null
}

async function resolvePublicAddress(hostname) {
  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new Error(
        "The API destination is a private or reserved network address. BreakVeil did not contact it.",
      )
    }

    return {
      address: hostname,
      family: net.isIP(hostname),
    }
  }

  let addresses

  try {
    addresses = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    })
  } catch {
    throw new Error("The API hostname could not be resolved safely.")
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error("The API hostname did not resolve to a usable address.")
  }

  for (const entry of addresses) {
    if (isBlockedIpAddress(entry?.address)) {
      throw new Error(
        "The API hostname resolves to a local, private or reserved network address. BreakVeil did not contact it.",
      )
    }
  }

  return addresses[0]
}

function createPinnedLookup(pinnedAddress) {
  const address = String(pinnedAddress?.address || "").trim()
  const family = Number(pinnedAddress?.family || net.isIP(address))

  if (!address || ![4, 6].includes(family)) {
    throw new Error("The API hostname did not resolve to a usable address.")
  }

  return (_hostname, options, callback) => {
    const result = {
      address,
      family,
    }

    /*
     * Node 20+ may request all candidate addresses so it can perform
     * connection-family selection. In that mode the lookup callback must
     * receive an array. Returning the older scalar signature causes Node to
     * read an undefined address and fail with "Invalid IP address".
     *
     * We still return only the single address that BreakVeil already resolved,
     * checked and pinned, so the SSRF and DNS-rebinding protections remain
     * unchanged.
     */
    if (
      options &&
      typeof options === "object" &&
      options.all === true
    ) {
      callback(null, [result])
      return
    }

    callback(null, address, family)
  }
}

async function requestOnce({
  parsedUrl,
  method,
  headers,
  body,
}) {
  const pinnedAddress = await resolvePublicAddress(parsedUrl.hostname)
  const pinnedLookup = createPinnedLookup(pinnedAddress)

  return new Promise((resolve, reject) => {
    const request = https.request(
      parsedUrl,
      {
        method,
        headers,
        rejectUnauthorized: true,
        servername: parsedUrl.hostname,
        lookup: pinnedLookup,
      },
      (response) => {
        const statusCode = Number(response.statusCode || 0)
        const contentLength = Number(response.headers["content-length"] || 0)

        if (
          Number.isFinite(contentLength) &&
          contentLength > MAX_RESPONSE_BYTES
        ) {
          response.destroy()
          reject(
            new Error(
              "The API response is larger than BreakVeil's 5 MB safety limit.",
            ),
          )
          return
        }

        const chunks = []
        let totalBytes = 0

        response.on("data", (chunk) => {
          totalBytes += chunk.length

          if (totalBytes > MAX_RESPONSE_BYTES) {
            response.destroy(
              new Error(
                "The API response is larger than BreakVeil's 5 MB safety limit.",
              ),
            )
            return
          }

          chunks.push(Buffer.from(chunk))
        })

        response.on("end", () => {
          resolve({
            statusCode,
            headers: response.headers,
            text: Buffer.concat(chunks).toString("utf8"),
          })
        })

        response.on("error", reject)
      },
    )

    request.setTimeout(
      REQUEST_TIMEOUT_MS,
      () => {
        request.destroy(
          new Error("REQUEST_TIMEOUT"),
        )
      },
    )

    request.on("error", reject)

    if (method === "POST" && body) {
      request.write(body)
    }

    request.end()
  })
}

async function secureFetchJson({
  requestUrl,
  method = "GET",
  headers = {},
  body,
  approvedHostname,
  sourceName = "Custom source",
  secrets = [],
}) {
  let currentUrl = parseHttpsUrl(requestUrl)
  const approvedHost = String(approvedHostname || currentUrl.hostname)
    .trim()
    .toLowerCase()
  const safeMethod = String(method || "GET").toUpperCase()

  if (!["GET", "POST"].includes(safeMethod)) {
    throw new Error("Custom connectors may only use GET or POST requests.")
  }

  if (currentUrl.hostname.toLowerCase() !== approvedHost) {
    throw new Error("The request hostname does not match the approved connector hostname.")
  }

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const response = await requestOnce({
        parsedUrl: currentUrl,
        method: safeMethod,
        headers: {
          Accept: "application/json",
          "User-Agent": "BreakVeil-AI/0.3 custom-connector",
          ...headers,
        },
        body: safeMethod === "POST" ? body : undefined,
      })

      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new Error("The API redirected too many times and was blocked.")
        }

        const location = response.headers.location

        if (!location) {
          throw new Error("The API returned an invalid redirect.")
        }

        const redirectedUrl = parseHttpsUrl(
          new URL(location, currentUrl).toString(),
        )

        if (redirectedUrl.hostname.toLowerCase() !== approvedHost) {
          throw new Error(
            "The API tried to redirect to another hostname. BreakVeil blocked the redirect and did not forward the API key.",
          )
        }

        currentUrl = redirectedUrl
        continue
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(
          `${sourceName} returned error ${response.statusCode}${response.text ? `: ${response.text.slice(0, 300)}` : "."}`,
        )
      }

      const contentType = String(response.headers["content-type"] || "").toLowerCase()

      if (
        contentType &&
        !contentType.includes("application/json") &&
        !contentType.includes("+json") &&
        !contentType.includes("text/json")
      ) {
        throw new Error("The endpoint did not return JSON and was blocked.")
      }

      let parsed

      try {
        parsed = JSON.parse(response.text)
      } catch {
        throw new Error("The endpoint did not return valid JSON.")
      }

      return {
        data: sanitiseUntrustedValue(parsed),
        finalUrl: currentUrl.toString(),
        hostname: currentUrl.hostname,
        statusCode: response.statusCode,
        responseBytes: Buffer.byteLength(response.text, "utf8"),
      }
    }

    throw new Error("The API request could not be completed safely.")
  } catch (error) {
    if (error?.message === "REQUEST_TIMEOUT") {
      throw new Error(`${sourceName} did not respond within 15 seconds.`)
    }

    throw new Error(redactSecrets(error?.message || error, secrets))
  }
}

function isTrustedIpcSender(event) {
  const senderFrame = event?.senderFrame

  if (!senderFrame || senderFrame !== event?.sender?.mainFrame) {
    return false
  }

  let parsed

  try {
    parsed = new URL(senderFrame.url)
  } catch {
    return false
  }

  if (parsed.protocol === "file:") {
    return true
  }

  return (
    parsed.protocol === "http:" &&
    parsed.hostname === "localhost" &&
    parsed.port === "5173"
  )
}

function assertTrustedIpcSender(event) {
  if (!isTrustedIpcSender(event)) {
    throw new Error("Blocked an untrusted request to the custom-source security service.")
  }
}

module.exports = {
  FORBIDDEN_OBJECT_KEYS,
  MAX_RESPONSE_BYTES,
  assertTrustedIpcSender,
  cleanSingleLine,
  createPinnedLookup,
  isBlockedHostname,
  isBlockedIpAddress,
  parseHttpsUrl,
  redactSecrets,
  sanitiseUntrustedValue,
  secureFetchJson,
  validateFieldPath,
  validateHeaderName,
  validateParameterName,
  validateResolvedDestination,
}

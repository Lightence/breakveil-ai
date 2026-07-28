const crypto = require("crypto")

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "msclkid", "ref", "referrer", "source", "trk",
])
const COMPANY_SUFFIXES = new Set(["limited", "ltd", "plc", "inc", "incorporated", "llc", "corp", "corporation"])
const TITLE_NOISE = new Set(["job", "vacancy", "position", "opportunity"])
const DIRECT_SOURCES = new Set(["greenhouse", "lever", "smartrecruiters"])
const MAX_COMPARE_TEXT = 12000

function text(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
}

function words(value) { return text(value).split(" ").filter(Boolean) }

function canonicalCompany(value) {
  const tokens = words(value)
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join(" ")
}

function canonicalTitle(value) {
  const replacements = { sr: "senior", snr: "senior", jr: "junior", mgr: "manager", eng: "engineer", dev: "developer" }
  return words(value).map((token) => replacements[token] || token)
    .filter((token) => !TITLE_NOISE.has(token)).join(" ")
}

function canonicalLocation(value, isRemote = false) {
  const tokens = words(value).filter((token) => !["united", "kingdom", "uk", "gb", "office", "based"].includes(token))
  if (isRemote || tokens.includes("remote")) return "remote"
  return tokens.filter((token) => token !== "hybrid").join(" ")
}

function canonicalUrl(value) {
  try {
    const url = new URL(String(value || ""))
    if (!/^https?:$/.test(url.protocol)) return ""
    url.hash = ""
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
  } catch { return "" }
}

function tokenSimilarity(first, second) {
  const a = new Set(words(String(first || "").slice(0, MAX_COMPARE_TEXT)))
  const b = new Set(words(String(second || "").slice(0, MAX_COMPARE_TEXT)))
  if (!a.size || !b.size) return 0
  let common = 0
  for (const token of a) if (b.has(token)) common += 1
  return common / Math.max(a.size, b.size)
}

function dayDistance(first, second) {
  const a = Date.parse(first || "")
  const b = Date.parse(second || "")
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) / 86400000 : null
}

function listingKeys(job) {
  const listings = Array.isArray(job.sourceListings) && job.sourceListings.length
    ? job.sourceListings : [{ source: job.source, providerId: job.providerId, url: job.url, applyUrl: job.applyUrl }]
  return listings.flatMap((listing) => {
    const source = text(listing.source)
    const providerId = String(listing.providerId || "").trim().toLowerCase()
    const urls = [listing.applyUrl, listing.url].map(canonicalUrl).filter(Boolean)
    return [...(source && providerId ? [`provider:${source}:${providerId}`] : []), ...urls.map((url) => `url:${url}`)]
  })
}

function listingRecords(job) {
  return Array.isArray(job.sourceListings) && job.sourceListings.length
    ? job.sourceListings : [{ source: job.source, providerId: job.providerId, url: job.url, applyUrl: job.applyUrl }]
}

function hasConflictingStableIdentity(first, second) {
  const firstListings = listingRecords(first)
  const secondListings = listingRecords(second)
  for (const a of firstListings) for (const b of secondListings) {
    if (text(a.source) && text(a.source) === text(b.source) && a.providerId && b.providerId && String(a.providerId) !== String(b.providerId)) return true
    try {
      const aUrl = new URL(canonicalUrl(a.applyUrl || a.url))
      const bUrl = new URL(canonicalUrl(b.applyUrl || b.url))
      const directHost = /greenhouse|lever|smartrecruiters|careers|jobs\./i.test(aUrl.hostname)
      if (directHost && aUrl.hostname === bUrl.hostname && aUrl.pathname !== bUrl.pathname) return true
    } catch { /* Missing URLs are weak evidence, not an error. */ }
  }
  return false
}

function evidence(first, second) {
  const sharedIdentity = listingKeys(first).some((key) => listingKeys(second).includes(key))
  const titleA = canonicalTitle(first.title), titleB = canonicalTitle(second.title)
  const companyA = canonicalCompany(first.company), companyB = canonicalCompany(second.company)
  const locationA = canonicalLocation(first.location, first.isRemote), locationB = canonicalLocation(second.location, second.isRemote)
  const titleScore = tokenSimilarity(titleA, titleB)
  const companyScore = tokenSimilarity(companyA, companyB)
  const descriptionScore = tokenSimilarity(first.description, second.description)
  const dates = dayDistance(first.postedAt, second.postedAt)
  const locationCompatible = !locationA || !locationB || locationA === locationB ||
    (locationA === "remote" && Boolean(second.isRemote)) || (locationB === "remote" && Boolean(first.isRemote))
  const materiallyDifferentSeniority = /(^| )(senior|lead|principal|head|director)( |$)/.test(titleA) !== /(^| )(senior|lead|principal|head|director)( |$)/.test(titleB)
  const conflictingIdentity = !sharedIdentity && hasConflictingStableIdentity(first, second)
  let score = titleScore * 35 + companyScore * 30 + (locationCompatible ? 12 : -25)
  if (descriptionScore >= 0.72) score += 18
  else if (descriptionScore >= 0.5) score += 9
  if (dates !== null && dates <= 7) score += 5
  if (materiallyDifferentSeniority) score -= 35
  const match = sharedIdentity || (!conflictingIdentity && score >= 78 && titleScore >= 0.8 && companyScore >= 0.8 && locationCompatible)
  return { match, tier: sharedIdentity ? "exact" : match ? "probable" : "distinct", score, sharedIdentity }
}

function quality(job) {
  let score = Math.min(String(job.description || "").length, 5000) / 250
  if (!job.descriptionIsSnippet && job.description) score += 8
  if (DIRECT_SOURCES.has(text(job.source)) || /greenhouse|lever|smartrecruiters/i.test(job.sourceName || "")) score += 7
  if (job.applyUrl) score += 3
  if (job.salaryText || job.salaryMin != null) score += 2
  if (job.location) score += 1
  if (job.postedAt) score += 1
  return score
}

function listingIdentity(listing) {
  return `${text(listing.source)}:${String(listing.providerId || "").toLowerCase()}:${canonicalUrl(listing.applyUrl || listing.url)}`
}

function mergeCluster(cluster) {
  const ordered = [...cluster].sort((a, b) => quality(b) - quality(a) || listingKeys(a).join("|").localeCompare(listingKeys(b).join("|")))
  const preferred = ordered[0]
  const listings = ordered.flatMap((job) => job.sourceListings || []).sort((a, b) => listingIdentity(a).localeCompare(listingIdentity(b)))
    .filter((listing, index, all) => all.findIndex((item) => listingIdentity(item) === listingIdentity(listing)) === index)
  const sources = [...new Set(listings.map((item) => item.source).filter(Boolean))]
  const sourceNames = [...new Set(listings.map((item) => item.sourceName).filter(Boolean))]
  const richestDescription = [...ordered].sort((a, b) => String(b.description || "").length - String(a.description || "").length)[0]
  const stableBasis = [
    canonicalCompany(preferred.company), canonicalTitle(preferred.title),
    canonicalLocation(preferred.location, preferred.isRemote),
    ...ordered.flatMap(listingKeys).sort(),
  ].join("|")
  return {
    ...preferred,
    id: `job:${crypto.createHash("sha256").update(stableBasis).digest("hex").slice(0, 20)}`,
    description: richestDescription.description || preferred.description,
    descriptionIsSnippet: richestDescription.descriptionIsSnippet,
    salaryMin: ordered.find((job) => job.salaryMin != null)?.salaryMin ?? null,
    salaryMax: ordered.find((job) => job.salaryMax != null)?.salaryMax ?? null,
    salaryText: ordered.find((job) => job.salaryText)?.salaryText || "",
    postedAt: ordered.find((job) => job.postedAt)?.postedAt || "",
    expiresAt: ordered.find((job) => job.expiresAt)?.expiresAt || "",
    sources, sourceNames, sourceListings: listings,
    duplicateCount: listings.length || ordered.length,
  }
}

function deduplicateJobs(jobs) {
  const valid = jobs.filter((job) => job && job.title && job.providerId)
    .sort((a, b) => listingKeys(a).join("|").localeCompare(listingKeys(b).join("|")))
  const clusters = []
  for (const job of valid) {
    const cluster = clusters.find((items) => items.some((item) => evidence(item, job).match))
    if (cluster) cluster.push(job); else clusters.push([job])
  }
  return clusters.map(mergeCluster)
}

module.exports = { canonicalCompany, canonicalTitle, canonicalLocation, canonicalUrl, evidence, deduplicateJobs }

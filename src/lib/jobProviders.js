export const jobProviders = [
  {
    id: "reed",
    name: "Reed",
    connectionMode: "credential",
    autoDiscoveryDefault: true,
  },
  {
    id: "adzuna",
    name: "Adzuna",
    connectionMode: "credential",
    autoDiscoveryDefault: true,
  },
  {
    id: "jooble",
    name: "Jooble",
    connectionMode: "credential",
    autoDiscoveryDefault: true,
  },
  {
    id: "arbeitnow",
    name: "Arbeitnow (Germany)",
    connectionMode: "public",
    autoDiscoveryDefault: false,
    regionalFocus: "Germany",
    englishOnly: true,
    locationGuard: true,
  },
  {
    id: "jobicy",
    name: "Jobicy (Remote)",
    connectionMode: "public",
    autoDiscoveryDefault: false,
    regionalFocus: "Global remote",
    remoteOnly: true,
    locationGuard: true,
    cacheMinutes: 60,
  },
  {
    id: "remotive",
    name: "Remotive (Remote)",
    connectionMode: "public",
    autoDiscoveryDefault: false,
    regionalFocus: "Global remote",
    remoteOnly: true,
    locationGuard: true,
    cacheMinutes: 360,
    attributionRequired: true,
    publicationDelayHours: 24,
  },
]

export const jobProviderIds = jobProviders.map(
  (provider) => provider.id,
)

export const defaultDiscoverySourceIds = jobProviders
  .filter((provider) => provider.autoDiscoveryDefault)
  .map((provider) => provider.id)

export function isCustomJobProviderId(providerId) {
  return /^custom:[0-9a-f-]{36}$/i.test(
    String(providerId || "").trim(),
  )
}

export function isDirectEmployerProviderId(providerId) {
  return /^employer:[0-9a-f-]{36}$/i.test(
    String(providerId || "").trim(),
  )
}

export function isSupportedJobProviderId(providerId) {
  const safeProviderId = String(providerId || "")
    .trim()
    .toLowerCase()

  return (
    jobProviderIds.includes(safeProviderId) ||
    isCustomJobProviderId(safeProviderId) ||
    isDirectEmployerProviderId(safeProviderId)
  )
}

export function getJobProvider(providerId) {
  const safeProviderId = String(providerId || "")
    .trim()
    .toLowerCase()

  return (
    jobProviders.find((provider) => provider.id === safeProviderId) || null
  )
}

export function getJobProviderLabel(providerId, sourceStatus = null) {
  return (
    sourceStatus?.name ||
    getJobProvider(providerId)?.name ||
    (isCustomJobProviderId(providerId)
      ? "Custom Job Source"
      : isDirectEmployerProviderId(providerId)
        ? "Direct Employer"
        : providerId || "Job Source")
  )
}

export function createEmptyJobSourceMap() {
  return jobProviders.reduce((sources, provider) => {
    sources[provider.id] = {
      source: provider.id,
      name: provider.name,
      configured: provider.connectionMode === "public",
      connectionMode: provider.connectionMode,
      removable: provider.connectionMode !== "public",
      savedAt: "",
      lastTest: null,
      health: null,
    }

    return sources
  }, {})
}

export function mergeJobSourceMap(sourceStatus = {}) {
  const emptySources = createEmptyJobSourceMap()
  const sources = jobProviders.reduce((nextSources, provider) => {
    nextSources[provider.id] = {
      ...emptySources[provider.id],
      ...(sourceStatus?.[provider.id] || {}),
    }

    return nextSources
  }, {})

  for (const [sourceId, details] of Object.entries(sourceStatus || {})) {
    const custom = isCustomJobProviderId(sourceId)
    const directEmployer = isDirectEmployerProviderId(sourceId)

    if (!custom && !directEmployer) {
      continue
    }

    sources[sourceId] = {
      source: sourceId,
      name:
        details?.name ||
        (directEmployer ? "Direct Employer" : "Custom Job Source"),
      configured: false,
      connectionMode: directEmployer
        ? "direct-employer"
        : "custom",
      custom,
      directEmployer,
      removable: true,
      autoDiscoveryEnabled: false,
      savedAt: "",
      lastTest: null,
      health: null,
      ...(details || {}),
    }
  }

  return sources
}

const BUILT_IN_JOB_PROVIDERS = [
  {
    id: "reed",
    name: "Reed",
    connectionMode: "credential",
    removable: true,
    autoDiscoveryDefault: true,
    descriptionSource: "api+detail",
    capabilities: {
      search: true,
      locationFiltering: true,
      pagination: true,
      salary: true,
      remote: true,
      fullDescription: true,
      detailLookup: true,
      applicationUrl: true,
    },
  },
  {
    id: "adzuna",
    name: "Adzuna",
    connectionMode: "credential",
    removable: true,
    autoDiscoveryDefault: true,
    descriptionSource: "api-snippet",
    capabilities: {
      search: true,
      locationFiltering: true,
      pagination: true,
      salary: true,
      remote: true,
      fullDescription: false,
      detailLookup: false,
      applicationUrl: true,
    },
  },
  {
    id: "jooble",
    name: "Jooble",
    connectionMode: "credential",
    removable: true,
    autoDiscoveryDefault: true,
    descriptionSource: "api-snippet",
    capabilities: {
      search: true,
      locationFiltering: true,
      pagination: true,
      salary: true,
      remote: true,
      fullDescription: false,
      detailLookup: false,
      applicationUrl: true,
    },
  },
  {
    id: "arbeitnow",
    name: "Arbeitnow (Germany)",
    connectionMode: "public",
    removable: false,
    autoDiscoveryDefault: false,
    descriptionSource: "api-full",
    regionalFocus: "Germany",
    englishOnly: true,
    locationGuard: true,
    capabilities: {
      search: true,
      locationFiltering: false,
      pagination: true,
      salary: false,
      remote: true,
      fullDescription: true,
      detailLookup: false,
      applicationUrl: true,
    },
  },
  {
    id: "jobicy",
    name: "Jobicy (Remote)",
    connectionMode: "public",
    removable: false,
    autoDiscoveryDefault: false,
    descriptionSource: "api-full",
    regionalFocus: "Global remote",
    remoteOnly: true,
    locationGuard: true,
    cacheMinutes: 60,
    capabilities: {
      search: true,
      locationFiltering: true,
      pagination: false,
      salary: true,
      remote: true,
      fullDescription: true,
      detailLookup: false,
      applicationUrl: true,
    },
  },
  {
    id: "remotive",
    name: "Remotive (Remote)",
    connectionMode: "public",
    removable: false,
    autoDiscoveryDefault: false,
    descriptionSource: "api-full",
    regionalFocus: "Global remote",
    remoteOnly: true,
    locationGuard: true,
    cacheMinutes: 360,
    attributionRequired: true,
    publicationDelayHours: 24,
    capabilities: {
      search: true,
      locationFiltering: true,
      pagination: false,
      salary: true,
      remote: true,
      fullDescription: true,
      detailLookup: false,
      applicationUrl: true,
    },
  },
]

function cloneProvider(provider) {
  return {
    ...provider,
    capabilities: {
      ...(provider.capabilities || {}),
    },
  }
}

function getBuiltInJobProviders() {
  return BUILT_IN_JOB_PROVIDERS.map(cloneProvider)
}

function getBuiltInJobProvider(providerId) {
  const safeProviderId = String(providerId || "")
    .trim()
    .toLowerCase()

  const provider = BUILT_IN_JOB_PROVIDERS.find(
    (candidate) => candidate.id === safeProviderId,
  )

  return provider ? cloneProvider(provider) : null
}

function getBuiltInJobProviderIds() {
  return BUILT_IN_JOB_PROVIDERS.map((provider) => provider.id)
}

function getSourceNamesMap() {
  return BUILT_IN_JOB_PROVIDERS.reduce((sourceNames, provider) => {
    sourceNames[provider.id] = provider.name
    return sourceNames
  }, {})
}

function providerRequiresCredentials(providerId) {
  return getBuiltInJobProvider(providerId)?.connectionMode === "credential"
}

module.exports = {
  BUILT_IN_JOB_PROVIDERS,
  getBuiltInJobProviders,
  getBuiltInJobProvider,
  getBuiltInJobProviderIds,
  getSourceNamesMap,
  providerRequiresCredentials,
}

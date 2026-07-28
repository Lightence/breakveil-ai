import {
  useEffect,
  useState,
} from "react"

import {
  useLocation,
  useNavigate,
} from "react-router-dom"


import {
  Accessibility,
  AlertTriangle,
  AppWindow,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  HardDrive,
  Info,
  KeyRound,
  LockKeyhole,
  LoaderCircle,
  FileText,
  Globe2,
  MapPin,
  Monitor,
  Palette,
  Power,
  RefreshCw,
  Save,
  ScrollText,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from "lucide-react"

import ConfirmDialog from "../components/ConfirmDialog"
import CompanyResearchConnectionCard from "../components/CompanyResearchConnectionCard"
import CustomJobSourcesPanel from "../components/CustomJobSourcesPanel"
import DirectEmployerSourcesPanel from "../components/DirectEmployerSourcesPanel"

import {
  DataRecoverySettings,
  PrivacySettings,
} from "../components/DataPrivacySettings"

import {
  createEmptyJobSourceMap,
  getJobProviderLabel,
  mergeJobSourceMap,
} from "../lib/jobProviders"

import {
  defaultUiPreferences,
  formatPreferenceDateTime,
  loadUiPreferences,
  requestSetupGuide,
  saveUiPreferences,
  uiThemeOptions,
} from "../lib/uiPreferences"

const emptyStatus = {
  encryptionAvailable:
    false,

  securityLabel:
    "Operating-system encryption",

  cacheEntryCount:
    0,

  cacheSummary: {
    entryCount: 0,
    freshCount: 0,
    staleCount: 0,
    newestCreatedAt: "",
  },

  searchHealth: {
    state: "healthy",
    configuredCount: 0,
    unhealthyCount: 0,
    updatedAt: "",
  },

  sources:
    createEmptyJobSourceMap(),
}


const emptyDesktopSettings = {
  launchAtStartup:
    false,

  startMinimized:
    false,

  keepRunningOnClose:
    true,

  startupAvailable:
    false,
}


const settingsCategoryStorageKey =
  "jobpilot.settings-category"

const settingsCategories = [
  {
    id:
      "general",

    label:
      "General",

    description:
      "Startup, window and regional behaviour.",

    icon:
      SlidersHorizontal,
  },
  {
    id:
      "appearance",

    label:
      "Appearance",

    description:
      "Theme, scale and scrollbars.",

    icon:
      Palette,
  },
  {
    id:
      "accessibility",

    label:
      "Accessibility",

    description:
      "Focus, motion, spacing and clarity.",

    icon:
      Accessibility,
  },
  {
    id:
      "applications",

    label:
      "Applications",

    description:
      "Writing and interview defaults.",

    icon:
      FileText,
  },
  {
    id:
      "connections",

    label:
      "Connections",

    description:
      "Job sources, research and secure connections.",

    icon:
      KeyRound,
  },
  {
    id:
      "data",

    label:
      "Data",

    description:
      "Backup, export and recovery.",

    icon:
      HardDrive,
  },
  {
    id:
      "privacy",

    label:
      "Privacy",

    description:
      "Local data, permissions and cleanup.",

    icon:
      LockKeyhole,
  },
]

const interviewStructureOptions = [
  {
    value:
      "star",

    label:
      "STAR",

    steps:
      "Situation → Task → Action → Result",

    description:
      "A clear four-part answer that explains the context, your responsibility, what you personally did and the outcome.",

    bestFor:
      "Best for most competency and behavioural interview questions.",

    recommended:
      true,
  },
  {
    value:
      "star-reflection",

    label:
      "STAR with Reflection",

    steps:
      "Situation → Task → Action → Result → Reflection",

    description:
      "Uses STAR, then adds what you learned, what changed afterwards or what you would improve next time.",

    bestFor:
      "Best for questions about development, mistakes, feedback or personal growth.",
  },
  {
    value:
      "concise-evidence",

    label:
      "Concise Evidence",

    steps:
      "Context → Action → Evidence",

    description:
      "A shorter structure that quickly gives enough background, explains your action and ends with proof or a measurable result.",

    bestFor:
      "Best for screening calls, quick follow-up questions and shorter answers.",
  },
  {
    value:
      "free-form",

    label:
      "Free-Form",

    steps:
      "No fixed framework",

    description:
      "BreakVeil suggests the topic but does not add a required answer structure.",

    bestFor:
      "Best when you prefer to organise and write interview answers yourself.",
  },
]

function loadSettingsCategory() {
  try {
    const storedValue =
      localStorage.getItem(
        settingsCategoryStorageKey,
      )

    return settingsCategories.some(
      (category) =>
        category.id ===
        storedValue,
    )
      ? storedValue
      : "general"
  } catch {
    return "general"
  }
}

const apiGuides = {
  reed: {
    name:
      "Reed",

    title:
      "Set Up a Reed API Key",

    description:
      "Reed uses one API key for its official Jobseeker Search and Details APIs.",

    url:
      "https://www.reed.co.uk/developers/Jobseeker",

    linkLabel:
      "Open Reed Developer Page",

    steps: [
      "Open the official Reed Jobseeker API page.",
      "Select the API key sign-up option and register or sign in when Reed asks.",
      "Complete Reed’s API access process and copy the API key you receive.",
      "Return to BreakVeil and paste the key into the Reed API Key field.",
      "Select Save and Test Reed. BreakVeil will encrypt the key locally and test the connection.",
    ],

    notes: [
      "Paste only the API key itself. Do not include quotation marks or spaces before or after it.",
      "A successful test means Reed can be used by Discover Jobs and Automatic Job Discovery.",
    ],
  },

  adzuna: {
    name:
      "Adzuna",

    title:
      "Set Up Adzuna Credentials",

    description:
      "Adzuna supplies two values: an Application ID and an Application Key.",

    url:
      "https://developer.adzuna.com/signup",

    linkLabel:
      "Open Adzuna Registration",

    steps: [
      "Open the official Adzuna registration page.",
      "Create an account and complete the requested contact and application-use details.",
      "After registration, locate the app_id and app_key shown for your application.",
      "Paste app_id into Application ID and app_key into Application Key in BreakVeil.",
      "Select Save and Test Adzuna. BreakVeil will encrypt both values and test the connection.",
    ],

    notes: [
      "The Application ID and Application Key are different values and must be entered in the matching fields.",
      "A successful test enables Adzuna results in Discover Jobs and Automatic Job Discovery.",
    ],
  },

  jooble: {
    name:
      "Jooble",

    title:
      "Set Up a Jooble API Key",

    description:
      "Jooble uses one REST API key for job search requests.",

    url:
      "https://jooble.org/api/about",

    linkLabel:
      "Open Jooble REST API",

    steps: [
      "Open Jooble's official REST API page.",
      "Complete the API access form and request a key for BreakVeil.",
      "Copy the API key Jooble provides.",
      "Return to BreakVeil and paste it into the Jooble API Key field.",
      "Select Save and Test Jooble. BreakVeil will encrypt the key locally and run a small search request.",
    ],

    notes: [
      "Jooble search results contain a description snippet rather than the full vacancy text.",
      "A successful test enables Jooble in Discover Jobs and Automatic Job Discovery.",
    ],
  },

  arbeitnow: {
    name:
      "Arbeitnow (Germany)",

    title:
      "Use the Arbeitnow Public API",

    description:
      "Arbeitnow provides a public Germany-focused jobs API and does not require an API key.",

    url:
      "https://www.arbeitnow.com/blog/job-board-api",

    linkLabel:
      "Open Arbeitnow API Guide",

    steps: [
      "No account, API key or credential setup is required.",
      "Select Test Connection in BreakVeil to confirm that the public endpoint is reachable.",
      "Open Discover Jobs and select Arbeitnow when you want to include Germany-focused vacancies.",
      "Enable Arbeitnow under Automatic Job Discovery only when you deliberately want Germany or broader European results included.",
    ],

    notes: [
      "Arbeitnow supplies full descriptions through the API and BreakVeil preserves a visible link back to the original listing.",
      "The source is not enabled in automatic discovery by default. BreakVeil skips it for ordinary UK location searches and hides listings that appear to be written mainly in German.",
    ],
  },

  jobicy: {
    name:
      "Jobicy (Remote)",

    title:
      "Use the Jobicy Remote Jobs API",

    description:
      "Jobicy provides a public remote-jobs API with full descriptions and no API key requirement.",

    url:
      "https://jobicy.com/jobs-rss-feed",

    linkLabel:
      "Open Jobicy API Guide",

    steps: [
      "No account, API key or credential setup is required.",
      "Select Test Connection in BreakVeil to confirm that the public endpoint is reachable.",
      "Open Discover Jobs and choose Jobicy when searching for Remote, UK, Europe, EMEA or Worldwide roles.",
      "Enable Jobicy in Automatic Job Discovery only when your preferred locations include a broad remote region.",
    ],

    notes: [
      "Jobicy supplies full descriptions, salary fields when available and original listing links.",
      "Its public feed is intentionally delayed and BreakVeil reuses a shared one-hour cache to avoid unnecessary polling.",
    ],
  },

  remotive: {
    name:
      "Remotive (Remote)",

    title:
      "Use the Remotive Public API",

    description:
      "Remotive provides a public remote-jobs API with full descriptions and no API key requirement.",

    url:
      "https://remotive.com/remote-jobs/api",

    linkLabel:
      "Open Remotive API Guide",

    steps: [
      "No account, API key or credential setup is required.",
      "Select Test Connection in BreakVeil to confirm that the public endpoint is reachable.",
      "Open Discover Jobs and choose Remotive when searching for Remote, UK, Europe, EMEA or Worldwide roles.",
      "Enable Remotive in Automatic Job Discovery only when your preferred locations include a broad remote region.",
    ],

    notes: [
      "Remotive requires visible source attribution and its original listing link; BreakVeil preserves both.",
      "Public API listings are delayed by 24 hours and BreakVeil refreshes the shared feed no more than once every six hours.",
    ],
  },
}

function getJobSourceLabel(
  source,
) {
  return getJobProviderLabel(
    source,
  )
}


function formatDateTime(
  value,
) {
  return formatPreferenceDateTime(
    value,
  )
}

function getScaleDescription(
  scale,
) {
  if (
    scale <=
    85
  ) {
    return "Compact — fits the most content on screen."
  }

  if (
    scale <=
    95
  ) {
    return "Reduced — fits more cards and results."
  }

  if (
    scale ===
    100
  ) {
    return "Standard — the original BreakVeil size."
  }

  if (
    scale <=
    110
  ) {
    return "Comfortable — slightly larger controls and text."
  }

  return "Large — maximum readability."
}

function getMessageAppearance(
  message,
) {
  const normalisedMessage =
    String(
      message ||
      "",
    ).toLowerCase()

  if (
    normalisedMessage.includes(
      "could not",
    ) ||
    normalisedMessage.includes(
      "unavailable",
    ) ||
    normalisedMessage.includes(
      "failed",
    ) ||
    normalisedMessage.includes(
      "error",
    ) ||
    normalisedMessage.includes(
      "unable",
    )
  ) {
    return {
      icon:
        AlertTriangle,

      containerClass:
        "border-red-500/20 bg-red-500/[0.07]",

      iconClass:
        "text-red-300",

      textClass:
        "text-red-100/85",
    }
  }

  if (
    normalisedMessage.includes(
      "restart",
    ) ||
    normalisedMessage.includes(
      "required",
    ) ||
    normalisedMessage.includes(
      "warning",
    )
  ) {
    return {
      icon:
        Info,

      containerClass:
        "border-amber-500/20 bg-amber-500/[0.07]",

      iconClass:
        "text-amber-300",

      textClass:
        "text-amber-100/85",
    }
  }

  return {
    icon:
      CheckCircle2,

    containerClass:
      "border-emerald-500/20 bg-emerald-500/[0.06]",

    iconClass:
      "text-emerald-300",

    textClass:
      "text-zinc-300",
  }
}

export default function Settings() {
  const navigate =
    useNavigate()

  const location =
    useLocation()
  const [
    status,
    setStatus,
  ] = useState(
    emptyStatus,
  )

  const [
    uiPreferences,
    setUiPreferences,
  ] = useState(
    loadUiPreferences,
  )

  const [
    activeCategory,
    setActiveCategory,
  ] = useState(
    loadSettingsCategory,
  )

  const [
    desktopSettings,
    setDesktopSettings,
  ] = useState(
    emptyDesktopSettings,
  )

  const [
    desktopSettingsLoading,
    setDesktopSettingsLoading,
  ] = useState(true)

  const [
    reedApiKey,
    setReedApiKey,
  ] = useState("")

  const [
    adzunaAppId,
    setAdzunaAppId,
  ] = useState("")

  const [
    adzunaAppKey,
    setAdzunaAppKey,
  ] = useState("")

  const [
    joobleApiKey,
    setJoobleApiKey,
  ] = useState("")

  const [
    showReedKey,
    setShowReedKey,
  ] = useState(false)

  const [
    showAdzunaId,
    setShowAdzunaId,
  ] = useState(false)

  const [
    showAdzunaKey,
    setShowAdzunaKey,
  ] = useState(false)

  const [
    showJoobleKey,
    setShowJoobleKey,
  ] = useState(false)

  const [
    busyAction,
    setBusyAction,
  ] = useState("")

  const [
    sourceToRemove,
    setSourceToRemove,
  ] = useState(null)

  const [
    activeGuide,
    setActiveGuide,
  ] = useState("")

  const [
    message,
    setMessage,
  ] = useState("")

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  useEffect(() => {
    loadStatus()
    loadDesktopSettings()
  }, [])

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        location.search,
      )

    const requestedCategory =
      parameters.get(
        "category",
      )

    const requestedSection =
      parameters.get(
        "section",
      )

    const requestedAction =
      parameters.get(
        "action",
      )

    if (
      requestedCategory &&
      settingsCategories.some(
        (category) =>
          category.id ===
          requestedCategory,
      )
    ) {
      selectSettingsCategory(
        requestedCategory,
      )
    }

    const timeoutId =
      window.setTimeout(
        () => {
          if (
            requestedSection
          ) {
            document
              .getElementById(
                requestedSection,
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",

                block:
                  "start",
              })
          }

          if (
            requestedAction ===
            "setup"
          ) {
            window.dispatchEvent(
              new Event(
                "jobpilot:open-setup-guide",
              ),
            )
          }
        },
        140,
      )

    return () =>
      window.clearTimeout(
        timeoutId,
      )
  }, [
    location.search,
  ])

  useEffect(() => {
    function handleCategoryRequest(
      event,
    ) {
      const requestedCategory =
        event.detail
          ?.category

      if (
        requestedCategory &&
        settingsCategories.some(
          (category) =>
            category.id ===
            requestedCategory,
        )
      ) {
        selectSettingsCategory(
          requestedCategory,
        )
      }
    }

    window.addEventListener(
      "jobpilot:settings-category-request",
      handleCategoryRequest,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:settings-category-request",
        handleCategoryRequest,
      )
    }
  }, [])

  async function loadDesktopSettings() {
    setDesktopSettingsLoading(
      true,
    )

    try {
      if (
        !window.jobPilot
          ?.appSettings
      ) {
        setMessage(
          "Desktop window settings are unavailable. Fully restart BreakVeil.",
        )

        return
      }

      const result =
        await window.jobPilot
          .appSettings
          .get()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "BreakVeil could not load desktop settings.",
        )

        return
      }

      setDesktopSettings({
        ...emptyDesktopSettings,

        ...(result.settings ||
          {}),
      })
    } catch (error) {
      setMessage(
        error?.message ||
        "BreakVeil could not load desktop settings.",
      )
    } finally {
      setDesktopSettingsLoading(
        false,
      )
    }
  }

  async function updateDesktopSettings(
    changes,
  ) {
    setDesktopSettingsLoading(
      true,
    )

    try {
      const result =
        await window.jobPilot
          .appSettings
          .update(
            changes,
          )

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The desktop setting could not be updated.",
        )

        return
      }

      setDesktopSettings({
        ...emptyDesktopSettings,

        ...(result.settings ||
          {}),
      })

      setMessage(
        "Desktop behaviour updated.",
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "The desktop setting could not be updated.",
      )
    } finally {
      setDesktopSettingsLoading(
        false,
      )
    }
  }

  async function loadStatus() {
    setIsLoading(
      true,
    )

    try {
      if (
        !window.jobPilot
          ?.jobSources
      ) {
        setMessage(
          "Job-source controls are unavailable. Fully restart BreakVeil.",
        )

        return
      }

      const result =
        await window.jobPilot
          .jobSources
          .getStatus()

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "BreakVeil could not load the job-source settings.",
        )

        return
      }

      updateStatus(
        result,
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "BreakVeil could not load the job-source settings.",
      )
    } finally {
      setIsLoading(
        false,
      )
    }
  }

  function updateStatus(
    result,
  ) {
    const statusValue =
      result?.status ||
      result

    setStatus({
      encryptionAvailable:
        Boolean(
          statusValue
            ?.encryptionAvailable,
        ),

      securityLabel:
        statusValue
          ?.securityLabel ||
        "Operating-system encryption",

      cacheEntryCount:
        Number(
          statusValue
            ?.cacheEntryCount ||
            0,
        ),

      cacheSummary: {
        ...emptyStatus
          .cacheSummary,
        ...(statusValue
          ?.cacheSummary ||
          {}),
      },

      searchHealth: {
        ...emptyStatus
          .searchHealth,
        ...(statusValue
          ?.searchHealth ||
          {}),
      },

      sources:
        mergeJobSourceMap(
          statusValue
            ?.sources,
        ),
    })
  }

  function openSetupDestination(
    destination,
    {
      category =
        "",

      section =
        "",
    } = {},
  ) {
    if (
      category
    ) {
      selectSettingsCategory(
        category,
      )
    }

    const parameters =
      new URLSearchParams()

    if (
      category
    ) {
      parameters.set(
        "category",
        category,
      )
    }

    if (
      section
    ) {
      parameters.set(
        "section",
        section,
      )
    }

    parameters.set(
      "setup",
      "1",
    )

    const target =
      `${destination}?${parameters.toString()}`

    navigate(
      target,
    )
  }

  function selectSettingsCategory(
    category,
  ) {
    setActiveCategory(
      category,
    )

    try {
      localStorage.setItem(
        settingsCategoryStorageKey,
        category,
      )
    } catch {
      // The selected category still works for the current session.
    }
  }

  function updateUiPreference(
    field,
    value,
  ) {
    const updatedPreferences =
      saveUiPreferences({
        ...uiPreferences,

        [field]:
          value,
      })

    setUiPreferences(
      updatedPreferences,
    )

    setMessage(
      "Preference saved.",
    )
  }

  function resetAppearance() {
    const updatedPreferences =
      saveUiPreferences({
        ...uiPreferences,

        theme:
          defaultUiPreferences.theme,

        scale:
          defaultUiPreferences.scale,

        scrollbars:
          defaultUiPreferences.scrollbars,

        spacing:
          defaultUiPreferences.spacing,

        reduceMotion:
          defaultUiPreferences.reduceMotion,

        highContrast:
          defaultUiPreferences.highContrast,

        focusOutlines:
          defaultUiPreferences.focusOutlines,

        solidPanels:
          defaultUiPreferences.solidPanels,

        buttonLabels:
          defaultUiPreferences.buttonLabels,
      })

    setUiPreferences(
      updatedPreferences,
    )

    setMessage(
      "Appearance and accessibility settings were restored to their defaults.",
    )
  }

  async function saveSource(
    source,
    credentials,
  ) {
    setBusyAction(
      `${source}:save`,
    )

    setMessage(
      `Saving and testing ${getJobSourceLabel(source)}...`,
    )

    try {
      const result =
        await window.jobPilot
          .jobSources
          .saveSource({
            source,
            ...credentials,
            test:
              true,
          })

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The credentials could not be saved.",
        )

        return
      }

      updateStatus(
        result.status,
      )

      if (
        source ===
        "reed"
      ) {
        setReedApiKey(
          "",
        )
      } else if (
        source ===
        "jooble"
      ) {
        setJoobleApiKey(
          "",
        )
      } else {
        setAdzunaAppId(
          "",
        )

        setAdzunaAppKey(
          "",
        )
      }

      if (
        result.test?.ok
      ) {
        setMessage(
          `${getJobSourceLabel(source)} was saved securely and connected successfully.`,
        )
      } else {
        setMessage(
          `${getJobSourceLabel(source)} was saved, but the connection test failed: ${result.test?.error || "Unknown error"}`,
        )
      }
    } catch (error) {
      setMessage(
        error?.message ||
        "The credentials could not be saved.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function testSource(
    source,
  ) {
    setBusyAction(
      `${source}:test`,
    )

    setMessage(
      `Testing ${getJobSourceLabel(source)}...`,
    )

    try {
      const result =
        await window.jobPilot
          .jobSources
          .testSource(
            source,
          )

      if (
        result?.status
      ) {
        updateStatus(
          result.status,
        )
      }

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The connection test failed.",
        )

        return
      }

      setMessage(
        result.test?.message ||
        "Connection successful.",
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "The connection test failed.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  async function removeSource() {
    if (
      !sourceToRemove
    ) {
      return
    }

    const source =
      sourceToRemove

    setSourceToRemove(
      null,
    )

    setBusyAction(
      `${source}:remove`,
    )

    try {
      const result =
        await window.jobPilot
          .jobSources
          .removeSource(
            source,
          )

      if (!result?.ok) {
        setMessage(
          result?.error ||
          "The credentials could not be removed.",
        )

        return
      }

      updateStatus(
        result.status,
      )

      setMessage(
        `${getJobSourceLabel(source)} credentials were removed.`,
      )
    } catch (error) {
      setMessage(
        error?.message ||
        "The credentials could not be removed.",
      )
    } finally {
      setBusyAction(
        "",
      )
    }
  }

  const reed =
    status.sources.reed

  const adzuna =
    status.sources.adzuna

  const jooble =
    status.sources.jooble

  const arbeitnow =
    status.sources.arbeitnow

  const jobicy =
    status.sources.jobicy

  const remotive =
    status.sources.remotive

  const activeCategoryDetails =
    settingsCategories.find(
      (category) =>
        category.id ===
        activeCategory,
    ) ||
    settingsCategories[0]

  const messageAppearance =
    getMessageAppearance(
      message,
    )

  const MessageIcon =
    messageAppearance.icon

  return (
    <div className="min-w-0 pb-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Application Preferences
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Settings
          </h1>

          <p className="mt-2 max-w-3xl text-zinc-400">
            Personalise BreakVeil, manage connected services and control local data, backups and privacy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-zinc-400">
            <SlidersHorizontal
              size={13}
            />
            7 Settings Categories
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-emerald-300">
            <CheckCircle2
              size={13}
            />
            Changes Save Automatically
          </span>
        </div>
      </header>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm",

            messageAppearance
              .containerClass,
          ].join(
            " ",
          )}
        >
          <MessageIcon
            size={17}
            className={[
              "mt-0.5 shrink-0",

              messageAppearance
                .iconClass,
            ].join(
              " ",
            )}
          />

          <span
            className={[
              "min-w-0 flex-1 leading-6",

              messageAppearance
                .textClass,
            ].join(
              " ",
            )}
          >
            {message}
          </span>

          <button
            type="button"
            onClick={() =>
              setMessage(
                "",
              )
            }
            className="rounded-lg p-1 text-zinc-500 transition hover:bg-black/10 hover:text-zinc-200"
            aria-label="Dismiss settings message"
            title="Dismiss"
          >
            <X
              size={15}
            />
          </button>
        </div>
      )}

      <SettingsCategoryNavigation
        categories={
          settingsCategories
        }
        activeCategory={
          activeCategory
        }
        activeCategoryDetails={
          activeCategoryDetails
        }
        onSelect={
          selectSettingsCategory
        }
      />

      {activeCategory === "appearance" && (
        <>
      <section id="settings-appearance" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            Palette
          }
          title="Appearance"
          description="Change the overall theme, interface size and scrollbar visibility."
        >
          <button
            type="button"
            onClick={
              resetAppearance
            }
            className={secondaryButtonClass}
          >
            <RefreshCw
              size={15}
            />
            Reset Appearance
          </button>
        </SettingsHeader>

        <div className="p-5 sm:p-6">
          <div>
            <p className={sectionLabelClass}>
              Interface Theme
            </p>

            <div className="jp-grid-compact mt-3 gap-3">
              {uiThemeOptions.map(
                (theme) => (
                  <button
                    key={
                      theme.value
                    }
                    type="button"
                    onClick={() =>
                      updateUiPreference(
                        "theme",
                        theme.value,
                      )
                    }
                    className={[
                      "min-w-0 rounded-2xl border p-3 text-left transition duration-200",

                      uiPreferences.theme ===
                        theme.value
                        ? "border-sky-500/40 bg-sky-500/10 shadow-[0_12px_28px_rgba(14,165,233,0.08)] ring-1 ring-sky-500/10"
                        : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70",
                    ].join(
                      " ",
                    )}
                  >
                    <div
                      className="h-16 rounded-lg border border-black/10"
                      style={{
                        background:
                          theme.preview,
                      }}
                    />

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {
                          theme.label
                        }
                      </p>

                      {uiPreferences.theme ===
                        theme.value && (
                        <CheckCircle2
                          size={15}
                          className="shrink-0 text-sky-300"
                        />
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      {
                        theme.description
                      }
                    </p>
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="jp-grid-sidebar jp-grid-equal mt-6 gap-4">
            <label className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <span className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                    <Monitor
                      size={16}
                    />
                    Interface Scale
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-zinc-600">
                    Similar to Minecraft GUI Scale: smaller values fit more panels, cards and search results on screen.
                  </span>
                </span>

                <span className="w-fit rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-zinc-300">
                  {uiPreferences.scale}%
                </span>
              </span>

              <input
                type="range"
                min="80"
                max="120"
                step="5"
                value={
                  uiPreferences.scale
                }
                onChange={(event) =>
                  updateUiPreference(
                    "scale",
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className="mt-5 w-full accent-sky-400"
              />

              <div className="mt-2 flex justify-between text-[11px] text-zinc-600">
                <span>
                  80% More Content
                </span>

                <span>
                  100% Standard
                </span>

                <span>
                  120% Larger
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-zinc-500">
                {getScaleDescription(
                  uiPreferences.scale,
                )}
              </p>
            </label>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <ScrollText
                  size={16}
                />
                Scrollbars
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Keep scrollbars visible for clarity or hide them while retaining mouse-wheel and touchpad scrolling.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  [
                    "visible",
                    "Visible",
                  ],
                  [
                    "hidden",
                    "Hidden",
                  ],
                ].map(
                  ([
                    value,
                    label,
                  ]) => (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        updateUiPreference(
                          "scrollbars",
                          value,
                        )
                      }
                      className={[
                        "rounded-lg border px-3 py-2.5 text-sm transition",

                        uiPreferences.scrollbars ===
                          value
                          ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                          : "border-zinc-700 text-zinc-400 hover:bg-zinc-800",
                      ].join(
                        " ",
                      )}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

        </>
      )}

      {activeCategory === "general" && (
        <>
      <section id="settings-startup" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            AppWindow
          }
          title="Startup and Window Behaviour"
          description="Choose how BreakVeil opens, closes and selects its first page."
        >
          {desktopSettingsLoading && (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
              Updating
            </span>
          )}
        </SettingsHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <PreferenceToggle
            icon={
              Power
            }
            title="Launch BreakVeil When Windows Starts"
            description={
              desktopSettings.startupAvailable
                ? "Starts BreakVeil automatically after you sign in to Windows."
                : "Available after BreakVeil is installed as a Windows application."
            }
            checked={
              desktopSettings.launchAtStartup
            }
            disabled={
              !desktopSettings.startupAvailable ||
              desktopSettingsLoading
            }
            onChange={(checked) =>
              updateDesktopSettings({
                launchAtStartup:
                  checked,
              })
            }
          />

          <PreferenceToggle
            icon={
              AppWindow
            }
            title="Start Minimized to the System Tray"
            description="Opens BreakVeil quietly in the tray instead of showing the main window."
            checked={
              desktopSettings.startMinimized
            }
            disabled={
              desktopSettingsLoading
            }
            onChange={(checked) =>
              updateDesktopSettings({
                startMinimized:
                  checked,
              })
            }
          />

          <PreferenceToggle
            icon={
              AppWindow
            }
            title="Keep Running When the Window Is Closed"
            description="Closing the main window hides BreakVeil in the tray so discovery and delivery can continue."
            checked={
              desktopSettings.keepRunningOnClose
            }
            disabled={
              desktopSettingsLoading
            }
            onChange={(checked) =>
              updateDesktopSettings({
                keepRunningOnClose:
                  checked,
              })
            }
          />

          <PreferenceToggle
            icon={
              CalendarDays
            }
            title="Remember the Last Page Opened"
            description="Returns to your most recently viewed BreakVeil page at the next launch."
            checked={
              uiPreferences.rememberLastPage
            }
            onChange={(checked) =>
              updateUiPreference(
                "rememberLastPage",
                checked,
              )
            }
          />

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:col-span-2">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-200">
                Default Landing Page
              </span>

              <span className="mt-1 block text-xs leading-5 text-zinc-600">
                Used when remembering the last page is disabled or no previous page is available.
              </span>

              <select
                value={
                  uiPreferences.defaultLandingPage
                }
                onChange={(event) =>
                  updateUiPreference(
                    "defaultLandingPage",
                    event.target.value,
                  )
                }
                className={`${selectClass} mt-4`}
              >
                <option value="dashboard">
                  Dashboard
                </option>
                <option value="jobs">
                  Jobs
                </option>
                <option value="assistant">
                  Assistant
                </option>
                <option value="automation">
                  Automation
                </option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section id="settings-open-source" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-violet-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            ScrollText
          }
          title="Open Source & Licence"
          description="BreakVeil can be inspected, modified and shared under GNU GPL version 3."
        />

        <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              BreakVeil AI 0.4.0 | GPL-3.0-only
            </p>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500">
              You may run, study, modify and redistribute BreakVeil under the GPL. Distributed modified versions must provide their corresponding source under the same licence. The software is provided without warranty.
            </p>
          </div>

          <a
            href="https://www.gnu.org/licenses/gpl-3.0.html"
            target="_blank"
            rel="noreferrer"
            className={secondaryButtonClass}
          >
            <ExternalLink
              size={15}
            />
            Read GPL v3
          </a>
        </div>
      </section>

        </>
      )}

      {activeCategory === "accessibility" && (
        <>
      <section id="settings-accessibility" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            Accessibility
          }
          title="Accessibility"
          description="Adjust motion, contrast, spacing, focus indicators and control labels."
        />

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          <PreferenceToggle
            title="Reduce Animations"
            description="Removes most transitions and animated movement."
            checked={
              uiPreferences.reduceMotion
            }
            onChange={(checked) =>
              updateUiPreference(
                "reduceMotion",
                checked,
              )
            }
          />

          <PreferenceToggle
            title="High-Contrast Highlights"
            description="Strengthens selected states, status borders and coloured panels."
            checked={
              uiPreferences.highContrast
            }
            onChange={(checked) =>
              updateUiPreference(
                "highContrast",
                checked,
              )
            }
          />

          <PreferenceToggle
            title="Enhanced Focus Indicators"
            description="Shows a thick blue ring around buttons, links and fields when they are clicked or reached with the Tab key."
            checked={
              uiPreferences.focusOutlines
            }
            onChange={(checked) =>
              updateUiPreference(
                "focusOutlines",
                checked,
              )
            }
          />

          <PreferenceToggle
            title="Use Solid Backgrounds"
            description="Removes transparency from neutral and coloured panels, badges and selected states across the application."
            checked={
              uiPreferences.solidPanels
            }
            onChange={(checked) =>
              updateUiPreference(
                "solidPanels",
                checked,
              )
            }
          />

          <PreferenceToggle
            title="Always Show Icon Button Labels"
            description="Adds text beside supported icon-only controls where space allows."
            checked={
              uiPreferences.buttonLabels
            }
            onChange={(checked) =>
              updateUiPreference(
                "buttonLabels",
                checked,
              )
            }
          />

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-sm font-semibold text-zinc-200">
              Interface Spacing
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              Compact spacing fits more content without reducing the chosen text scale.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                [
                  "comfortable",
                  "Comfortable",
                ],
                [
                  "compact",
                  "Compact",
                ],
              ].map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={
                      value
                    }
                    type="button"
                    onClick={() =>
                      updateUiPreference(
                        "spacing",
                        value,
                      )
                    }
                    className={[
                      "rounded-lg border px-3 py-2.5 text-sm transition",

                      uiPreferences.spacing ===
                        value
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800",
                    ].join(
                      " ",
                    )}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          <AccessibilityPreview
            spacing={
              uiPreferences.spacing
            }
            solidPanels={
              uiPreferences.solidPanels
            }
            focusOutlines={
              uiPreferences.focusOutlines
            }
          />
        </div>
      </section>

        </>
      )}

      {activeCategory === "general" && (
        <>
      <section id="settings-regional" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            MapPin
          }
          title="Regional Formatting"
          description="Choose how dates and search distances appear throughout BreakVeil."
        />

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <PreferenceSelect
            icon={
              CalendarDays
            }
            title="Date Format"
            description="Applies to job dates, activity history, applications and automation records."
            value={
              uiPreferences.dateFormat
            }
            onChange={(value) =>
              updateUiPreference(
                "dateFormat",
                value,
              )
            }
            options={[
              [
                "DD/MM/YYYY",
                "DD/MM/YYYY",
              ],
              [
                "MM/DD/YYYY",
                "MM/DD/YYYY",
              ],
              [
                "YYYY-MM-DD",
                "YYYY-MM-DD",
              ],
            ]}
          />

          <PreferenceSelect
            icon={
              MapPin
            }
            title="Distance Unit"
            description="Search APIs continue using their supported values while BreakVeil displays your preferred unit."
            value={
              uiPreferences.distanceUnit
            }
            onChange={(value) =>
              updateUiPreference(
                "distanceUnit",
                value,
              )
            }
            options={[
              [
                "miles",
                "Miles",
              ],
              [
                "kilometres",
                "Kilometres",
              ],
            ]}
          />
        </div>
      </section>

        </>
      )}

      {activeCategory === "applications" && (
        <>
      <section id="settings-applications" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            FileText
          }
          title="Default Application Preferences"
          description="Set the starting choices used when BreakVeil prepares new application and interview content."
        />

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <PreferenceSelect
            title="Preferred Cover-Letter Length"
            description="Controls the starting length of newly generated local cover-letter text."
            value={
              uiPreferences.coverLetterLength
            }
            onChange={(value) =>
              updateUiPreference(
                "coverLetterLength",
                value,
              )
            }
            options={[
              [
                "concise",
                "Concise",
              ],
              [
                "standard",
                "Standard",
              ],
              [
                "detailed",
                "Detailed",
              ],
            ]}
          />

          <PreferenceSelect
            title="Default Email Subject Format"
            description="Changes the subject suggested when a new application email is prepared."
            value={
              uiPreferences.emailSubjectFormat
            }
            onChange={(value) =>
              updateUiPreference(
                "emailSubjectFormat",
                value,
              )
            }
            options={[
              [
                "role-name",
                "Application for Role – Candidate Name",
              ],
              [
                "name-role",
                "Candidate Name – Application for Role",
              ],
              [
                "role-company",
                "Role Application – Company",
              ],
            ]}
          />

          <InterviewStructurePicker
            value={
              uiPreferences.interviewAnswerStructure
            }
            onChange={(value) =>
              updateUiPreference(
                "interviewAnswerStructure",
                value,
              )
            }
          />

          <PreferenceToggle
            title="Include a Cover Letter by Default"
            description="Automatically selects the default cover letter when a new application review is opened."
            checked={
              uiPreferences.includeCoverLetterByDefault
            }
            onChange={(checked) =>
              updateUiPreference(
                "includeCoverLetterByDefault",
                checked,
              )
            }
          />
        </div>
      </section>

        </>
      )}

      {activeCategory === "general" && (
        <>
      <section id="settings-guided-setup" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            Sparkles
          }
          title="Guided Setup"
          description="Use the full wizard or jump directly to the exact page needed for each setup task."
        >
          <button
            type="button"
            onClick={
              requestSetupGuide
            }
            className={primaryButtonClass}
          >
            <Sparkles
              size={16}
            />
            Start Guided Setup
          </button>
        </SettingsHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <SetupDestinationCard
            number="1"
            icon={
              Palette
            }
            title="Appearance"
            description="Choose a theme, scale, spacing and accessibility preferences."
            action="Open Appearance"
            onClick={() =>
              openSetupDestination(
                "/settings",
                {
                  category:
                    "appearance",
                },
              )
            }
          />

          <SetupDestinationCard
            number="2"
            icon={
              UserRound
            }
            title="Candidate Profile"
            description="Add your work history, skills, preferred roles and locations."
            action="Open Profile"
            onClick={() =>
              openSetupDestination(
                "/profile",
              )
            }
          />

          <SetupDestinationCard
            number="3"
            icon={
              FileText
            }
            title="Resume Library"
            description="Import your main CV and select the documents used by default."
            action="Open Documents"
            onClick={() =>
              openSetupDestination(
                "/resume-library",
              )
            }
          />

          <SetupDestinationCard
            number="4"
            icon={
              KeyRound
            }
            title="Connections"
            description="Configure Reed, Adzuna or Jooble, review the Germany-focused public Arbeitnow source, then connect Gmail from Automation."
            action="Open Connections"
            onClick={() =>
              openSetupDestination(
                "/settings",
                {
                  category:
                    "connections",
                },
              )
            }
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-zinc-600">
            Opening a destination from the wizard pauses your progress, so you can return and continue later.
          </p>

          <button
            type="button"
            onClick={() =>
              openSetupDestination(
                "/automation",
                {
                  section:
                    "gmail",
                },
              )
            }
            className={secondaryButtonClass}
          >
            <ExternalLink
              size={15}
            />
            Open Gmail and Automation
          </button>
        </div>
      </section>

        </>
      )}

      {activeCategory === "connections" && (
        <>
      <section id="settings-connections" className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
        <SettingsHeader
          icon={
            ShieldCheck
          }
          title="Protected Credential Storage"
          description="API credentials are encrypted locally and are never displayed again after saving."
        >
          <div className="flex flex-wrap items-center gap-2">
            {isLoading ? (
              <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
                Checking
              </span>
            ) : (
              <span
                className={[
                  badgeClass,

                  status.encryptionAvailable
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/20 bg-red-500/10 text-red-300",
                ].join(
                  " ",
                )}
              >
                {status.encryptionAvailable ? (
                  <CheckCircle2
                    size={13}
                  />
                ) : (
                  <XCircle
                    size={13}
                  />
                )}

                {status.encryptionAvailable
                  ? "Available"
                  : "Unavailable"}
              </span>
            )}

            <button
              type="button"
              onClick={
                loadStatus
              }
              disabled={
                isLoading
              }
              className={secondaryButtonClass}
            >
              <RefreshCw
                size={15}
                className={
                  isLoading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>
          </div>
        </SettingsHeader>

        <div className="px-5 py-4 text-xs leading-5 text-zinc-600 sm:px-6">
          Current protection:{" "}
          <span className="font-medium text-zinc-400">
            {
              status.securityLabel
            }
          </span>
          .
        </div>
      </section>

      {!status.encryptionAvailable &&
        !isLoading && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <div>
              <p className="font-medium text-red-200">
                Secure Storage Is Unavailable
              </p>

              <p className="mt-1 text-sm leading-6 text-red-200/70">
                BreakVeil will not save API credentials without operating-system encryption.
              </p>
            </div>
          </div>
        )}

      <section
        id="settings-search-reliability"
        className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
      >
        <SettingsHeader
          icon={
            Wifi
          }
          title="Job Search Reliability"
          description="Provider health is tracked separately, so one failed source does not block another source or affect saved jobs."
        >
          <span
            className={[
              badgeClass,

              status.searchHealth
                ?.state ===
                "healthy"
                ? "jp-tone-success"
                : status.searchHealth
                    ?.state ===
                    "degraded"
                  ? "jp-tone-warning"
                  : "jp-tone-neutral",
            ].join(
              " ",
            )}
          >
            {status.searchHealth
              ?.state ===
              "healthy"
              ? "Sources Healthy"
              : status.searchHealth
                  ?.state ===
                  "degraded"
                ? "Partially Available"
                : "Awaiting Search"}
          </span>
        </SettingsHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <ReliabilityStatusCard
            label="Browser Connection"
            value={
              navigator.onLine
                ? "Online"
                : "Offline"
            }
            healthy={
              navigator.onLine
            }
            detail={
              navigator.onLine
                ? "Live provider requests are allowed"
                : "Local tools and cached results remain available"
            }
          />

          <ReliabilityStatusCard
            label="Fresh Search Cache"
            value={
              status.cacheSummary
                ?.freshCount ||
              0
            }
            healthy
            detail="Reusable for 15 minutes"
          />

          <ReliabilityStatusCard
            label="Retained Fallback Cache"
            value={
              status.cacheSummary
                ?.staleCount ||
              0
            }
            healthy={
              Boolean(
                status.cacheSummary
                  ?.staleCount,
              )
            }
            detail="Available for matching searches during outages"
          />

          <ReliabilityStatusCard
            label="Unhealthy Providers"
            value={
              status.searchHealth
                ?.unhealthyCount ||
              0
            }
            healthy={
              !status.searchHealth
                ?.unhealthyCount
            }
            detail="Other configured providers continue independently"
          />
        </div>

        <div className="grid gap-3 border-t border-zinc-800 p-5 md:grid-cols-2 xl:grid-cols-4 sm:p-6">
          {Object.values(
            status.sources,
          )
            .filter(
              (provider) =>
                !provider.directEmployer,
            )
            .map(
              (provider) => (
                <ProviderHealthRow
                  key={
                    provider.source
                  }
                  provider={
                    provider
                  }
                />
              ),
            )}
        </div>
      </section>

      <ConnectionGroup
        id="settings-built-in-job-sources"
        title="Built-in Job Sources"
        description="Core UK, regional and remote providers maintained directly by BreakVeil. Collapse this group when you do not need to change a connection."
        defaultOpen
      >
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <div
            id="settings-reed"
            className="scroll-mt-28"
          >
          <ProviderCard
            name="Reed"
            description="Official UK vacancy search through Reed’s Jobseeker API."
            sourceStatus={
              reed
            }
            busy={
              busyAction.startsWith(
                "reed:",
              )
            }
            onOpenGuide={() =>
              setActiveGuide(
                "reed",
              )
            }
            onTest={() =>
              testSource(
                "reed",
              )
            }
            onRemove={() =>
              setSourceToRemove(
                "reed",
              )
            }
          >
            <SecretInput
              label="Reed API Key"
              value={
                reedApiKey
              }
              onChange={
                setReedApiKey
              }
              visible={
                showReedKey
              }
              onToggleVisibility={() =>
                setShowReedKey(
                  (current) =>
                    !current,
                )
              }
              placeholder={
                reed.configured
                  ? "Enter a replacement key"
                  : "Enter your Reed API key"
              }
            />

            <button
              type="button"
              disabled={
                !status.encryptionAvailable ||
                !reedApiKey.trim() ||
                busyAction !==
                  ""
              }
              onClick={() =>
                saveSource(
                  "reed",
                  {
                    apiKey:
                      reedApiKey,
                  },
                )
              }
              className={`${primaryButtonClass} mt-5 w-full justify-center`}
            >
              {busyAction ===
              "reed:save" ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={16}
                />
              )}

              Save and Test Reed
            </button>
          </ProviderCard>
          </div>

          <div
            id="settings-jooble"
            className="scroll-mt-28"
          >
          <ProviderCard
            name="Jooble"
            description="Official vacancy search through Jooble’s REST API."
            sourceStatus={
              jooble
            }
            busy={
              busyAction.startsWith(
                "jooble:",
              )
            }
            onOpenGuide={() =>
              setActiveGuide(
                "jooble",
              )
            }
            onTest={() =>
              testSource(
                "jooble",
              )
            }
            onRemove={() =>
              setSourceToRemove(
                "jooble",
              )
            }
          >
            <SecretInput
              label="Jooble API Key"
              value={
                joobleApiKey
              }
              onChange={
                setJoobleApiKey
              }
              visible={
                showJoobleKey
              }
              onToggleVisibility={() =>
                setShowJoobleKey(
                  (current) =>
                    !current,
                )
              }
              placeholder={
                jooble.configured
                  ? "Enter a replacement key"
                  : "Enter your Jooble API key"
              }
            />

            <button
              type="button"
              disabled={
                !status.encryptionAvailable ||
                !joobleApiKey.trim() ||
                busyAction !==
                  ""
              }
              onClick={() =>
                saveSource(
                  "jooble",
                  {
                    apiKey:
                      joobleApiKey,
                  },
                )
              }
              className={`${primaryButtonClass} mt-5 w-full justify-center`}
            >
              {busyAction ===
              "jooble:save" ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={16}
                />
              )}

              Save and Test Jooble
            </button>
          </ProviderCard>
          </div>

          <div
            id="settings-jobicy"
            className="scroll-mt-28"
          >
            <ProviderCard
              name="Jobicy (Remote)"
              description="Global remote vacancy feed with full descriptions, optional salary data and no API key requirement."
              sourceStatus={
                jobicy
              }
              busy={
                busyAction.startsWith(
                  "jobicy:",
                )
              }
              onOpenGuide={() =>
                setActiveGuide(
                  "jobicy",
                )
              }
              onTest={() =>
                testSource(
                  "jobicy",
                )
              }
            >
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <Globe2
                    size={17}
                    className="mt-0.5 shrink-0 text-violet-300"
                  />

                  <div>
                    <p className="text-sm font-medium text-violet-100">
                      Remote source — no API key
                    </p>

                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Use a broad location such as Remote, UK, Europe, EMEA or Worldwide. BreakVeil reuses the feed for one hour to respect Jobicy&apos;s access guidance.
                    </p>
                  </div>
                </div>
              </div>
            </ProviderCard>
          </div>
        </div>

        <div className="space-y-6">
          <div
            id="settings-adzuna"
            className="scroll-mt-28"
          >
          <ProviderCard
            name="Adzuna"
            description="Official UK vacancy search through Adzuna’s jobs API."
            sourceStatus={
              adzuna
            }
            busy={
              busyAction.startsWith(
                "adzuna:",
              )
            }
            onOpenGuide={() =>
              setActiveGuide(
                "adzuna",
              )
            }
            onTest={() =>
              testSource(
                "adzuna",
              )
            }
            onRemove={() =>
              setSourceToRemove(
                "adzuna",
              )
            }
          >
            <div className="space-y-4">
              <SecretInput
                label="Adzuna Application ID"
                value={
                  adzunaAppId
                }
                onChange={
                  setAdzunaAppId
                }
                visible={
                  showAdzunaId
                }
                onToggleVisibility={() =>
                  setShowAdzunaId(
                    (current) =>
                      !current,
                  )
                }
                placeholder={
                  adzuna.configured
                    ? "Enter a replacement Application ID"
                    : "Enter your Application ID"
                }
              />

              <SecretInput
                label="Adzuna Application Key"
                value={
                  adzunaAppKey
                }
                onChange={
                  setAdzunaAppKey
                }
                visible={
                  showAdzunaKey
                }
                onToggleVisibility={() =>
                  setShowAdzunaKey(
                    (current) =>
                      !current,
                  )
                }
                placeholder={
                  adzuna.configured
                    ? "Enter a replacement Application Key"
                    : "Enter your Application Key"
                }
              />
            </div>

            <button
              type="button"
              disabled={
                !status.encryptionAvailable ||
                (
                  !adzunaAppId.trim() &&
                  !adzunaAppKey.trim()
                ) ||
                busyAction !==
                  ""
              }
              onClick={() =>
                saveSource(
                  "adzuna",
                  {
                    appId:
                      adzunaAppId,

                    appKey:
                      adzunaAppKey,
                  },
                )
              }
              className={`${primaryButtonClass} mt-5 w-full justify-center`}
            >
              {busyAction ===
              "adzuna:save" ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={16}
                />
              )}

              Save and Test Adzuna
            </button>
          </ProviderCard>
          </div>

          <div
            id="settings-arbeitnow"
            className="scroll-mt-28"
          >
            <ProviderCard
              name="Arbeitnow (Germany)"
              description="Germany-focused vacancy feed with full descriptions, English-only filtering and no API key requirement."
              sourceStatus={
                arbeitnow
              }
              busy={
                busyAction.startsWith(
                  "arbeitnow:",
                )
              }
              onOpenGuide={() =>
                setActiveGuide(
                  "arbeitnow",
                )
              }
              onTest={() =>
                testSource(
                  "arbeitnow",
                )
              }
            >
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <Globe2
                    size={17}
                    className="mt-0.5 shrink-0 text-sky-300"
                  />

                  <div>
                    <p className="text-sm font-medium text-sky-100">
                      No API key required
                    </p>

                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Arbeitnow is Germany-focused. BreakVeil keeps likely English listings only and skips the source when a search location is outside Germany, Europe or International searches.
                    </p>
                  </div>
                </div>
              </div>
            </ProviderCard>
          </div>

          <div
            id="settings-remotive"
            className="scroll-mt-28"
          >
            <ProviderCard
              name="Remotive (Remote)"
              description="Global remote vacancy feed with full descriptions, required attribution and no API key requirement."
              sourceStatus={
                remotive
              }
              busy={
                busyAction.startsWith(
                  "remotive:",
                )
              }
              onOpenGuide={() =>
                setActiveGuide(
                  "remotive",
                )
              }
              onTest={() =>
                testSource(
                  "remotive",
                )
              }
            >
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <Globe2
                    size={17}
                    className="mt-0.5 shrink-0 text-violet-300"
                  />

                  <div>
                    <p className="text-sm font-medium text-violet-100">
                      Remote source — no API key
                    </p>

                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Remotive&apos;s public listings are delayed by 24 hours. BreakVeil preserves attribution and refreshes the shared feed no more than once every six hours.
                    </p>
                  </div>
                </div>
              </div>
            </ProviderCard>
          </div>
        </div>
      </div>
      </ConnectionGroup>

      <CustomJobSourcesPanel
        encryptionAvailable={
          status.encryptionAvailable
        }
        onSourcesChanged={
          loadStatus
        }
      />

      <DirectEmployerSourcesPanel
        onSourcesChanged={
          loadStatus
        }
      />

      <CompanyResearchConnectionCard
        onMessage={
          setMessage
        }
      />


        </>
      )}

      {activeCategory === "data" && (
        <DataRecoverySettings
          onMessage={
            setMessage
          }
          onResetAppearance={
            resetAppearance
          }
        />
      )}

      {activeCategory === "privacy" && (
        <PrivacySettings
          onMessage={
            setMessage
          }
          onConnectionsChanged={
            loadStatus
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(
          sourceToRemove,
        )}
        title={`Remove ${getJobSourceLabel(sourceToRemove)} credentials?`}
        message="The encrypted credentials and related cached searches will be removed from this computer."
        confirmLabel="Remove Credentials"
        cancelLabel="Keep Connected"
        danger
        onConfirm={
          removeSource
        }
        onCancel={() =>
          setSourceToRemove(
            null,
          )
        }
      />

      {activeGuide && (
        <ApiGuideModal
          guide={
            apiGuides[
              activeGuide
            ]
          }
          onClose={() =>
            setActiveGuide(
              "",
            )
          }
        />
      )}
    </div>
  )
}

function SetupDestinationCard({
  number,
  icon:
    Icon,
  title,
  description,
  action,
  onClick,
}) {
  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-sky-500/25 hover:bg-zinc-900/65">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
          <Icon
            size={17}
          />
        </div>

        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-500">
          {number}
        </span>
      </div>

      <h3 className="mt-4 text-sm font-semibold text-zinc-200">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-xs leading-5 text-zinc-600">
        {description}
      </p>

      <button
        type="button"
        onClick={
          onClick
        }
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300 transition group-hover:border-zinc-600 hover:bg-zinc-800"
      >
        {action}
        <ExternalLink
          size={14}
        />
      </button>
    </article>
  )
}

function SettingsCategoryNavigation({
  categories,
  activeCategory,
  activeCategoryDetails,
  onSelect,
}) {
  const ActiveIcon =
    activeCategoryDetails.icon

  return (
    <nav
      aria-label="Settings categories"
      className="sticky top-0 z-30 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 p-2">
          {categories.map(
            (category) => {
              const Icon =
                category.icon

              const selected =
                activeCategory ===
                category.id

              return (
                <button
                  key={
                    category.id
                  }
                  type="button"
                  aria-current={
                    selected
                      ? "page"
                      : undefined
                  }
                  title={
                    category.description
                  }
                  onClick={() =>
                    onSelect(
                      category.id,
                    )
                  }
                  className={[
                    "group relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition",

                    selected
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-200 shadow-sm"
                      : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-300",
                  ].join(
                    " ",
                  )}
                >
                  <Icon
                    size={16}
                    className="shrink-0"
                  />

                  <span>
                    {
                      category.label
                    }
                  </span>

                  {selected && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-sky-400" />
                  )}
                </button>
              )
            },
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-800 bg-zinc-950/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-200">
            <ActiveIcon
              size={16}
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-200">
              {
                activeCategoryDetails
                  .label
              }
            </p>

            <p className="mt-0.5 text-xs leading-5 text-zinc-600">
              {
                activeCategoryDetails
                  .description
              }
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[11px] text-zinc-500">
          <CheckCircle2
            size={12}
            className="text-emerald-300"
          />
          Current Section
        </span>
      </div>
    </nav>
  )
}

function AccessibilityPreview({
  spacing,
  solidPanels,
  focusOutlines,
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/35">
      <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div>
          <p className="text-sm font-semibold text-zinc-200">
            Live Accessibility Preview
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-600">
            This sample updates instantly as the accessibility controls change.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-500">
            {spacing === "compact"
              ? "Compact"
              : "Comfortable"}
          </span>

          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-violet-300">
            {solidPanels
              ? "Solid"
              : "Translucent"}
          </span>

          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-300">
            {focusOutlines
              ? "Enhanced Focus"
              : "Standard Focus"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
          <p className="text-sm font-medium text-sky-200">
            Sample Highlighted Panel
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Compare panel density, transparency and selected-state clarity here.
          </p>
        </div>

        <button
          type="button"
          aria-label="Focus indicator preview"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          {focusOutlines
            ? "Click or Tab to Test"
            : "Focus Preview"}
        </button>
      </div>
    </div>
  )
}

function InterviewStructurePicker({
  value,
  onChange,
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-semibold text-zinc-200">
        Default Interview-Answer Structure
      </legend>

      <p className="mt-1 text-xs leading-5 text-zinc-600">
        This changes the guidance attached to newly suggested interview examples. Your written answers remain editable.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {interviewStructureOptions.map(
          (option) => {
            const selected =
              value ===
              option.value

            return (
              <button
                key={
                  option.value
                }
                type="button"
                aria-pressed={
                  selected
                }
                onClick={() =>
                  onChange(
                    option.value,
                  )
                }
                className={[
                  "min-w-0 rounded-2xl border p-4 text-left transition duration-200",

                  selected
                    ? "border-violet-500/40 bg-violet-500/10 shadow-[0_12px_28px_rgba(124,58,237,0.08)]"
                    : "border-zinc-800 bg-zinc-950/35 hover:border-zinc-700 hover:bg-zinc-900/60",
                ].join(
                  " ",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={[
                          "font-semibold",

                          selected
                            ? "text-violet-200"
                            : "text-zinc-200",
                        ].join(
                          " ",
                        )}
                      >
                        {
                          option.label
                        }
                      </p>

                      {option.recommended && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                          Recommended
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-xs font-medium text-zinc-400">
                      {
                        option.steps
                      }
                    </p>
                  </div>

                  <span
                    className={[
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",

                      selected
                        ? "border-violet-400 bg-violet-400"
                        : "border-zinc-600",
                    ].join(
                      " ",
                    )}
                  >
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  {
                    option.description
                  }
                </p>

                <p className="mt-3 border-t border-zinc-800 pt-3 text-[11px] leading-5 text-zinc-600">
                  {
                    option.bestFor
                  }
                </p>
              </button>
            )
          },
        )}
      </div>
    </fieldset>
  )
}

function PreferenceToggle({
  icon:
    Icon,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <label
      className={[
        "group flex min-w-0 items-start justify-between gap-4 rounded-2xl border p-4 transition",

        checked
          ? "border-sky-500/25 bg-sky-500/[0.055]"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",

        disabled
          ? "cursor-not-allowed opacity-55"
          : "cursor-pointer",
      ].join(
        " ",
      )}
    >
      <span className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",

              checked
                ? "border-sky-500/25 bg-sky-500/10 text-sky-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-500 group-hover:text-zinc-300",
            ].join(
              " ",
            )}
          >
            <Icon
              size={16}
            />
          </span>
        )}

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-200">
            {title}
          </span>

          <span className="mt-1 block text-xs leading-5 text-zinc-600">
            {description}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span
          className={[
            "hidden text-[11px] font-medium sm:inline",

            checked
              ? "text-sky-300"
              : "text-zinc-600",
          ].join(
            " ",
          )}
        >
          {checked
            ? "On"
            : "Off"}
        </span>

        <input
          type="checkbox"
          checked={
            Boolean(
              checked,
            )
          }
          disabled={
            disabled
          }
          onChange={(event) =>
            onChange(
              event.target.checked,
            )
          }
          className="sr-only"
          aria-label={
            title
          }
        />

        <span
          aria-hidden="true"
          className={[
            "relative h-6 w-11 rounded-full border transition",

            checked
              ? "border-sky-400/60 bg-sky-500"
              : "border-zinc-700 bg-zinc-800",
          ].join(
            " ",
          )}
        >
          <span
            className={[
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition",

              checked
                ? "left-[22px]"
                : "left-0.5",
            ].join(
              " ",
            )}
          />
        </span>
      </span>
    </label>
  )
}

function PreferenceSelect({
  icon:
    Icon,
  title,
  description,
  value,
  onChange,
  options,
}) {
  return (
    <label className="block min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700">
      <span className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-500">
            <Icon
              size={16}
            />
          </span>
        )}

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-200">
            {title}
          </span>

          <span className="mt-1 block text-xs leading-5 text-zinc-600">
            {description}
          </span>
        </span>
      </span>

      <select
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className={`${selectClass} mt-4`}
      >
        {options.map(
          ([
            optionValue,
            label,
          ]) => (
            <option
              key={
                optionValue
              }
              value={
                optionValue
              }
            >
              {label}
            </option>
          ),
        )}
      </select>
    </label>
  )
}

function ConnectionGroup({
  id,
  title,
  description,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      id={id}
      className="scroll-mt-28 mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition hover:bg-zinc-900/45 sm:px-6"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
            {description}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-800 p-5 sm:p-6">
          {children}
        </div>
      )}
    </section>
  )
}

function SettingsHeader({
  icon:
    Icon,
  title,
  description,
  children,
}) {
  return (
    <header className="relative flex flex-col gap-4 overflow-hidden border-b border-zinc-800 bg-zinc-950/20 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />

      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300 shadow-sm">
          <Icon
            size={19}
          />
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold text-zinc-100">
            {title}
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
            {
              description
            }
          </p>
        </div>
      </div>

      {children && (
        <div className="shrink-0">
          {children}
        </div>
      )}
    </header>
  )
}

function ReliabilityStatusCard({
  label,
  value,
  detail,
  healthy,
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={[
            "h-2.5 w-2.5 rounded-full",

            healthy
              ? "bg-emerald-400"
              : "bg-amber-400",
          ].join(
            " ",
          )}
        />

        <p className="text-lg font-semibold text-zinc-200">
          {value}
        </p>
      </div>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {detail}
      </p>
    </article>
  )
}

function ProviderHealthRow({
  provider,
}) {
  const health =
    provider.health

  const configured =
    provider.configured

  const healthy =
    configured &&
    health?.status ===
      "available"

  const warning =
    configured &&
    health &&
    [
      "offline",
      "rate-limited",
    ].includes(
      health.status,
    )

  const label =
    !configured
      ? "Not Configured"
      : !health
        ? "Not Checked Yet"
        : health.status ===
            "available"
          ? "Available"
          : health.status ===
              "credentials"
            ? "Credentials Required"
            : health.status ===
                "rate-limited"
              ? "Rate Limited"
              : health.status ===
                  "offline"
                ? "Offline"
                : "Unavailable"

  return (
    <article className="flex min-w-0 items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",

          healthy
            ? "jp-tone-success"
            : warning
              ? "jp-tone-warning"
              : configured
                ? "jp-tone-danger"
                : "jp-tone-neutral",
        ].join(
          " ",
        )}
      >
        {healthy ? (
          <Wifi
            size={17}
          />
        ) : (
          <WifiOff
            size={17}
          />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-200">
            {
              provider.name
            }
          </p>

          <span
            className={[
              badgeClass,

              healthy
                ? "jp-tone-success"
                : warning
                  ? "jp-tone-warning"
                  : configured
                    ? "jp-tone-danger"
                    : "jp-tone-neutral",
            ].join(
              " ",
            )}
          >
            {label}
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-zinc-600">
          {!configured
            ? "Connect this provider before it can participate in live or background searches."
            : health?.message ||
              "Run a live search or connection test to record provider health."}
        </p>

        {health?.lastAttemptAt && (
          <p className="mt-2 text-[11px] text-zinc-700">
            Last checked {
              formatDateTime(
                health.lastAttemptAt,
              )
            }
          </p>
        )}

        {health?.retryAt && new Date(health.retryAt).getTime() > Date.now() && (
          <p className="mt-1 text-[11px] text-amber-300/75">
            BreakVeil will try again after {formatDateTime(health.retryAt)}
          </p>
        )}
      </div>
    </article>
  )
}

function ProviderCard({
  name,
  description,
  sourceStatus,
  busy,
  onOpenGuide,
  onTest,
  onRemove,
  children,
}) {
  const ProviderIcon =
    sourceStatus.connectionMode ===
    "public"
      ? Globe2
      : KeyRound

  return (
    <section className="h-fit min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_18px_45px_rgba(0,0,0,0.12)]">
      <header className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
            <ProviderIcon
              size={19}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">
                {name}
              </h2>

              <SourceBadge
                sourceStatus={
                  sourceStatus
                }
              />
            </div>

            <p className="mt-1 text-sm leading-6 text-zinc-500">
              {description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onOpenGuide
          }
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
          title={`How to set up ${name}`}
        >
          <Info
            size={15}
          />
          Setup Help
        </button>
      </header>

      <div className="p-5 sm:p-6">
        {sourceStatus.configured && (
          <LastTestPanel
            sourceStatus={
              sourceStatus
            }
          />
        )}

        <div
          className={
            sourceStatus.configured
              ? "mt-5"
              : ""
          }
        >
          {children}
        </div>

        {sourceStatus.configured && (
          <div className="mt-4 grid gap-2 border-t border-zinc-800 pt-4 sm:flex sm:flex-wrap">
            <button
              type="button"
              disabled={
                busy
              }
              onClick={
                onTest
              }
              className={`${secondaryButtonClass} justify-center`}
            >
              {busy ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Wifi
                  size={16}
                />
              )}

              Test Connection
            </button>

            {sourceStatus.removable !==
              false &&
              onRemove && (
                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={
                    onRemove
                  }
                  className={`${dangerButtonClass} justify-center`}
                >
                  <Trash2
                    size={16}
                  />
                  Remove
                </button>
              )}
          </div>
        )}
      </div>
    </section>
  )
}

function ApiGuideModal({
  guide,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={
        onClose
      }
    >
      <section
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
              <Info
                size={19}
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                Beginner Setup Guide
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                {
                  guide.title
                }
              </h2>

              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {
                  guide.description
                }
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <ol className="space-y-3">
            {guide.steps.map(
              (
                step,
                index,
              ) => (
                <li
                  key={
                    step
                  }
                  className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-400">
                    {index + 1}
                  </span>

                  <p className="text-sm leading-6 text-zinc-400">
                    {step}
                  </p>
                </li>
              ),
            )}
          </ol>

          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={sectionLabelClass}>
              Helpful Checks
            </p>

            <ul className="mt-3 space-y-2">
              {guide.notes.map(
                (note) => (
                  <li
                    key={
                      note
                    }
                    className="flex items-start gap-2 text-xs leading-5 text-zinc-600"
                  >
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-zinc-500"
                    />

                    <span>
                      {note}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={
              onClose
            }
            className={secondaryButtonClass}
          >
            Close
          </button>

          <a
            href={
              guide.url
            }
            target="_blank"
            rel="noreferrer"
            className={primaryButtonClass}
          >
            <ExternalLink
              size={16}
            />
            {
              guide.linkLabel
            }
          </a>
        </footer>
      </section>
    </div>
  )
}

function SecretInput({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-zinc-400">
        {label}
      </span>

      <div className="relative">
        <input
          type={
            visible
              ? "text"
              : "password"
          }
          value={
            value
          }
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          placeholder={
            placeholder
          }
          autoComplete="off"
          spellCheck={
            false
          }
          className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
        />

        <button
          type="button"
          onClick={
            onToggleVisibility
          }
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
          title={
            visible
              ? "Hide Value"
              : "Show Value"
          }
        >
          {visible ? (
            <EyeOff
              size={16}
            />
          ) : (
            <Eye
              size={16}
            />
          )}
        </button>
      </div>
    </label>
  )
}

function SourceBadge({
  sourceStatus,
}) {
  if (
    sourceStatus.connectionMode ===
      "public" &&
    !sourceStatus.lastTest
  ) {
    return (
      <span className={`${badgeClass} border-sky-500/20 bg-sky-500/10 text-sky-300`}>
        <Globe2
          size={13}
        />
        Public Source
      </span>
    )
  }

  if (
    !sourceStatus.configured
  ) {
    return (
      <span className={`${badgeClass} border-zinc-700 bg-zinc-800 text-zinc-400`}>
        Not Configured
      </span>
    )
  }

  if (
    sourceStatus.lastTest
      ?.ok
  ) {
    return (
      <span className={`${badgeClass} border-emerald-500/20 bg-emerald-500/10 text-emerald-300`}>
        <CheckCircle2
          size={13}
        />
        Connected
      </span>
    )
  }

  if (
    sourceStatus.lastTest &&
    !sourceStatus.lastTest.ok
  ) {
    return (
      <span className={`${badgeClass} border-red-500/20 bg-red-500/10 text-red-300`}>
        <XCircle
          size={13}
        />
        Test Failed
      </span>
    )
  }

  return (
    <span className={`${badgeClass} border-amber-500/20 bg-amber-500/10 text-amber-300`}>
      Saved
    </span>
  )
}

function LastTestPanel({
  sourceStatus,
}) {
  const lastTest =
    sourceStatus.lastTest

  if (!lastTest) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-500">
        {sourceStatus.connectionMode === "public"
          ? "Public source available. Run a connection test to record its current status."
          : "Credentials saved. Run a connection test."}
      </div>
    )
  }

  return (
    <div
      className={[
        "rounded-xl border p-4",

        lastTest.ok
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5",
      ].join(
        " ",
      )}
    >
      <div className="flex items-start gap-3">
        {lastTest.ok ? (
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0 text-emerald-300"
          />
        ) : (
          <XCircle
            size={17}
            className="mt-0.5 shrink-0 text-red-300"
          />
        )}

        <div className="min-w-0">
          <p
            className={[
              "text-sm font-medium",

              lastTest.ok
                ? "text-emerald-200"
                : "text-red-200",
            ].join(
              " ",
            )}
          >
            {lastTest.ok
              ? "Connection Successful"
              : "Connection Failed"}
          </p>

          <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
            {lastTest.message ||
              lastTest.error}
          </p>

          <p className="mt-2 text-xs text-zinc-700">
            {formatDateTime(
              lastTest.testedAt,
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

const badgeClass =
  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"

const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-600"

const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:-translate-y-px hover:bg-zinc-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-zinc-700 disabled:text-zinc-400"

const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/30 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"

const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-2.5 text-sm text-red-300 transition hover:border-red-500/30 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"

const selectClass =
  "h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none transition hover:border-zinc-600 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/10"

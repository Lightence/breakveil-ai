export const uiPreferencesStorageKey =
  "jobpilot.ui-preferences"

export const setupGuideStorageKey =
  "jobpilot.first-run-setup"

export const defaultUiPreferences = {
  theme:
    "system",

  scale:
    100,

  scrollbars:
    "visible",

  spacing:
    "comfortable",

  reduceMotion:
    false,

  highContrast:
    false,

  focusOutlines:
    false,

  solidPanels:
    false,

  buttonLabels:
    false,

  dateFormat:
    "DD/MM/YYYY",

  distanceUnit:
    "miles",

  rememberLastPage:
    true,

  defaultLandingPage:
    "dashboard",

  coverLetterLength:
    "standard",

  emailSubjectFormat:
    "role-name",

  includeCoverLetterByDefault:
    true,

  interviewAnswerStructure:
    "star",
}

export const uiThemeOptions = [
  {
    value:
      "system",

    label:
      "System",

    description:
      "Follows the Windows light or dark preference.",

    preview:
      "linear-gradient(135deg, #f4f4f5 0 50%, #18181b 50% 100%)",
  },
  {
    value:
      "dark",

    label:
      "Dark",

    description:
      "The original neutral BreakVeil appearance.",

    preview:
      "linear-gradient(135deg, #09090b, #27272a)",
  },
  {
    value:
      "light",

    label:
      "Light",

    description:
      "A brighter workspace with dark text and soft panels.",

    preview:
      "linear-gradient(135deg, #ffffff, #d4d4d8)",
  },
  {
    value:
      "midnight",

    label:
      "Midnight",

    description:
      "A deeper blue-black theme for low-light use.",

    preview:
      "linear-gradient(135deg, #07111f, #17365f)",
  },
]

const validThemes =
  new Set(
    uiThemeOptions.map(
      (option) =>
        option.value,
    ),
  )

const validScrollbarModes =
  new Set([
    "visible",
    "hidden",
  ])

const validSpacingModes =
  new Set([
    "comfortable",
    "compact",
  ])

const validDateFormats =
  new Set([
    "DD/MM/YYYY",
    "MM/DD/YYYY",
    "YYYY-MM-DD",
  ])

const validDistanceUnits =
  new Set([
    "miles",
    "kilometres",
  ])

const validLandingPages =
  new Set([
    "dashboard",
    "jobs",
    "assistant",
    "automation",
  ])

const validCoverLetterLengths =
  new Set([
    "concise",
    "standard",
    "detailed",
  ])

const validEmailSubjectFormats =
  new Set([
    "role-name",
    "name-role",
    "role-company",
  ])

const validInterviewStructures =
  new Set([
    "star",
    "star-reflection",
    "concise-evidence",
    "free-form",
  ])

function clampScale(
  value,
) {
  const number =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 100
  }

  return Math.min(
    120,
    Math.max(
      80,
      Math.round(
        number /
        5,
      ) *
        5,
    ),
  )
}

export function normaliseUiPreferences(
  value,
) {
  const input =
    value &&
    typeof value ===
      "object"
      ? value
      : {}

  return {
    theme:
      validThemes.has(
        input.theme,
      )
        ? input.theme
        : defaultUiPreferences.theme,

    scale:
      clampScale(
        input.scale,
      ),

    scrollbars:
      validScrollbarModes.has(
        input.scrollbars,
      )
        ? input.scrollbars
        : defaultUiPreferences.scrollbars,

    spacing:
      validSpacingModes.has(
        input.spacing,
      )
        ? input.spacing
        : defaultUiPreferences.spacing,

    reduceMotion:
      input.reduceMotion ===
      true,

    highContrast:
      input.highContrast ===
      true,

    focusOutlines:
      input.focusOutlines ===
      true,

    solidPanels:
      input.solidPanels ===
      true,

    buttonLabels:
      input.buttonLabels ===
      true,

    dateFormat:
      validDateFormats.has(
        input.dateFormat,
      )
        ? input.dateFormat
        : defaultUiPreferences.dateFormat,

    distanceUnit:
      validDistanceUnits.has(
        input.distanceUnit,
      )
        ? input.distanceUnit
        : defaultUiPreferences.distanceUnit,

    rememberLastPage:
      input.rememberLastPage !==
      false,

    defaultLandingPage:
      validLandingPages.has(
        input.defaultLandingPage,
      )
        ? input.defaultLandingPage
        : defaultUiPreferences.defaultLandingPage,

    coverLetterLength:
      validCoverLetterLengths.has(
        input.coverLetterLength,
      )
        ? input.coverLetterLength
        : defaultUiPreferences.coverLetterLength,

    emailSubjectFormat:
      validEmailSubjectFormats.has(
        input.emailSubjectFormat,
      )
        ? input.emailSubjectFormat
        : defaultUiPreferences.emailSubjectFormat,

    includeCoverLetterByDefault:
      input.includeCoverLetterByDefault !==
      false,

    interviewAnswerStructure:
      validInterviewStructures.has(
        input.interviewAnswerStructure,
      )
        ? input.interviewAnswerStructure
        : defaultUiPreferences.interviewAnswerStructure,
  }
}

export function loadUiPreferences() {
  try {
    const storedValue =
      localStorage.getItem(
        uiPreferencesStorageKey,
      )

    return normaliseUiPreferences(
      storedValue
        ? JSON.parse(
            storedValue,
          )
        : defaultUiPreferences,
    )
  } catch {
    return {
      ...defaultUiPreferences,
    }
  }
}

export function saveUiPreferences(
  preferences,
) {
  const safePreferences =
    normaliseUiPreferences(
      preferences,
    )

  try {
    localStorage.setItem(
      uiPreferencesStorageKey,
      JSON.stringify(
        safePreferences,
      ),
    )
  } catch {
    // Applying the preference still works for the current session.
  }

  applyUiPreferences(
    safePreferences,
  )

  window.dispatchEvent(
    new CustomEvent(
      "jobpilot:ui-preferences-updated",
      {
        detail:
          safePreferences,
      },
    ),
  )

  return safePreferences
}


function parsePreferenceDate(
  value,
) {
  if (!value) {
    return null
  }

  const dateOnlyMatch =
    String(
      value,
    ).match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    )

  if (dateOnlyMatch) {
    return new Date(
      Number(
        dateOnlyMatch[1],
      ),
      Number(
        dateOnlyMatch[2],
      ) -
        1,
      Number(
        dateOnlyMatch[3],
      ),
    )
  }

  const date =
    new Date(
      value,
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date
}

function padDatePart(
  value,
) {
  return String(
    value,
  ).padStart(
    2,
    "0",
  )
}

export function formatPreferenceDate(
  value,
) {
  const date =
    parsePreferenceDate(
      value,
    )

  if (!date) {
    return ""
  }

  const preferences =
    loadUiPreferences()

  const day =
    padDatePart(
      date.getDate(),
    )

  const month =
    padDatePart(
      date.getMonth() +
      1,
    )

  const year =
    date.getFullYear()

  if (
    preferences.dateFormat ===
    "MM/DD/YYYY"
  ) {
    return `${month}/${day}/${year}`
  }

  if (
    preferences.dateFormat ===
    "YYYY-MM-DD"
  ) {
    return `${year}-${month}-${day}`
  }

  return `${day}/${month}/${year}`
}

export function formatPreferenceDateTime(
  value,
) {
  const date =
    parsePreferenceDate(
      value,
    )

  if (!date) {
    return ""
  }

  const dateText =
    formatPreferenceDate(
      date,
    )

  const timeText =
    date.toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit",
      },
    )

  return `${dateText}, ${timeText}`
}

export function formatPreferenceDistance(
  miles,
) {
  const safeMiles =
    Number(
      miles,
    )

  if (
    !Number.isFinite(
      safeMiles,
    )
  ) {
    return ""
  }

  const preferences =
    loadUiPreferences()

  if (
    preferences.distanceUnit ===
    "kilometres"
  ) {
    const kilometres =
      Math.round(
        safeMiles *
        1.609344,
      )

    return `${kilometres} km`
  }

  return `${safeMiles} mile${safeMiles === 1 ? "" : "s"}`
}

export function getApplicationPreferences() {
  const preferences =
    loadUiPreferences()

  return {
    coverLetterLength:
      preferences.coverLetterLength,

    emailSubjectFormat:
      preferences.emailSubjectFormat,

    includeCoverLetterByDefault:
      preferences.includeCoverLetterByDefault,

    interviewAnswerStructure:
      preferences.interviewAnswerStructure,
  }
}

function getEffectiveTheme(
  theme,
) {
  if (
    theme !==
    "system"
  ) {
    return theme
  }

  try {
    return window.matchMedia(
      "(prefers-color-scheme: light)",
    ).matches
      ? "light"
      : "dark"
  } catch {
    return "dark"
  }
}

function ensurePreferenceStyles() {
  const styleId =
    "jobpilot-ui-preference-styles"

  if (
    document.getElementById(
      styleId,
    )
  ) {
    return
  }

  const style =
    document.createElement(
      "style",
    )

  style.id =
    styleId

  style.textContent = `
    :root {
      --jobpilot-scale: 1;
      color-scheme: dark;
    }

    html {
      font-size: calc(16px * var(--jobpilot-scale));
    }

    html,
    body,
    #root {
      min-height: 100%;
    }

    body {
      transition:
        background-color 160ms ease,
        color 160ms ease;
    }

    html[data-jobpilot-scrollbars="visible"],
    html[data-jobpilot-scrollbars="visible"] * {
      scrollbar-color: rgba(113, 113, 122, 0.62) transparent !important;
      scrollbar-width: thin !important;
      -ms-overflow-style: auto !important;
    }

    html[data-jobpilot-scrollbars="visible"] .jp-main-scroll,
    html[data-jobpilot-scrollbars="visible"] .jp-scroll-surface {
      scrollbar-gutter: stable;
    }

    html[data-jobpilot-scrollbars="visible"]::-webkit-scrollbar,
    html[data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar {
      display: block !important;
      width: 7px !important;
      height: 7px !important;
    }

    html[data-jobpilot-scrollbars="visible"]::-webkit-scrollbar-track,
    html[data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar-track {
      background: transparent !important;
    }

    html[data-jobpilot-scrollbars="visible"]::-webkit-scrollbar-thumb,
    html[data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar-thumb {
      min-height: 34px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: rgba(113, 113, 122, 0.5) !important;
      background-clip: padding-box !important;
    }

    html[data-jobpilot-scrollbars="visible"]::-webkit-scrollbar-thumb:hover,
    html[data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar-thumb:hover {
      background: rgba(161, 161, 170, 0.78) !important;
      background-clip: padding-box !important;
    }

    html[data-jobpilot-scrollbars="visible"]::-webkit-scrollbar-corner,
    html[data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar-corner {
      background: transparent !important;
    }

    html[data-jobpilot-scrollbars="hidden"],
    html[data-jobpilot-scrollbars="hidden"] * {
      scrollbar-color: transparent transparent !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    html[data-jobpilot-scrollbars="hidden"] ::-webkit-scrollbar,
    html[data-jobpilot-scrollbars="hidden"] *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    html[data-jobpilot-effective-theme="light"] {
      color-scheme: light;
    }

    html[data-jobpilot-effective-theme="light"] body,
    html[data-jobpilot-effective-theme="light"] #root {
      background: #f4f6f8 !important;
      color: #18181b !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="bg-[#090909]"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-[#111111]"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-[#131313]"] {
      background-color: #f7f8fa !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="bg-[#151515]"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-950"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-950/25"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-950/30"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-950/35"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-950/40"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-950/60"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/30"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/35"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/40"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/45"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/50"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/60"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-900/70"] {
      background-color: #ffffff !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-800"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-800/35"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-800/40"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-800/50"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-800/60"],
    html[data-jobpilot-effective-theme="light"] [class~="bg-zinc-800/80"] {
      background-color: #eef0f3 !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="border-zinc-800"],
    html[data-jobpilot-effective-theme="light"] [class~="border-zinc-800/80"],
    html[data-jobpilot-effective-theme="light"] [class~="border-zinc-700"] {
      border-color: #d9dde3 !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="text-white"],
    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-100"],
    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-200"],
    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-300"] {
      color: #18181b !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-400"] {
      color: #52525b !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-500"] {
      color: #71717a !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-600"],
    html[data-jobpilot-effective-theme="light"] [class~="text-zinc-700"] {
      color: #8a8a94 !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="bg-white"] {
      background-color: #2563eb !important;
      border-color: #2563eb !important;
    }

    html[data-jobpilot-effective-theme="light"] [class~="text-black"] {
      color: #ffffff !important;
    }

    html[data-jobpilot-effective-theme="light"] .hover\\:bg-zinc-200:hover {
      background-color: #1d4ed8 !important;
    }

    html[data-jobpilot-effective-theme="light"] input,
    html[data-jobpilot-effective-theme="light"] textarea,
    html[data-jobpilot-effective-theme="light"] select {
      color: #18181b;
    }

    html[data-jobpilot-effective-theme="light"] .bg-sky-500\\/5,
    html[data-jobpilot-effective-theme="light"] .bg-sky-500\\/10,
    html[data-jobpilot-effective-theme="light"] .bg-sky-500\\/15,
    html[data-jobpilot-effective-theme="light"] .bg-sky-500\\/\\[0\\.06\\] {
      background-color: rgba(2, 132, 199, 0.26) !important;
    }

    html[data-jobpilot-effective-theme="light"] .border-sky-500\\/20,
    html[data-jobpilot-effective-theme="light"] .border-sky-500\\/25,
    html[data-jobpilot-effective-theme="light"] .border-sky-500\\/30,
    html[data-jobpilot-effective-theme="light"] .border-sky-500\\/40 {
      border-color: rgba(2, 132, 199, 0.68) !important;
    }

    html[data-jobpilot-effective-theme="light"] .text-sky-200,
    html[data-jobpilot-effective-theme="light"] .text-sky-300 {
      color: #0369a1 !important;
    }

    html[data-jobpilot-effective-theme="light"] .hover\\:bg-sky-500\\/10:hover,
    html[data-jobpilot-effective-theme="light"] .hover\\:bg-sky-500\\/20:hover {
      background-color: rgba(2, 132, 199, 0.34) !important;
    }

    html[data-jobpilot-effective-theme="light"] .bg-blue-500\\/10 {
      background-color: rgba(37, 99, 235, 0.26) !important;
    }

    html[data-jobpilot-effective-theme="light"] .border-blue-500\\/20 {
      border-color: rgba(37, 99, 235, 0.66) !important;
    }

    html[data-jobpilot-effective-theme="light"] .text-blue-300 {
      color: #1d4ed8 !important;
    }

    html[data-jobpilot-effective-theme="light"] .bg-violet-500\\/5,
    html[data-jobpilot-effective-theme="light"] .bg-violet-500\\/10,
    html[data-jobpilot-effective-theme="light"] .bg-violet-500\\/\\[0\\.06\\] {
      background-color: rgba(124, 58, 237, 0.25) !important;
    }

    html[data-jobpilot-effective-theme="light"] .border-violet-500\\/15,
    html[data-jobpilot-effective-theme="light"] .border-violet-500\\/20,
    html[data-jobpilot-effective-theme="light"] .border-violet-500\\/25,
    html[data-jobpilot-effective-theme="light"] .border-violet-500\\/30 {
      border-color: rgba(109, 40, 217, 0.65) !important;
    }

    html[data-jobpilot-effective-theme="light"] .text-violet-100,
    html[data-jobpilot-effective-theme="light"] .text-violet-200,
    html[data-jobpilot-effective-theme="light"] .text-violet-300,
    html[data-jobpilot-effective-theme="light"] .text-violet-200\\/60,
    html[data-jobpilot-effective-theme="light"] .text-violet-300\\/70,
    html[data-jobpilot-effective-theme="light"] .text-violet-300\\/80 {
      color: #6d28d9 !important;
    }

    html[data-jobpilot-effective-theme="light"] .hover\\:bg-violet-500\\/10:hover,
    html[data-jobpilot-effective-theme="light"] .hover\\:bg-violet-500\\/20:hover,
    html[data-jobpilot-effective-theme="light"] .group:hover .group-hover\\:bg-violet-500\\/15 {
      background-color: rgba(124, 58, 237, 0.33) !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-scrollbars="visible"],
    html[data-jobpilot-effective-theme="light"][data-jobpilot-scrollbars="visible"] * {
      scrollbar-color: rgba(100, 116, 139, 0.34) transparent !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-scrollbars="visible"]::-webkit-scrollbar-thumb,
    html[data-jobpilot-effective-theme="light"][data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar-thumb {
      min-height: 28px;
      background: rgba(100, 116, 139, 0.3) !important;
      background-clip: padding-box !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-scrollbars="visible"]::-webkit-scrollbar-thumb:hover,
    html[data-jobpilot-effective-theme="light"][data-jobpilot-scrollbars="visible"] *::-webkit-scrollbar-thumb:hover {
      background: rgba(71, 85, 105, 0.48) !important;
      background-clip: padding-box !important;
    }

    html[data-jobpilot-effective-theme="midnight"] {
      color-scheme: dark;
    }

    html[data-jobpilot-effective-theme="midnight"] body,
    html[data-jobpilot-effective-theme="midnight"] #root {
      background: #050b14 !important;
    }

    html[data-jobpilot-effective-theme="midnight"] [class~="bg-[#090909]"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-[#111111]"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-[#131313]"] {
      background-color: #07111f !important;
    }

    html[data-jobpilot-effective-theme="midnight"] [class~="bg-[#151515]"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-950"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-950/25"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-950/30"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-950/40"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-900"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-900/30"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-900/40"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-900/45"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-900/50"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-900/60"] {
      background-color: #0b1728 !important;
    }

    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-800"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-800/35"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-800/40"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-800/50"],
    html[data-jobpilot-effective-theme="midnight"] [class~="bg-zinc-800/60"] {
      background-color: #102033 !important;
    }

    html[data-jobpilot-effective-theme="midnight"] [class~="border-zinc-800"],
    html[data-jobpilot-effective-theme="midnight"] [class~="border-zinc-800/80"],
    html[data-jobpilot-effective-theme="midnight"] [class~="border-zinc-700"] {
      border-color: #1d3552 !important;
    }

    html[data-jobpilot-reduce-motion="true"],
    html[data-jobpilot-reduce-motion="true"] * ,
    html[data-jobpilot-reduce-motion="true"] *::before,
    html[data-jobpilot-reduce-motion="true"] *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }

    html[data-jobpilot-focus-outlines="true"] :where(
      button,
      a,
      input,
      textarea,
      select,
      summary,
      [tabindex]:not([tabindex="-1"])
    ):focus {
      outline: 3px solid #38bdf8 !important;
      outline-offset: 3px !important;
      box-shadow:
        0 0 0 2px rgba(9, 9, 11, 0.96),
        0 0 0 6px rgba(56, 189, 248, 0.48) !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-focus-outlines="true"] :where(
      button,
      a,
      input,
      textarea,
      select,
      summary,
      [tabindex]:not([tabindex="-1"])
    ):focus {
      outline-color: #0369a1 !important;
      box-shadow:
        0 0 0 2px rgba(255, 255, 255, 0.98),
        0 0 0 6px rgba(2, 132, 199, 0.38) !important;
    }

    html[data-jobpilot-focus-outlines="true"] label:has(
      input:focus,
      textarea:focus,
      select:focus
    ) {
      border-color: rgba(56, 189, 248, 0.7) !important;
    }

    html[data-jobpilot-high-contrast="true"] [class*="border-sky-500"],
    html[data-jobpilot-high-contrast="true"] [class*="border-violet-500"],
    html[data-jobpilot-high-contrast="true"] [class*="border-emerald-500"],
    html[data-jobpilot-high-contrast="true"] [class*="border-amber-500"] {
      border-width: 2px !important;
    }

    html[data-jobpilot-high-contrast="true"] [class*="bg-sky-500/10"] {
      background-color: rgba(14, 165, 233, 0.25) !important;
    }

    html[data-jobpilot-high-contrast="true"] [class*="bg-violet-500/10"] {
      background-color: rgba(139, 92, 246, 0.25) !important;
    }

    html[data-jobpilot-high-contrast="true"] [class*="bg-emerald-500/10"] {
      background-color: rgba(16, 185, 129, 0.23) !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-zinc-950/"],
    html[data-jobpilot-solid-panels="true"] [class*="bg-black/"] {
      background-color: #09090b !important;
      background-image: none !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-zinc-900/"] {
      background-color: #18181b !important;
      background-image: none !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-zinc-800/"] {
      background-color: #27272a !important;
      background-image: none !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-sky-500/"] {
      background-color: #0b2d42 !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-blue-500/"] {
      background-color: #152d59 !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-violet-500/"] {
      background-color: #2b1f48 !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-emerald-500/"] {
      background-color: #0d3326 !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-amber-500/"] {
      background-color: #3a2b0d !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="bg-red-500/"] {
      background-color: #3a181b !important;
    }

    html[data-jobpilot-solid-panels="true"] [class*="backdrop-blur"] {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-zinc-950/"],
    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-zinc-900/"],
    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-zinc-800/"],
    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-black/"] {
      background-color: #ffffff !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-sky-500/"] {
      background-color: #d7f0ff !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-blue-500/"] {
      background-color: #dbeafe !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-violet-500/"] {
      background-color: #ede9fe !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-emerald-500/"] {
      background-color: #d1fae5 !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-amber-500/"] {
      background-color: #fef3c7 !important;
    }

    html[data-jobpilot-effective-theme="light"][data-jobpilot-solid-panels="true"] [class*="bg-red-500/"] {
      background-color: #fee2e2 !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="p-8"] {
      padding: 1.25rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="p-6"] {
      padding: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="p-5"] {
      padding: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="p-4"] {
      padding: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="p-3"] {
      padding: 0.5rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="px-8"] {
      padding-left: 1.25rem !important;
      padding-right: 1.25rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="px-6"] {
      padding-left: 0.95rem !important;
      padding-right: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="px-5"] {
      padding-left: 0.8rem !important;
      padding-right: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="px-4"] {
      padding-left: 0.65rem !important;
      padding-right: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="px-3"] {
      padding-left: 0.5rem !important;
      padding-right: 0.5rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="py-6"] {
      padding-top: 0.95rem !important;
      padding-bottom: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="py-5"] {
      padding-top: 0.8rem !important;
      padding-bottom: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="py-4"] {
      padding-top: 0.65rem !important;
      padding-bottom: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="py-3"] {
      padding-top: 0.5rem !important;
      padding-bottom: 0.5rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="gap-8"] {
      gap: 1.25rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="gap-6"] {
      gap: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="gap-5"] {
      gap: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="gap-4"] {
      gap: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="gap-3"] {
      gap: 0.5rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mt-8"] {
      margin-top: 1.25rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mt-6"] {
      margin-top: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mt-5"] {
      margin-top: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mt-4"] {
      margin-top: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mt-3"] {
      margin-top: 0.5rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mb-6"] {
      margin-bottom: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mb-5"] {
      margin-bottom: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="mb-4"] {
      margin-bottom: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="h-12"] {
      height: 2.6rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="h-11"] {
      height: 2.35rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="space-y-6"] > :not([hidden]) ~ :not([hidden]) {
      margin-top: 0.95rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="space-y-5"] > :not([hidden]) ~ :not([hidden]) {
      margin-top: 0.8rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="space-y-4"] > :not([hidden]) ~ :not([hidden]) {
      margin-top: 0.65rem !important;
    }

    html[data-jobpilot-spacing="compact"] [class~="space-y-3"] > :not([hidden]) ~ :not([hidden]) {
      margin-top: 0.5rem !important;
    }

    html[data-jobpilot-button-labels="visible"] button:has(> svg:only-child):not([aria-label^="Close"]):not([title^="Close"])::after,
    html[data-jobpilot-button-labels="visible"] a:has(> svg:only-child):not([aria-label^="Close"]):not([title^="Close"])::after {
      content: attr(aria-label);
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    html[data-jobpilot-button-labels="visible"] button:has(> svg:only-child):not([aria-label^="Close"]):not([title^="Close"]),
    html[data-jobpilot-button-labels="visible"] a:has(> svg:only-child):not([aria-label^="Close"]):not([title^="Close"]) {
      gap: 0.45rem;
      width: auto !important;
      padding-left: 0.65rem !important;
      padding-right: 0.65rem !important;
    }
  `

  document.head.appendChild(
    style,
  )
}

export function applyUiPreferences(
  preferences =
    loadUiPreferences(),
) {
  const safePreferences =
    normaliseUiPreferences(
      preferences,
    )

  ensurePreferenceStyles()

  const root =
    document.documentElement

  const effectiveTheme =
    getEffectiveTheme(
      safePreferences.theme,
    )

  root.style.setProperty(
    "--jobpilot-scale",
    String(
      safePreferences.scale /
      100,
    ),
  )

  root.dataset.jobpilotTheme =
    safePreferences.theme

  root.dataset.jobpilotEffectiveTheme =
    effectiveTheme

  root.dataset.jobpilotScrollbars =
    safePreferences.scrollbars

  root.dataset.jobpilotSpacing =
    safePreferences.spacing

  root.dataset.jobpilotReduceMotion =
    String(
      safePreferences.reduceMotion,
    )

  root.dataset.jobpilotHighContrast =
    String(
      safePreferences.highContrast,
    )

  root.dataset.jobpilotFocusOutlines =
    String(
      safePreferences.focusOutlines,
    )

  root.dataset.jobpilotSolidPanels =
    String(
      safePreferences.solidPanels,
    )

  root.dataset.jobpilotButtonLabels =
    safePreferences.buttonLabels
      ? "visible"
      : "hidden"

  return safePreferences
}

export function startUiPreferences() {
  applyUiPreferences()

  function handlePreferenceUpdate(
    event,
  ) {
    applyUiPreferences(
      event.detail ||
      loadUiPreferences(),
    )
  }

  function handleSystemThemeChange() {
    const preferences =
      loadUiPreferences()

    if (
      preferences.theme ===
      "system"
    ) {
      applyUiPreferences(
        preferences,
      )
    }
  }

  window.addEventListener(
    "jobpilot:ui-preferences-updated",
    handlePreferenceUpdate,
  )

  const mediaQuery =
    window.matchMedia?.(
      "(prefers-color-scheme: light)",
    )

  mediaQuery?.addEventListener?.(
    "change",
    handleSystemThemeChange,
  )

  return () => {
    window.removeEventListener(
      "jobpilot:ui-preferences-updated",
      handlePreferenceUpdate,
    )

    mediaQuery?.removeEventListener?.(
      "change",
      handleSystemThemeChange,
    )
  }
}

export function requestSetupGuide() {
  window.dispatchEvent(
    new Event(
      "jobpilot:open-setup-guide",
    ),
  )
}

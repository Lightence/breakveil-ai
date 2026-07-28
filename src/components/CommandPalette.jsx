import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import {
  getCommandGroupToneClass,
} from "../lib/semanticUi"

import {
  Accessibility,
  AppWindow,
  BarChart3,
  BellRing,
  Bot,
  Briefcase,
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Home,
  KeyRound,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Wifi,
  Zap,
} from "lucide-react"

const trackedJobsStorageKey =
  "jobpilot.jobs"

const quickAccessCommands = [
  {
    id:
      "page-dashboard",

    name:
      "Dashboard",

    description:
      "Return to your overview",

    path:
      "/dashboard",

    icon:
      Home,

    group:
      "Pages",

    keywords: [
      "home",
      "overview",
      "best matches",
      "actions",
    ],
  },
  {
    id:
      "page-jobs",

    name:
      "Jobs",

    description:
      "Discover vacancies and manage tracked opportunities",

    path:
      "/jobs",

    icon:
      Briefcase,

    group:
      "Pages",

    keywords: [
      "vacancies",
      "saved jobs",
      "applications",
      "search",
    ],
  },
  {
    id:
      "page-resume-library",

    name:
      "Resume Library",

    description:
      "Manage CVs and cover letters",

    path:
      "/resume-library",

    icon:
      FileText,

    group:
      "Pages",

    keywords: [
      "documents",
      "cv",
      "resume",
      "cover letter",
    ],
  },
  {
    id:
      "page-profile",

    name:
      "Candidate Profile",

    description:
      "Manage reusable application information",

    path:
      "/profile",

    icon:
      CircleUserRound,

    group:
      "Pages",

    keywords: [
      "skills",
      "experience",
      "target roles",
      "candidate",
    ],
  },
  {
    id:
      "page-assistant",

    name:
      "AI Assistant",

    description:
      "Analyse a vacancy and prepare application content",

    path:
      "/assistant",

    icon:
      Bot,

    group:
      "Pages",

    keywords: [
      "analysis",
      "job description",
      "cover letter",
      "application pack",
    ],
  },
  {
    id:
      "page-automation",

    name:
      "Automation",

    description:
      "Manage discovery, Gmail and delivery controls",

    path:
      "/automation",

    icon:
      Zap,

    group:
      "Pages",

    keywords: [
      "gmail",
      "automatic",
      "discovery",
      "sending",
    ],
  },
  {
    id:
      "page-analytics",

    name:
      "Analytics",

    description:
      "View job-search statistics and outcomes",

    path:
      "/analytics",

    icon:
      BarChart3,

    group:
      "Pages",

    keywords: [
      "statistics",
      "pipeline",
      "response rate",
      "interviews",
    ],
  },
  {
    id:
      "page-settings",

    name:
      "Settings",

    description:
      "Change application preferences and local controls",

    path:
      "/settings",

    icon:
      Settings,

    group:
      "Pages",

    keywords: [
      "preferences",
      "appearance",
      "privacy",
      "backup",
    ],
  },
]

const searchableCommands = [
  {
    id:
      "jobs-discover",

    name:
      "Discover Jobs",

    description:
      "Open Smart Match and live vacancy search",

    path:
      "/jobs?view=discover&section=jobs-discover",

    icon:
      Search,

    group:
      "Functions",

    keywords: [
      "find jobs",
      "vacancies",
      "job search",
      "reed",
      "adzuna",
      "jooble",
      "arbeitnow",
      "jobicy",
      "remotive",
    ],
  },
  {
    id:
      "jobs-smart-match",

    name:
      "Smart Match Inbox",

    description:
      "Review automatic job matches",

    path:
      "/jobs?view=discover&section=jobs-smart-match",

    icon:
      BellRing,

    group:
      "Functions",

    keywords: [
      "automatic matches",
      "new matches",
      "discovery results",
      "recommended jobs",
    ],
  },
  {
    id:
      "jobs-live-search",

    name:
      "Live Job Search",

    description:
      "Search Reed, Adzuna, Jooble, Arbeitnow and remote providers",

    path:
      "/jobs?view=discover&section=jobs-live-search",

    icon:
      Wifi,

    group:
      "Functions",

    keywords: [
      "manual search",
      "search providers",
      "reed search",
      "adzuna search",
      "jooble search",
      "arbeitnow search",
      "jobicy search",
      "remotive search",
      "remote jobs api",
      "public jobs api",
    ],
  },
  {
    id:
      "jobs-my-jobs",

    name:
      "My Jobs",

    description:
      "Open saved, applied, interview and offer records",

    path:
      "/jobs?view=my-jobs&section=jobs-my-jobs",

    icon:
      Briefcase,

    group:
      "Functions",

    keywords: [
      "tracked jobs",
      "saved jobs",
      "applications",
      "interviews",
      "offers",
    ],
  },
  {
    id:
      "jobs-add",

    name:
      "Add a Job Manually",

    description:
      "Open the form for adding a vacancy to My Jobs",

    path:
      "/jobs?view=my-jobs&action=add-job",

    icon:
      Plus,

    group:
      "Functions",

    keywords: [
      "new job",
      "manual job",
      "track vacancy",
      "create job",
    ],
  },
  {
    id:
      "review-queue",

    name:
      "Application Review Queue",

    description:
      "Review and approve prepared application packages",

    path:
      "/review-queue",

    icon:
      ClipboardCheck,

    group:
      "Functions",

    keywords: [
      "approve applications",
      "pending applications",
      "review package",
    ],
  },
  {
    id:
      "automation-gmail",

    name:
      "Gmail and Delivery Controls",

    description:
      "Open Gmail connection, sending limits and delivery settings",

    path:
      "/automation?section=gmail",

    icon:
      Mail,

    group:
      "Functions",

    keywords: [
      "email",
      "send applications",
      "gmail connection",
      "delivery",
      "drafts",
    ],
  },
  {
    id:
      "automation-discovery",

    name:
      "Automatic Job Discovery",

    description:
      "Manage discovery schedule, filters and matching",

    path:
      "/automation?section=discovery",

    icon:
      Zap,

    group:
      "Functions",

    keywords: [
      "automatic search",
      "schedule",
      "matching",
      "discovery filters",
    ],
  },
  {
    id:
      "guided-setup",

    name:
      "Open Guided Setup",

    description:
      "Resume the step-by-step BreakVeil setup guide",

    path:
      "/settings?category=general&section=settings-guided-setup&action=setup",

    icon:
      Sparkles,

    group:
      "Functions",

    keywords: [
      "setup wizard",
      "getting started",
      "onboarding",
      "configure jobpilot",
    ],
  },

  {
    id:
      "setting-theme",

    name:
      "Interface Theme",

    description:
      "Choose System, Dark, Light or Midnight",

    path:
      "/settings?category=appearance&section=settings-appearance",

    icon:
      Palette,

    group:
      "Settings",

    keywords: [
      "dark mode",
      "light mode",
      "midnight",
      "system theme",
      "colour",
    ],
  },
  {
    id:
      "setting-scale",

    name:
      "Interface Scale",

    description:
      "Make the entire BreakVeil interface smaller or larger",

    path:
      "/settings?category=appearance&section=settings-appearance",

    icon:
      Monitor,

    group:
      "Settings",

    keywords: [
      "gui scale",
      "zoom",
      "text size",
      "80 percent",
      "120 percent",
    ],
  },
  {
    id:
      "setting-scrollbars",

    name:
      "Scrollbar Visibility",

    description:
      "Show or hide application scrollbars",

    path:
      "/settings?category=appearance&section=settings-appearance",

    icon:
      ScrollText,

    group:
      "Settings",

    keywords: [
      "scroll bar",
      "hidden scrollbar",
      "visible scrollbar",
    ],
  },
  {
    id:
      "setting-startup",

    name:
      "Launch BreakVeil with Windows",

    description:
      "Control whether BreakVeil opens after Windows sign-in",

    path:
      "/settings?category=general&section=settings-startup",

    icon:
      AppWindow,

    group:
      "Settings",

    keywords: [
      "windows startup",
      "open at login",
      "start automatically",
    ],
  },
  {
    id:
      "setting-minimised",

    name:
      "Start Minimized to the System Tray",

    description:
      "Open BreakVeil quietly in the tray",

    path:
      "/settings?category=general&section=settings-startup",

    icon:
      AppWindow,

    group:
      "Settings",

    keywords: [
      "minimized",
      "minimised",
      "tray",
      "background startup",
    ],
  },
  {
    id:
      "setting-close-behaviour",

    name:
      "Keep Running When Closed",

    description:
      "Choose whether closing the window keeps BreakVeil in the tray",

    path:
      "/settings?category=general&section=settings-startup",

    icon:
      AppWindow,

    group:
      "Settings",

    keywords: [
      "close to tray",
      "quit on close",
      "background",
    ],
  },
  {
    id:
      "setting-last-page",

    name:
      "Remember the Last Page Opened",

    description:
      "Return to the most recently viewed BreakVeil page",

    path:
      "/settings?category=general&section=settings-startup",

    icon:
      RefreshCw,

    group:
      "Settings",

    keywords: [
      "restore page",
      "landing page",
      "start page",
    ],
  },
  {
    id:
      "setting-date-format",

    name:
      "Date Format",

    description:
      "Choose DD/MM/YYYY, MM/DD/YYYY or YYYY-MM-DD",

    path:
      "/settings?category=general&section=settings-regional",

    icon:
      CalendarDays,

    group:
      "Settings",

    keywords: [
      "uk date",
      "american date",
      "regional",
    ],
  },
  {
    id:
      "setting-distance",

    name:
      "Distance Unit",

    description:
      "Display search distances in miles or kilometres",

    path:
      "/settings?category=general&section=settings-regional",

    icon:
      MapPin,

    group:
      "Settings",

    keywords: [
      "miles",
      "kilometres",
      "kilometers",
      "radius",
    ],
  },
  {
    id:
      "setting-reduce-motion",

    name:
      "Reduce Animations",

    description:
      "Remove most transitions and animated movement",

    path:
      "/settings?category=accessibility&section=settings-accessibility",

    icon:
      Accessibility,

    group:
      "Settings",

    keywords: [
      "motion",
      "animations",
      "transitions",
      "accessibility",
    ],
  },
  {
    id:
      "setting-high-contrast",

    name:
      "High-Contrast Highlights",

    description:
      "Strengthen selected states and coloured status panels",

    path:
      "/settings?category=accessibility&section=settings-accessibility",

    icon:
      Accessibility,

    group:
      "Settings",

    keywords: [
      "contrast",
      "selected states",
      "strong colours",
    ],
  },
  {
    id:
      "setting-focus",

    name:
      "Enhanced Focus Indicators",

    description:
      "Show larger rings around focused buttons and fields",

    path:
      "/settings?category=accessibility&section=settings-accessibility",

    icon:
      Accessibility,

    group:
      "Settings",

    keywords: [
      "keyboard focus",
      "focus outline",
      "tab navigation",
      "blue ring",
    ],
  },
  {
    id:
      "setting-spacing",

    name:
      "Interface Spacing",

    description:
      "Choose Compact or Comfortable spacing",

    path:
      "/settings?category=accessibility&section=settings-accessibility",

    icon:
      SlidersHorizontal,

    group:
      "Settings",

    keywords: [
      "compact",
      "comfortable",
      "padding",
      "density",
    ],
  },
  {
    id:
      "setting-solid-backgrounds",

    name:
      "Use Solid Backgrounds",

    description:
      "Remove translucent panel and highlight backgrounds",

    path:
      "/settings?category=accessibility&section=settings-accessibility",

    icon:
      Accessibility,

    group:
      "Settings",

    keywords: [
      "transparency",
      "translucent",
      "solid panels",
      "backdrop blur",
    ],
  },
  {
    id:
      "setting-button-labels",

    name:
      "Always Show Icon Button Labels",

    description:
      "Add text beside supported icon-only controls",

    path:
      "/settings?category=accessibility&section=settings-accessibility",

    icon:
      Accessibility,

    group:
      "Settings",

    keywords: [
      "button text",
      "icon labels",
      "accessibility labels",
    ],
  },
  {
    id:
      "setting-cover-length",

    name:
      "Preferred Cover-Letter Length",

    description:
      "Choose Concise, Standard or Detailed",

    path:
      "/settings?category=applications&section=settings-applications",

    icon:
      FileText,

    group:
      "Settings",

    keywords: [
      "cover letter length",
      "concise",
      "detailed",
      "application writing",
    ],
  },
  {
    id:
      "setting-email-subject",

    name:
      "Default Email Subject Format",

    description:
      "Choose the subject used for new application emails",

    path:
      "/settings?category=applications&section=settings-applications",

    icon:
      Mail,

    group:
      "Settings",

    keywords: [
      "application email",
      "subject line",
      "email format",
    ],
  },
  {
    id:
      "setting-interview-structure",

    name:
      "Default Interview-Answer Structure",

    description:
      "Choose STAR, STAR with Reflection, Concise Evidence or Free-Form",

    path:
      "/settings?category=applications&section=settings-applications",

    icon:
      UserRound,

    group:
      "Settings",

    keywords: [
      "star answers",
      "interview answers",
      "reflection",
      "evidence",
    ],
  },
  {
    id:
      "setting-cover-default",

    name:
      "Include a Cover Letter by Default",

    description:
      "Control whether new applications start with a cover letter selected",

    path:
      "/settings?category=applications&section=settings-applications",

    icon:
      FileText,

    group:
      "Settings",

    keywords: [
      "default cover letter",
      "attach cover letter",
      "application default",
    ],
  },
  {
    id:
      "setting-companies-house",

    name:
      "Companies House Connection",

    description:
      "Connect the official UK company register for cited workspace research",

    path:
      "/settings?category=connections&section=settings-companies-house",

    icon:
      Landmark,

    group:
      "Settings",

    keywords: [
      "company research",
      "companies house",
      "company api",
      "official register",
      "business research",
      "citations",
    ],
  },

  {
    id:
      "setting-job-source-health",

    name:
      "Job Search Reliability",

    description:
      "Review provider outages, online status and retained search cache",

    path:
      "/settings?category=connections&section=settings-search-reliability",

    icon:
      Wifi,

    group:
      "Settings",

    keywords: [
      "offline",
      "provider health",
      "reed outage",
      "adzuna outage",
      "cached jobs",
      "partial results",
      "network",
      "internet",
    ],
  },
  {
    id:
      "setting-reed",

    name:
      "Reed Connection",

    description:
      "Add, test or remove the Reed vacancy-search API key",

    path:
      "/settings?category=connections&section=settings-reed",

    icon:
      Briefcase,

    group:
      "Settings",

    keywords: [
      "reed api",
      "reed key",
      "job source",
      "vacancy provider",
    ],
  },
  {
    id:
      "setting-adzuna",

    name:
      "Adzuna Connection",

    description:
      "Add, test or remove Adzuna API credentials",

    path:
      "/settings?category=connections&section=settings-adzuna",

    icon:
      Briefcase,

    group:
      "Settings",

    keywords: [
      "adzuna api",
      "application id",
      "application key",
      "job source",
    ],
  },
  {
    id:
      "setting-jooble",

    name:
      "Jooble Connection",

    description:
      "Add, test or remove the Jooble REST API key",

    path:
      "/settings?category=connections&section=settings-jooble",

    icon:
      Briefcase,

    group:
      "Settings",

    keywords: [
      "jooble api",
      "jooble key",
      "job source",
      "vacancy provider",
    ],
  },
  {
    id:
      "setting-arbeitnow",

    name:
      "Arbeitnow (Germany) Public Source",

    description:
      "Review or test the no-key Germany-focused Arbeitnow vacancy feed",

    path:
      "/settings?category=connections&section=settings-arbeitnow",

    icon:
      Briefcase,

    group:
      "Settings",

    keywords: [
      "arbeitnow api",
      "public job source",
      "europe jobs",
      "full descriptions",
      "vacancy provider",
    ],
  },
  {
    id:
      "setting-jobicy",

    name:
      "Jobicy Remote Source",

    description:
      "Review or test the no-key Jobicy remote vacancy feed",

    path:
      "/settings?category=connections&section=settings-jobicy",

    icon:
      Briefcase,

    group:
      "Settings",

    keywords: [
      "jobicy api",
      "remote jobs",
      "public job source",
      "full descriptions",
      "vacancy provider",
    ],
  },
  {
    id:
      "setting-remotive",

    name:
      "Remotive Remote Source",

    description:
      "Review or test the no-key Remotive remote vacancy feed",

    path:
      "/settings?category=connections&section=settings-remotive",

    icon:
      Briefcase,

    group:
      "Settings",

    keywords: [
      "remotive api",
      "remote jobs",
      "public job source",
      "attribution",
      "vacancy provider",
    ],
  },
  {
    id:
      "setting-secure-storage",

    name:
      "Protected Credential Storage",

    description:
      "Check Windows encryption used for API credentials",

    path:
      "/settings?category=connections&section=settings-connections",

    icon:
      ShieldCheck,

    group:
      "Settings",

    keywords: [
      "encrypted storage",
      "credentials",
      "dpapi",
      "secure storage",
    ],
  },
  {
    id:
      "data-recovery-centre",

    name:
      "Recovery Centre",

    description:
      "Inspect quarantines, restore safety snapshots and repair Resume Library references",

    path:
      "/settings?category=data&section=data-recovery-centre",

    icon:
      ShieldCheck,

    group:
      "Data and Privacy",

    keywords: [
      "safe mode",
      "corrupt data",
      "recovery",
      "quarantine",
      "restore snapshot",
      "missing documents",
      "repair resume library",
      "blank screen",
    ],
  },
  {
    id:
      "data-compatibility",

    name:
      "Data Compatibility and Migrations",

    description:
      "Check the local data schema and open migration safety snapshots",

    path:
      "/settings?category=data&section=data-compatibility",

    icon:
      ShieldCheck,

    group:
      "Data and Privacy",

    keywords: [
      "schema",
      "migration",
      "data version",
      "compatibility",
      "safety snapshot",
      "update protection",
    ],
  },
  {
    id:
      "data-create-backup",

    name:
      "Create Backup",

    description:
      "Create a portable restorable BreakVeil backup",

    path:
      "/settings?category=data&section=data-backup-restore",

    icon:
      HardDrive,

    group:
      "Data and Privacy",

    keywords: [
      "manual backup",
      "save backup",
      "jobpilot backup",
      "protect data",
    ],
  },
  {
    id:
      "data-restore-backup",

    name:
      "Restore Backup",

    description:
      "Restore jobs, profile data, applications and documents",

    path:
      "/settings?category=data&section=data-backup-restore",

    icon:
      HardDrive,

    group:
      "Data and Privacy",

    keywords: [
      "load backup",
      "recover data",
      "restore jobpilot",
    ],
  },
  {
    id:
      "data-automatic-backups",

    name:
      "Automatic Backup Schedule",

    description:
      "Choose Disabled, Daily, Weekly or Monthly backups",

    path:
      "/settings?category=data&section=data-automatic-backups",

    icon:
      HardDrive,

    group:
      "Data and Privacy",

    keywords: [
      "scheduled backup",
      "backup frequency",
      "backup retention",
    ],
  },
  {
    id:
      "data-export",

    name:
      "Export All BreakVeil Data",

    description:
      "Create a readable JSON export and document folder",

    path:
      "/settings?category=data&section=data-export-storage",

    icon:
      Database,

    group:
      "Data and Privacy",

    keywords: [
      "export json",
      "download data",
      "data export",
    ],
  },
  {
    id:
      "data-storage-location",

    name:
      "Show Local Storage Location",

    description:
      "Open the Windows folder containing BreakVeil data",

    path:
      "/settings?category=data&section=data-export-storage",

    icon:
      FolderOpen,

    group:
      "Data and Privacy",

    keywords: [
      "user data folder",
      "documents location",
      "local files",
      "storage folder",
    ],
  },
  {
    id:
      "data-clear-cache",

    name:
      "Clear Search Cache",

    description:
      "Remove cached provider results without deleting saved jobs",

    path:
      "/settings?category=data&section=data-cleanup-reset",

    icon:
      Trash2,

    group:
      "Data and Privacy",

    keywords: [
      "cached searches",
      "clear job cache",
      "provider cache",
    ],
  },
  {
    id:
      "data-clear-activity",

    name:
      "Clear Activity History",

    description:
      "Remove local job and application activity records",

    path:
      "/settings?category=data&section=data-cleanup-reset",

    icon:
      Trash2,

    group:
      "Data and Privacy",

    keywords: [
      "delete history",
      "activity log",
      "clear events",
    ],
  },
  {
    id:
      "data-reset-appearance",

    name:
      "Reset Appearance Only",

    description:
      "Restore theme, scale and accessibility defaults",

    path:
      "/settings?category=data&section=data-cleanup-reset",

    icon:
      RefreshCw,

    group:
      "Data and Privacy",

    keywords: [
      "reset theme",
      "default appearance",
      "reset ui",
    ],
  },
  {
    id:
      "data-reset-all",

    name:
      "Reset All Application Data",

    description:
      "Open the confirmed full local-data reset controls",

    path:
      "/settings?category=data&section=data-cleanup-reset",

    icon:
      Trash2,

    group:
      "Data and Privacy",

    keywords: [
      "factory reset",
      "delete all data",
      "clear jobpilot",
    ],
  },
  {
    id:
      "privacy-overview",

    name:
      "Local Privacy Overview",

    description:
      "See what BreakVeil stores locally and when data leaves the computer",

    path:
      "/settings?category=privacy&section=privacy-overview",

    icon:
      LockKeyhole,

    group:
      "Data and Privacy",

    keywords: [
      "privacy",
      "local data",
      "analytics",
      "crash reporting",
    ],
  },
  {
    id:
      "privacy-permissions",

    name:
      "Connected Services and Permissions",

    description:
      "Review Gmail and all available job-source permissions",

    path:
      "/settings?category=privacy&section=privacy-permissions",

    icon:
      KeyRound,

    group:
      "Data and Privacy",

    keywords: [
      "service access",
      "oauth permissions",
      "connected accounts",
    ],
  },
  {
    id:
      "privacy-clear-drafts",

    name:
      "Clear Assistant Drafts",

    description:
      "Remove the current vacancy draft and unsaved tailoring content",

    path:
      "/settings?category=privacy&section=privacy-cleanup",

    icon:
      Bot,

    group:
      "Data and Privacy",

    keywords: [
      "delete assistant draft",
      "clear analysis",
      "remove tailoring",
    ],
  },
  {
    id:
      "privacy-clear-searches",

    name:
      "Clear Recent Searches",

    description:
      "Remove stored discovery history without changing the active schedule",

    path:
      "/settings?category=privacy&section=privacy-cleanup",

    icon:
      Search,

    group:
      "Data and Privacy",

    keywords: [
      "delete searches",
      "discovery history",
      "search history",
    ],
  },
  {
    id:
      "privacy-clear-gmail",

    name:
      "Clear Gmail Sending Logs",

    description:
      "Remove local Gmail delivery history without disconnecting Gmail",

    path:
      "/settings?category=privacy&section=privacy-cleanup",

    icon:
      Mail,

    group:
      "Data and Privacy",

    keywords: [
      "email logs",
      "delivery history",
      "gmail history",
    ],
  },
  {
    id:
      "privacy-revoke",

    name:
      "Revoke All Stored Authorisations",

    description:
      "Disconnect Gmail and remove encrypted Reed, Adzuna and Jooble credentials",

    path:
      "/settings?category=privacy&section=privacy-authorisations",

    icon:
      KeyRound,

    group:
      "Data and Privacy",

    keywords: [
      "disconnect services",
      "remove credentials",
      "revoke oauth",
      "sign out gmail",
    ],
  },
]

const groupOrder = [
  "Pages",
  "Functions",
  "Settings",
  "Data and Privacy",
  "Tracked Jobs",
]

function normaliseText(
  value,
) {
  return String(
    value ||
    "",
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9£]+/g,
      " ",
    )
    .trim()
}

function getSearchScore(
  command,
  query,
) {
  const normalisedQuery =
    normaliseText(
      query,
    )

  if (!normalisedQuery) {
    return 0
  }

  const name =
    normaliseText(
      command.name,
    )

  const description =
    normaliseText(
      command.description,
    )

  const keywords =
    normaliseText(
      (
        command.keywords ||
        []
      ).join(
        " ",
      ),
    )

  const group =
    normaliseText(
      command.group,
    )

  const combined =
    `${name} ${description} ${keywords} ${group}`

  const tokens =
    normalisedQuery
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      )

  if (
    !tokens.every(
      (token) =>
        combined.includes(
          token,
        ),
    )
  ) {
    return -1
  }

  let score =
    0

  if (
    name ===
    normalisedQuery
  ) {
    score +=
      120
  } else if (
    name.startsWith(
      normalisedQuery,
    )
  ) {
    score +=
      95
  } else if (
    name
      .split(
        " ",
      )
      .some(
        (word) =>
          word.startsWith(
            normalisedQuery,
          ),
      )
  ) {
    score +=
      80
  } else if (
    name.includes(
      normalisedQuery,
    )
  ) {
    score +=
      70
  }

  if (
    keywords.includes(
      normalisedQuery,
    )
  ) {
    score +=
      45
  }

  if (
    description.includes(
      normalisedQuery,
    )
  ) {
    score +=
      30
  }

  score +=
    tokens.reduce(
      (
        total,
        token,
      ) => {
        if (
          name
            .split(
              " ",
            )
            .some(
              (word) =>
                word.startsWith(
                  token,
                ),
            )
        ) {
          return total +
            12
        }

        if (
          name.includes(
            token,
          )
        ) {
          return total +
            8
        }

        if (
          keywords.includes(
            token,
          )
        ) {
          return total +
            5
        }

        return total +
          2
      },
      0,
    )

  return score
}

function loadTrackedJobCommands() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          trackedJobsStorageKey,
        ) ||
        "[]",
      )

    if (
      !Array.isArray(
        parsed,
      )
    ) {
      return []
    }

    return parsed
      .filter(
        (job) =>
          job &&
          job.id,
      )
      .map(
        (job) => {
          const role =
            String(
              job.role ||
              job.title ||
              "Untitled Job",
            ).trim()

          const company =
            String(
              job.company ||
              "Unknown Company",
            ).trim()

          const status =
            String(
              job.status ||
              "Saved",
            ).trim()

          const location =
            String(
              job.location ||
              "",
            ).trim()

          return {
            id:
              `tracked-job-${job.id}`,

            name:
              `${role} at ${company}`,

            description: [
              status,
              location,
            ]
              .filter(
                Boolean,
              )
              .join(
                " • ",
              ),

            path:
              `/jobs/${job.id}`,

            icon:
              Briefcase,

            group:
              "Tracked Jobs",

            keywords: [
              role,
              company,
              status,
              location,
              job.nextAction,
              job.contactName,
            ],
          }
        },
      )
  } catch {
    return []
  }
}

export default function CommandPalette({
  open,
  onClose,
}) {
  const navigate =
    useNavigate()

  const resultListRef =
    useRef(
      null,
    )

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0)

  const [
    trackedJobCommands,
    setTrackedJobCommands,
  ] = useState([])

  const hasSearch =
    search.trim().length >
    0

  const searchResults =
    useMemo(
      () => {
        if (!hasSearch) {
          return quickAccessCommands
        }

        return [
          ...quickAccessCommands,
          ...searchableCommands,
          ...trackedJobCommands,
        ]
          .map(
            (command) => ({
              ...command,

              searchScore:
                getSearchScore(
                  command,
                  search,
                ),
            }),
          )
          .filter(
            (command) =>
              command.searchScore >=
              0,
          )
          .sort(
            (
              first,
              second,
            ) => {
              if (
                second.searchScore !==
                first.searchScore
              ) {
                return (
                  second.searchScore -
                  first.searchScore
                )
              }

              return (
                groupOrder.indexOf(
                  first.group,
                ) -
                groupOrder.indexOf(
                  second.group,
                )
              )
            },
          )
          .slice(
            0,
            18,
          )
      },
      [
        hasSearch,
        search,
        trackedJobCommands,
      ],
    )

  const groupedResults =
    useMemo(
      () => {
        if (!hasSearch) {
          return [
            {
              group:
                "Quick Access",

              commands:
                quickAccessCommands,
            },
          ]
        }

        return groupOrder
          .map(
            (group) => ({
              group,

              commands:
                searchResults.filter(
                  (command) =>
                    command.group ===
                    group,
                ),
            }),
          )
          .filter(
            (section) =>
              section.commands
                .length >
              0,
          )
      },
      [
        hasSearch,
        searchResults,
      ],
    )

  const flatResults =
    useMemo(
      () =>
        groupedResults.flatMap(
          (section) =>
            section.commands,
        ),
      [
        groupedResults,
      ],
    )

  useEffect(() => {
    if (open) {
      setSearch(
        "",
      )

      setSelectedIndex(
        0,
      )

      setTrackedJobCommands(
        loadTrackedJobCommands(),
      )
    }
  }, [
    open,
  ])

  useEffect(() => {
    setSelectedIndex(
      0,
    )
  }, [
    search,
  ])

  useEffect(() => {
    function handleEscape(
      event,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose()
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      )
    }
  }, [
    onClose,
  ])

  useEffect(() => {
    const selectedElement =
      resultListRef.current
        ?.querySelector(
          `[data-command-index="${selectedIndex}"]`,
        )

    selectedElement
      ?.scrollIntoView({
        block:
          "nearest",
      })
  }, [
    selectedIndex,
  ])

  function openCommand(
    command,
  ) {
    navigate(
      command.path,
    )

    onClose()
  }

  function handleInputKeyDown(
    event,
  ) {
    if (
      event.key ===
      "ArrowDown"
    ) {
      event.preventDefault()

      setSelectedIndex(
        (current) =>
          flatResults.length >
          0
            ? (
                current +
                1
              ) %
              flatResults.length
            : 0,
      )

      return
    }

    if (
      event.key ===
      "ArrowUp"
    ) {
      event.preventDefault()

      setSelectedIndex(
        (current) =>
          flatResults.length >
          0
            ? (
                current -
                1 +
                flatResults.length
              ) %
              flatResults.length
            : 0,
      )

      return
    }

    if (
      event.key ===
      "Enter" &&
      flatResults[
        selectedIndex
      ]
    ) {
      event.preventDefault()

      openCommand(
        flatResults[
          selectedIndex
        ],
      )
    }
  }

  if (!open) {
    return null
  }

  let commandIndex =
    0

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/70 px-4 pt-20 backdrop-blur-sm sm:pt-24"
      onClick={
        onClose
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search BreakVeil"
        className="h-fit w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
          <Search
            size={19}
            className="text-zinc-500"
          />

          <input
            aria-label="Search pages, settings, functions and tracked jobs"
            autoFocus
            value={
              search
            }
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            onKeyDown={
              handleInputKeyDown
            }
            placeholder="Search pages, settings, functions and tracked jobs..."
            className="h-14 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          />

          <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            Esc
          </span>
        </div>

        <div
          ref={
            resultListRef
          }
          className="max-h-[min(31rem,65vh)] overflow-y-auto p-2"
        >
          {groupedResults.map(
            (section) => (
              <section
                key={
                  section.group
                }
                className="not-last:mb-2"
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    {
                      section.group
                    }
                  </p>

                  {hasSearch && (
                    <span className="text-[11px] text-zinc-700">
                      {
                        section.commands
                          .length
                      }{" "}
                      result
                      {section.commands
                        .length ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  )}
                </div>

                {section.commands.map(
                  (command) => {
                    const Icon =
                      command.icon

                    const currentIndex =
                      commandIndex

                    commandIndex +=
                      1

                    const selected =
                      currentIndex ===
                      selectedIndex

                    return (
                      <button
                        key={
                          command.id
                        }
                        type="button"
                        data-command-index={
                          currentIndex
                        }
                        onMouseEnter={() =>
                          setSelectedIndex(
                            currentIndex,
                          )
                        }
                        onClick={() =>
                          openCommand(
                            command,
                          )
                        }
                        className={[
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",

                          selected
                            ? "jp-command-selected border border-sky-500/20"
                            : "border border-transparent hover:border-zinc-800 hover:bg-zinc-800/70",
                        ].join(
                          " ",
                        )}
                      >
                        <div
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",

                            selected
                              ? "jp-tone-navigation"
                              : getCommandGroupToneClass(
                                  command.group,
                                ),
                          ].join(
                            " ",
                          )}
                        >
                          <Icon
                            size={17}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {
                                command.name
                              }
                            </p>

                            {command.group ===
                              "Tracked Jobs" && (
                              <span className="jp-tone-navigation shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                                Job
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {
                              command.description
                            }
                          </p>
                        </div>
                      </button>
                    )
                  },
                )}
              </section>
            ),
          )}

          {flatResults.length ===
            0 && (
            <div className="px-4 py-12 text-center">
              <Search
                size={24}
                className="mx-auto text-zinc-700"
              />

              <p className="mt-3 text-sm text-zinc-400">
                No results found
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600">
                Try terms such as backup, Gmail, interface scale, Smart Match, Reed, Arbeitnow or a company name.
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-zinc-800 px-4 py-3 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {hasSearch
              ? `${flatResults.length} matching result${flatResults.length === 1 ? "" : "s"}`
              : "Quick Access only — type to search deeper"}
          </span>

          <span className="flex items-center gap-3">
            <span>
              ↑ ↓ Navigate
            </span>

            <span>
              Enter Open
            </span>
          </span>
        </footer>
      </div>
    </div>
  )
}

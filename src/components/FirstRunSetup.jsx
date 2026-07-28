import {
  useEffect,
  useState,
} from "react"

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  Monitor,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import {
  loadUiPreferences,
  saveUiPreferences,
  setupGuideStorageKey,
  uiThemeOptions,
} from "../lib/uiPreferences"

const settingsCategoryStorageKey =
  "jobpilot.settings-category"

const steps = [
  {
    id:
      "welcome",

    title:
      "Welcome to BreakVeil AI",

    description:
      "Follow the guided route below, or open any required page directly.",
  },
  {
    id:
      "appearance",

    title:
      "Choose Your Appearance",

    description:
      "Set a comfortable theme and interface size while previewing the changes live.",
  },
  {
    id:
      "profile",

    title:
      "Build Your Candidate Profile",

    description:
      "Give BreakVeil the information it needs for useful matching and application content.",
  },
  {
    id:
      "documents",

    title:
      "Prepare Your Documents",

    description:
      "Import your main CV and choose the files BreakVeil should use by default.",
  },
  {
    id:
      "connections",

    title:
      "Connect Optional Services",

    description:
      "Open the exact pages used for vacancy sources, Gmail and automation controls.",
  },
]

function loadGuideStatus() {
  try {
    const storedValue =
      localStorage.getItem(
        setupGuideStorageKey,
      )

    return storedValue
      ? JSON.parse(
          storedValue,
        )
      : null
  } catch {
    return null
  }
}

function saveGuideStatus(
  value,
) {
  try {
    localStorage.setItem(
      setupGuideStorageKey,
      JSON.stringify(
        value,
      ),
    )
  } catch {
    // The guide remains usable for the current session.
  }
}

function setSettingsCategory(
  category,
) {
  try {
    localStorage.setItem(
      settingsCategoryStorageKey,
      category,
    )
  } catch {
    // Settings still opens even if category storage is unavailable.
  }
}

export default function FirstRunSetup() {
  const navigate =
    useNavigate()

  const [
    open,
    setOpen,
  ] = useState(false)

  const [
    currentStep,
    setCurrentStep,
  ] = useState(0)

  const [
    preferences,
    setPreferences,
  ] = useState(
    loadUiPreferences,
  )

  const [
    guideStatus,
    setGuideStatus,
  ] = useState(
    loadGuideStatus,
  )

  const [
    initialised,
    setInitialised,
  ] = useState(false)

  useEffect(() => {
    const storedStatus =
      loadGuideStatus()

    setGuideStatus(
      storedStatus,
    )

    if (
      Number.isInteger(
        storedStatus
          ?.currentStep,
      )
    ) {
      setCurrentStep(
        Math.min(
          Math.max(
            storedStatus.currentStep,
            0,
          ),
          steps.length -
            1,
        ),
      )
    }

    if (
      !storedStatus
        ?.completed
    ) {
      const timeoutId =
        window.setTimeout(
          () => {
            setInitialised(
              true,
            )

            setOpen(
              true,
            )
          },
          600,
        )

      return () =>
        window.clearTimeout(
          timeoutId,
        )
    }

    setInitialised(
      true,
    )

    return undefined
  }, [])

  useEffect(() => {
    function openGuide() {
      const storedStatus =
        loadGuideStatus()

      setGuideStatus(
        storedStatus,
      )

      setCurrentStep(
        Number.isInteger(
          storedStatus
            ?.currentStep,
        )
          ? Math.min(
              Math.max(
                storedStatus.currentStep,
                0,
              ),
              steps.length -
                1,
            )
          : 0,
      )

      setPreferences(
        loadUiPreferences(),
      )

      setInitialised(
        true,
      )

      setOpen(
        true,
      )
    }

    window.addEventListener(
      "jobpilot:open-setup-guide",
      openGuide,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:open-setup-guide",
        openGuide,
      )
    }
  }, [])

  function persistGuideStatus(
    value,
  ) {
    saveGuideStatus(
      value,
    )

    setGuideStatus(
      value,
    )
  }

  function reopenGuide() {
    const storedStatus =
      loadGuideStatus()

    setGuideStatus(
      storedStatus,
    )

    setCurrentStep(
      Number.isInteger(
        storedStatus
          ?.currentStep,
      )
        ? Math.min(
            Math.max(
              storedStatus.currentStep,
              0,
            ),
            steps.length -
              1,
          )
        : 0,
    )

    setPreferences(
      loadUiPreferences(),
    )

    setOpen(
      true,
    )
  }

  if (!open) {
    if (
      !initialised ||
      guideStatus
        ?.completed
    ) {
      return null
    }

    return (
      <button
        type="button"
        onClick={
          reopenGuide
        }
        className="fixed bottom-5 right-5 z-[85] flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl border border-sky-500/30 bg-[#151515] px-4 py-3 text-left shadow-[0_20px_55px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-sky-400/50 hover:bg-zinc-900"
        aria-label="Return to guided setup"
        title="Return to guided setup"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-300">
          <ArrowLeft
            size={17}
          />
        </span>

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-100">
            Return to Setup
          </span>

          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            Continue Step {currentStep + 1} of {steps.length}
          </span>
        </span>
      </button>
    )
  }

  function updatePreference(
    field,
    value,
  ) {
    const updatedPreferences =
      saveUiPreferences({
        ...preferences,

        [field]:
          value,
      })

    setPreferences(
      updatedPreferences,
    )
  }

  function saveProgress(
    step =
      currentStep,
  ) {
    persistGuideStatus({
      completed:
        false,

      skipped:
        false,

      currentStep:
        step,

      updatedAt:
        new Date()
          .toISOString(),
    })
  }

  function closeGuide({
    skipped =
      false,
  } = {}) {
    persistGuideStatus({
      completed:
        skipped,

      skipped,

      currentStep,

      updatedAt:
        new Date()
          .toISOString(),
    })

    setOpen(
      false,
    )
  }

  function completeGuide() {
    persistGuideStatus({
      completed:
        true,

      skipped:
        false,

      currentStep:
        steps.length -
          1,

      completedAt:
        new Date()
          .toISOString(),
    })

    setOpen(
      false,
    )
  }

  function openDestination(
    destination,
    {
      settingsCategory =
        "",

      pageSection =
        "",
    } = {},
  ) {
    if (
      settingsCategory
    ) {
      setSettingsCategory(
        settingsCategory,
      )

      window.dispatchEvent(
        new CustomEvent(
          "jobpilot:settings-category-request",
          {
            detail: {
              category:
                settingsCategory,
            },
          },
        ),
      )
    }

    saveProgress()
    setOpen(
      false,
    )

    const parameters =
      new URLSearchParams()

    if (
      settingsCategory
    ) {
      parameters.set(
        "category",
        settingsCategory,
      )
    }

    if (
      pageSection
    ) {
      parameters.set(
        "section",
        pageSection,
      )
    }

    parameters.set(
      "setup",
      "1",
    )

    const target =
      parameters.toString()
        ? `${destination}?${parameters.toString()}`
        : destination

    navigate(
      target,
    )
  }

  function nextStep() {
    if (
      currentStep >=
      steps.length -
        1
    ) {
      completeGuide()
      return
    }

    const next =
      currentStep +
      1

    setCurrentStep(
      next,
    )

    saveProgress(
      next,
    )
  }

  function previousStep() {
    const previous =
      Math.max(
        0,
        currentStep -
          1,
      )

    setCurrentStep(
      previous,
    )

    saveProgress(
      previous,
    )
  }

  function skipStep() {
    nextStep()
  }

  const progress =
    (
      (
        currentStep +
        1
      ) /
      steps.length
    ) *
    100

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl">
        <header className="shrink-0 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                Guided Setup • Step {currentStep + 1} of {steps.length}
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                {
                  steps[
                    currentStep
                  ].title
                }
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
                {
                  steps[
                    currentStep
                  ].description
                }
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                closeGuide({
                  skipped:
                    true,
                })
              }
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
              title="Skip and close the setup guide"
              aria-label="Skip and close setup guide"
            >
              <X
                size={19}
              />
            </button>
          </div>

          <div className="h-1 bg-zinc-900">
            <div
              className="h-full bg-sky-400 transition-all"
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {currentStep ===
            0 && (
            <WelcomeStep
              onOpen={
                openDestination
              }
            />
          )}

          {currentStep ===
            1 && (
            <AppearanceStep
              preferences={
                preferences
              }
              onUpdate={
                updatePreference
              }
              onOpen={
                openDestination
              }
            />
          )}

          {currentStep ===
            2 && (
            <ProfileStep
              onOpen={
                openDestination
              }
            />
          )}

          {currentStep ===
            3 && (
            <DocumentsStep
              onOpen={
                openDestination
              }
            />
          )}

          {currentStep ===
            4 && (
            <ConnectionStep
              onOpen={
                openDestination
              }
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-2">
            {currentStep >
              0 && (
              <button
                type="button"
                onClick={
                  previousStep
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                <ArrowLeft
                  size={16}
                />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={
                skipStep
              }
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              Skip This Step
            </button>
          </div>

          <button
            type="button"
            onClick={
              nextStep
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            {currentStep ===
            steps.length -
              1
              ? "Finish Setup"
              : "Continue"}

            {currentStep ===
            steps.length -
              1 ? (
              <CheckCircle2
                size={16}
              />
            ) : (
              <ArrowRight
                size={16}
              />
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}

function WelcomeStep({
  onOpen,
}) {
  const routes = [
    {
      icon:
        UserRound,

      title:
        "Candidate Profile",

      description:
        "Add your experience, skills, target roles, preferred locations and salary.",

      action:
        "Open Profile",

      destination:
        "/profile",
    },
    {
      icon:
        FileText,

      title:
        "Resume Library",

      description:
        "Import your main CV and select the documents used by default.",

      action:
        "Open Resume Library",

      destination:
        "/resume-library",
    },
    {
      icon:
        Briefcase,

      title:
        "Jobs",

      description:
        "Discover vacancies, save suitable roles and manage your application progress.",

      action:
        "Open Jobs",

      destination:
        "/jobs",
    },
  ]

  return (
    <div>
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
        <p className="text-sm font-semibold text-sky-200">
          This guide now takes you directly to each setup area.
        </p>

        <p className="mt-2 text-sm leading-7 text-zinc-400">
          Opening another page pauses the guide instead of completing it. Use the Return to Setup button in the bottom-right corner to continue where you left off.
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {routes.map(
          (route) => (
            <GuidedActionCard
              key={
                route.title
              }
              {...route}
              onClick={() =>
                onOpen(
                  route.destination,
                )
              }
            />
          ),
        )}
      </div>
    </div>
  )
}

function AppearanceStep({
  preferences,
  onUpdate,
  onOpen,
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {uiThemeOptions.map(
          (theme) => (
            <button
              key={
                theme.value
              }
              type="button"
              aria-pressed={
                preferences.theme ===
                theme.value
              }
              onClick={() =>
                onUpdate(
                  "theme",
                  theme.value,
                )
              }
              className={[
                "rounded-2xl border p-4 text-left transition",

                preferences.theme ===
                  theme.value
                  ? "border-sky-500/40 bg-sky-500/10 shadow-sm"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
              ].join(
                " ",
              )}
            >
              <div
                className="h-16 rounded-xl border border-black/10"
                style={{
                  background:
                    theme.preview,
                }}
              />

              <p className="mt-3 text-sm font-semibold">
                {
                  theme.label
                }
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {
                  theme.description
                }
              </p>
            </button>
          ),
        )}
      </div>

      <label className="mt-5 block rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <span className="flex items-center justify-between gap-4">
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Monitor
                size={16}
              />
              Interface Scale
            </span>

            <span className="mt-1 block text-xs leading-5 text-zinc-600">
              Adjust this until text and controls feel comfortable.
            </span>
          </span>

          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm font-semibold text-zinc-300">
            {preferences.scale}%
          </span>
        </span>

        <input
          type="range"
          min="80"
          max="120"
          step="5"
          value={
            preferences.scale
          }
          onChange={(event) =>
            onUpdate(
              "scale",
              Number(
                event.target.value,
              ),
            )
          }
          className="mt-5 w-full accent-sky-400"
        />

        <span className="mt-2 flex justify-between text-[11px] text-zinc-600">
          <span>
            More Content
          </span>

          <span>
            Standard
          </span>

          <span>
            Larger
          </span>
        </span>
      </label>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() =>
            onOpen(
              "/settings",
              {
                settingsCategory:
                  "appearance",
              },
            )
          }
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          <Settings
            size={16}
          />
          Open All Appearance Settings
        </button>
      </div>
    </div>
  )
}

function ProfileStep({
  onOpen,
}) {
  const checks = [
    "Your current role and work history",
    "Target job titles and preferred locations",
    "Skills and strengths used for matching",
    "Minimum salary and travel preferences",
  ]

  return (
    <GuidedPageStep
      icon={
        UserRound
      }
      title="Candidate Profile"
      description="This information powers Smart Match, local vacancy analysis, cover letters and interview preparation."
      checks={
        checks
      }
      action="Open Candidate Profile"
      onClick={() =>
        onOpen(
          "/profile",
        )
      }
    />
  )
}

function DocumentsStep({
  onOpen,
}) {
  const checks = [
    "Import your latest CV",
    "Mark the main CV as the default document",
    "Add a reusable cover letter when available",
    "Preview each document to confirm the correct file was imported",
  ]

  return (
    <GuidedPageStep
      icon={
        FileText
      }
      title="Resume Library"
      description="BreakVeil uses your selected defaults when preparing application packages and review queues."
      checks={
        checks
      }
      action="Open Resume Library"
      onClick={() =>
        onOpen(
          "/resume-library",
        )
      }
    />
  )
}

function ConnectionStep({
  onOpen,
}) {
  const services = [
    {
      icon:
        Search,

      title:
        "Reed, Adzuna, Jooble, Arbeitnow, Jobicy and Remotive",

      description:
        "Add or review vacancy-search connections. Arbeitnow is Germany-focused, filtered to likely English listings and available without an API key.",

      action:
        "Open Connections",

      destination:
        "/settings",

      settingsCategory:
        "connections",
    },
    {
      icon:
        Mail,

      title:
        "Gmail",

      description:
        "Connect Gmail and review sending limits only when you are ready to prepare or deliver applications.",

      action:
        "Open Automation",

      destination:
        "/automation",

      pageSection:
        "gmail",
    },
    {
      icon:
        Briefcase,

      title:
        "Test Job Discovery",

      description:
        "Run a manual vacancy search after your profile and job-source connections are ready.",

      action:
        "Open Jobs",

      destination:
        "/jobs",
    },
  ]

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-3">
        {services.map(
          (service) => (
            <GuidedActionCard
              key={
                service.title
              }
              {...service}
              onClick={() =>
                onOpen(
                  service.destination,
                  {
                    settingsCategory:
                      service.settingsCategory,

                    pageSection:
                      service.pageSection,
                  },
                )
              }
            />
          ),
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm font-medium text-zinc-300">
          Optional services can be skipped safely.
        </p>

        <p className="mt-1 text-xs leading-5 text-zinc-600">
          Manual job tracking, Candidate Profile editing, Resume Library storage and local Assistant analysis continue to work without paid or credential-based job sources or Gmail.
        </p>
      </div>
    </div>
  )
}

function GuidedPageStep({
  icon:
    Icon,
  title,
  description,
  checks,
  action,
  onClick,
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
            <Icon
              size={19}
            />
          </div>

          <div>
            <h3 className="font-semibold text-zinc-200">
              {title}
            </h3>

            <p className="mt-1 text-sm leading-6 text-zinc-500">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {checks.map(
            (check) => (
              <div
                key={
                  check
                }
                className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-3"
              >
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-300"
                />

                <p className="text-xs leading-5 text-zinc-500">
                  {check}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      <aside className="flex flex-col justify-between rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
        <div>
          <p className="text-sm font-semibold text-sky-200">
            Complete this step now
          </p>

          <p className="mt-2 text-xs leading-5 text-zinc-500">
            BreakVeil will close this guide, open the correct page and remember your current setup step.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onClick
          }
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          {action}
          <ExternalLink
            size={16}
          />
        </button>
      </aside>
    </div>
  )
}

function GuidedActionCard({
  icon:
    Icon,
  title,
  description,
  action,
  onClick,
}) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
        <Icon
          size={17}
        />
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
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
      >
        {action}
        <ExternalLink
          size={15}
        />
      </button>
    </article>
  )
}

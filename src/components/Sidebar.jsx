import { useEffect, useState } from "react"

import {
  BarChart3,
  Bot,
  Briefcase,
  CircleUserRound,
  FileText,
  Home,
  Settings,
  Zap,
} from "lucide-react"

import { NavLink } from "react-router-dom"
import BrandMark from "./BrandMark"

const discoveryResultsStorageKey =
  "jobpilot.discovery-results"

const matchInboxDecisionStorageKey =
  "jobpilot.match-inbox-decisions"

const candidateProfileStorageKey =
  "jobpilot.candidate-profile"

function loadCandidateIdentity() {
  try {
    const savedProfile =
      localStorage.getItem(
        candidateProfileStorageKey,
      )

    const profile = savedProfile
      ? JSON.parse(savedProfile)
      : {}

    const displayName = String(
      profile?.preferredName ||
        profile?.fullName ||
        "Your profile",
    ).trim()

    const initials = displayName === "Your profile"
      ? "?"
      : displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()

    const profileLabel = String(
      profile?.currentJobTitle ||
        String(profile?.targetRoles || "")
          .split(/[,;\n]/)[0] ||
        "Candidate Profile",
    ).trim()

    return {
      displayName,
      initials,
      profileLabel,
    }
  } catch {
    return {
      displayName: "Your profile",
      initials: "?",
      profileLabel: "Candidate Profile",
    }
  }
}

function loadNewMatchCount() {
  try {
    const storedResults =
      localStorage.getItem(
        discoveryResultsStorageKey,
      )

    const storedDecisions =
      localStorage.getItem(
        matchInboxDecisionStorageKey,
      )

    const results = storedResults
      ? JSON.parse(storedResults)
      : []

    const decisions = storedDecisions
      ? JSON.parse(storedDecisions)
      : {}

    if (!Array.isArray(results)) {
      return 0
    }

    return results.filter(
      (job) => {
        const key =
          String(
            job?.discoveryFingerprint ||
              job?.discoveryId ||
              job?.id ||
              "",
          ).trim()

        const entry =
          decisions?.[key]

        const status =
          typeof entry === "string"
            ? entry
            : entry?.status

        return !status ||
          status === "new"
      },
    ).length
  } catch {
    return 0
  }
}

export default function Sidebar() {
  const [candidateIdentity, setCandidateIdentity] =
    useState(loadCandidateIdentity)

  const [
    newMatchCount,
    setNewMatchCount,
  ] = useState(
    loadNewMatchCount,
  )

  useEffect(() => {
    function refreshCandidateIdentity(event) {
      if (
        event?.type === "storage" &&
        event.key !== candidateProfileStorageKey
      ) {
        return
      }

      setCandidateIdentity(
        loadCandidateIdentity(),
      )
    }

    window.addEventListener(
      "jobpilot:profile-updated",
      refreshCandidateIdentity,
    )

    window.addEventListener(
      "storage",
      refreshCandidateIdentity,
    )

    window.addEventListener(
      "focus",
      refreshCandidateIdentity,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:profile-updated",
        refreshCandidateIdentity,
      )

      window.removeEventListener(
        "storage",
        refreshCandidateIdentity,
      )

      window.removeEventListener(
        "focus",
        refreshCandidateIdentity,
      )
    }
  }, [])

  useEffect(() => {
    function refreshNewMatchCount() {
      setNewMatchCount(
        loadNewMatchCount(),
      )
    }

    window.addEventListener(
      "jobpilot:discovery-updated",
      refreshNewMatchCount,
    )

    window.addEventListener(
      "jobpilot:match-inbox-updated",
      refreshNewMatchCount,
    )

    window.addEventListener(
      "focus",
      refreshNewMatchCount,
    )

    return () => {
      window.removeEventListener(
        "jobpilot:discovery-updated",
        refreshNewMatchCount,
      )

      window.removeEventListener(
        "jobpilot:match-inbox-updated",
        refreshNewMatchCount,
      )

      window.removeEventListener(
        "focus",
        refreshNewMatchCount,
      )

    }
  }, [])

  const menu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: Home,
    },
    {
      name: "Jobs",
      path: "/jobs",
      icon: Briefcase,
      badge:
        newMatchCount > 0
          ? newMatchCount
          : null,
    },
    {
      name: "Resume Library",
      path: "/resume-library",
      icon: FileText,
    },
    {
      name: "Candidate Profile",
      path: "/profile",
      icon: CircleUserRound,
    },
    {
      name: "AI Assistant",
      path: "/assistant",
      icon: Bot,
    },
    {
      name: "Automation",
      path: "/automation",
      icon: Zap,
    },
    {
      name: "Analytics",
      path: "/analytics",
      icon: BarChart3,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
    },
  ]

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-[#111111] p-4">
      <BrandMark className="mb-8" />

      <nav
        aria-label="Main navigation"
        className="flex-1 space-y-2"
      >
        {menu.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                [
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",

                  isActive
                    ? "jp-nav-active border border-sky-500/20 font-medium"
                    : "border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-800/60 hover:text-white",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-4 h-6 w-1 rounded-r-full bg-sky-400" />
                  )}

                  <Icon size={18} />

                  <span className="min-w-0 flex-1">
                    {item.name}
                  </span>

                  {item.badge && (
                    <span className="jp-tone-matching flex min-w-6 items-center justify-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold">
                      {item.badge > 99
                        ? "99+"
                        : item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="flex min-w-0 items-center gap-3 border-t border-zinc-800 pt-4">
        <div
          aria-hidden="true"
          className="jp-tone-navigation flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-semibold"
        >
          {candidateIdentity.initials}
        </div>

        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium"
            title={candidateIdentity.displayName}
          >
            {candidateIdentity.displayName}
          </p>

          <p
            className="truncate text-xs text-zinc-500"
            title={candidateIdentity.profileLabel}
          >
            {candidateIdentity.profileLabel}
          </p>
        </div>
      </div>
    </aside>
  )
}

import {
  useEffect,
} from "react"

import {
  Navigate,
  useLocation,
} from "react-router-dom"

import {
  loadUiPreferences,
} from "../lib/uiPreferences"

const lastPageStorageKey =
  "jobpilot.last-page"

const allowedLandingPages = {
  dashboard:
    "/dashboard",

  jobs:
    "/jobs",

  assistant:
    "/assistant",

  automation:
    "/automation",
}

function isSafeRememberedPath(
  pathname,
) {
  return [
    "/dashboard",
    "/jobs",
    "/resume-library",
    "/profile",
    "/assistant",
    "/automation",
    "/analytics",
    "/settings",
  ].some(
    (route) =>
      pathname === route ||
      pathname.startsWith(
        `${route}/`,
      ),
  )
}

export function LandingRedirect() {
  const preferences =
    loadUiPreferences()

  let destination =
    allowedLandingPages[
      preferences.defaultLandingPage
    ] ||
    "/dashboard"

  if (
    preferences.rememberLastPage
  ) {
    try {
      const remembered =
        localStorage.getItem(
          lastPageStorageKey,
        )

      if (
        remembered &&
        isSafeRememberedPath(
          remembered,
        )
      ) {
        destination =
          remembered
      }
    } catch {
      // Fall back to the configured landing page.
    }
  }

  return (
    <Navigate
      to={
        destination
      }
      replace
    />
  )
}

export default function NavigationPreferences() {
  const location =
    useLocation()

  useEffect(() => {
    const preferences =
      loadUiPreferences()

    if (
      !preferences.rememberLastPage ||
      location.pathname ===
        "/" ||
      !isSafeRememberedPath(
        location.pathname,
      )
    ) {
      return
    }

    try {
      localStorage.setItem(
        lastPageStorageKey,
        location.pathname,
      )
    } catch {
      // Navigation remains usable if storage is unavailable.
    }
  }, [
    location.pathname,
  ])

  return null
}

import {
  useEffect,
} from "react"

import {
  startUiPreferences,
} from "../lib/uiPreferences"

export default function UiPreferencesBoot() {
  useEffect(
    () =>
      startUiPreferences(),
    [],
  )

  return null
}

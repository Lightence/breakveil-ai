import {
  useEffect,
} from "react"

import {
  collectBreakVeilStorage,
} from "../lib/dataManagement"

const checkIntervalMilliseconds =
  60 * 60 * 1000

export default function DataProtectionRunner() {
  useEffect(() => {
    let cancelled =
      false

    async function runBackupCheck() {
      if (
        cancelled ||
        !window.jobPilot
          ?.dataManagement
          ?.runAutomaticBackup
      ) {
        return
      }

      try {
        await window.jobPilot
          .dataManagement
          .runAutomaticBackup(
            collectBreakVeilStorage(),
          )
      } catch (error) {
        console.warn(
          "Automatic BreakVeil backup did not complete:",
          error,
        )
      }
    }

    const startupTimer =
      window.setTimeout(
        runBackupCheck,
        3500,
      )

    const interval =
      window.setInterval(
        runBackupCheck,
        checkIntervalMilliseconds,
      )

    return () => {
      cancelled =
        true

      window.clearTimeout(
        startupTimer,
      )

      window.clearInterval(
        interval,
      )
    }
  }, [])

  return null
}

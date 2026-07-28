import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  AlertTriangle,
  RefreshCw,
  Settings,
  WifiOff,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import {
  getProviderPresentation,
  loadJobSearchRuntime,
} from "../lib/jobSourceResilience"

function buildInitialState() {
  return {
    browserOnline:
      typeof navigator ===
        "undefined"
        ? true
        : navigator.onLine,

    loading:
      true,

    status:
      null,

    runtime:
      loadJobSearchRuntime(),
  }
}

export default function ConnectivityBanner() {
  const navigate =
    useNavigate()

  const [
    state,
    setState,
  ] = useState(
    buildInitialState,
  )

  async function refreshStatus() {
    setState((current) => ({
      ...current,

      browserOnline:
        navigator.onLine,

      loading:
        true,
    }))

    try {
      const result =
        await window.jobPilot
          ?.jobSources
          ?.getStatus?.()

      setState((current) => ({
        ...current,

        browserOnline:
          navigator.onLine,

        loading:
          false,

        status:
          result?.ok
            ? result
            : current.status,
      }))
    } catch {
      setState((current) => ({
        ...current,

        browserOnline:
          navigator.onLine,

        loading:
          false,
      }))
    }
  }

  useEffect(() => {
    refreshStatus()

    function handleOnlineState() {
      refreshStatus()
    }

    function handleRuntimeUpdate(
      event,
    ) {
      setState((current) => ({
        ...current,

        browserOnline:
          navigator.onLine,

        runtime:
          event.detail ||
          loadJobSearchRuntime(),
      }))

      window.setTimeout(
        refreshStatus,
        80,
      )
    }

    window.addEventListener(
      "online",
      handleOnlineState,
    )

    window.addEventListener(
      "offline",
      handleOnlineState,
    )

    window.addEventListener(
      "focus",
      handleOnlineState,
    )

    window.addEventListener(
      "jobpilot:search-health-updated",
      handleRuntimeUpdate,
    )

    const intervalId =
      window.setInterval(
        refreshStatus,
        60 * 1000,
      )

    return () => {
      window.removeEventListener(
        "online",
        handleOnlineState,
      )

      window.removeEventListener(
        "offline",
        handleOnlineState,
      )

      window.removeEventListener(
        "focus",
        handleOnlineState,
      )

      window.removeEventListener(
        "jobpilot:search-health-updated",
        handleRuntimeUpdate,
      )

      window.clearInterval(
        intervalId,
      )
    }
  }, [])

  const problemSources =
    useMemo(
      () =>
        Object.values(
          state.status
            ?.sources ||
          {},
        )
          .filter(
            (source) =>
              source.configured &&
              source.health &&
              source.health.status !==
                "available",
          )
          .map(
            (source) => ({
              ...source,

              presentation:
                getProviderPresentation({
                  ok:
                    false,

                  failureType:
                    source.health
                      ?.failureType,
                }),
            }),
          ),
      [
        state.status,
      ],
    )

  const offline =
    !state.browserOnline ||
    state.runtime
      ?.networkState ===
      "offline"

  const degraded =
    !offline &&
    problemSources.length >
      0

  if (
    !offline &&
    !degraded
  ) {
    return null
  }

  const cachedResultsAvailable =
    Number(
      state.status
        ?.cacheSummary
        ?.freshCount ||
      0,
    ) +
      Number(
        state.status
          ?.cacheSummary
          ?.staleCount ||
        0,
      ) >
    0

  return (
    <div
      className={[
        "flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6",

        offline
          ? "border-amber-500/20 bg-amber-500/[0.065]"
          : "border-red-500/15 bg-red-500/[0.045]",
      ].join(
        " ",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",

            offline
              ? "jp-tone-warning"
              : "jp-tone-danger",
          ].join(
            " ",
          )}
        >
          {offline ? (
            <WifiOff
              size={16}
            />
          ) : (
            <AlertTriangle
              size={16}
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200">
            {offline
              ? "Job Search Is Offline"
              : "A Job Source Is Unavailable"}
          </p>

          <p className="mt-0.5 text-xs leading-5 text-zinc-500">
            {offline
              ? cachedResultsAvailable
                ? "Saved jobs and local tools still work. Matching cached searches will be shown when available."
                : "Saved jobs and local tools still work. Live vacancy searches will retry when the connection returns."
              : `${problemSources
                  .map(
                    (source) =>
                      `${source.name}: ${source.presentation.label}`,
                  )
                  .join(
                    " • ",
                  )}. Other connected sources can continue returning results.`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={
            refreshStatus
          }
          disabled={
            state.loading
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              state.loading
                ? "animate-spin"
                : ""
            }
          />
          Retry
        </button>

        <button
          type="button"
          onClick={() =>
            navigate(
              "/settings?category=connections&section=settings-search-reliability",
            )
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
        >
          <Settings
            size={14}
          />
          Details
        </button>
      </div>
    </div>
  )
}

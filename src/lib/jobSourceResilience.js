const runtimeStorageKey =
  "jobpilot.job-source-runtime"

export function recordJobSearchResult(
  result,
) {
  const runtime = {
    recordedAt:
      new Date()
        .toISOString(),

    ok:
      Boolean(
        result?.ok,
      ),

    cached:
      Boolean(
        result?.cached,
      ),

    stale:
      Boolean(
        result?.stale,
      ),

    fallback:
      Boolean(
        result?.fallback,
      ),

    partial:
      Boolean(
        result?.partial,
      ),

    networkState:
      String(
        result?.networkState ||
        "",
      ),

    error:
      String(
        result?.error ||
        result?.fallbackReason ||
        "",
      ),

    providers:
      Array.isArray(
        result?.providers,
      )
        ? result.providers
        : [],

    total:
      Number(
        result?.total ||
        0,
      ),

    cacheCreatedAt:
      String(
        result?.cacheCreatedAt ||
        "",
      ),
  }

  try {
    localStorage.setItem(
      runtimeStorageKey,
      JSON.stringify(
        runtime,
      ),
    )
  } catch {
    // Runtime health still updates through the event for this session.
  }

  window.dispatchEvent(
    new CustomEvent(
      "jobpilot:search-health-updated",
      {
        detail:
          runtime,
      },
    ),
  )

  return runtime
}

export function loadJobSearchRuntime() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          runtimeStorageKey,
        ) ||
        "{}",
      )

    return (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed,
      )
        ? parsed
        : {}
    )
  } catch {
    return {}
  }
}

export function getSearchResultPresentation(
  result,
) {
  if (
    result?.networkState ===
      "waiting"
  ) {
    return {
      label:
        result?.stale
          ? "Recent Results"
          : "Sources Resting",

      tone:
        "document",

      message:
        result?.stale
          ? `The sources were contacted very recently, so BreakVeil kept ${Number(result?.total || 0)} recent result${Number(result?.total || 0) === 1 ? "" : "s"} while they rest briefly.`
          : "The selected job sources were contacted very recently or are recovering from an error. BreakVeil will allow another live request when their short waiting period ends.",
    }
  }

  if (
    result?.stale ||
    result?.fallback
  ) {
    return {
      label:
        "Offline Cache",

      tone:
        "warning",

      message:
        `Live providers were unavailable, so BreakVeil kept ${Number(
          result?.total ||
          0,
        )} cached result${Number(result?.total || 0) === 1 ? "" : "s"} from ${formatCacheAge(
          result?.cacheCreatedAt,
        )}.`,
    }
  }

  if (
    result?.partial
  ) {
    return {
      label:
        "Partial Results",

      tone:
        "warning",

      message:
        `Found ${Number(
          result?.total ||
          0,
        )} result${Number(result?.total || 0) === 1 ? "" : "s"} from the provider${Number(result?.successfulProviderCount || 0) === 1 ? "" : "s"} that responded. Failed providers can be retried without affecting these results.`,
    }
  }

  if (
    result?.cached
  ) {
    return {
      label:
        "Fresh Cache",

      tone:
        "document",

      message:
        `Loaded ${Number(
          result?.total ||
          0,
        )} result${Number(result?.total || 0) === 1 ? "" : "s"} from the recent local cache.`,
    }
  }

  return {
    label:
      "Live Results",

    tone:
      "success",

    message:
      `Found ${Number(
        result?.total ||
        0,
      )} live result${Number(result?.total || 0) === 1 ? "" : "s"} across the connected sources.`,
  }
}

export function getProviderPresentation(
  provider,
) {
  if (
    provider?.deferred
  ) {
    return {
      label:
        provider?.failureType === "rate-limit"
          ? "Rate Limit Rest"
          : "Waiting",

      tone:
        "document",
    }
  }

  if (
    provider?.skipped
  ) {
    return {
      label:
        "Skipped",

      tone:
        "document",
    }
  }

  if (
    provider?.ok
  ) {
    return {
      label:
        "Working",

      tone:
        "success",
    }
  }

  const type =
    String(
      provider?.failureType ||
      "",
    )

  if (
    type ===
    "authentication"
  ) {
    return {
      label:
        "Credentials",

      tone:
        "danger",
    }
  }

  if (
    type ===
    "rate-limit"
  ) {
    return {
      label:
        "Rate Limited",

      tone:
        "warning",
    }
  }

  if (
    [
      "network",
      "timeout",
    ].includes(
      type,
    )
  ) {
    return {
      label:
        "Offline",

      tone:
        "warning",
    }
  }

  return {
    label:
      "Unavailable",

    tone:
      "danger",
  }
}

export function getHealthToneClass(
  tone,
) {
  const tones = {
    success:
      "jp-tone-success",

    warning:
      "jp-tone-warning",

    danger:
      "jp-tone-danger",

    document:
      "jp-tone-document",

    automation:
      "jp-tone-automation",

    neutral:
      "jp-tone-neutral",
  }

  return (
    tones[
      tone
    ] ||
    tones.neutral
  )
}

export function formatCacheAge(
  value,
) {
  const timestamp =
    new Date(
      value ||
      0,
    ).getTime()

  if (
    !Number.isFinite(
      timestamp,
    ) ||
    timestamp <=
      0
  ) {
    return "an earlier search"
  }

  const difference =
    Math.max(
      0,
      Date.now() -
      timestamp,
    )

  const minutes =
    Math.floor(
      difference /
      60000,
    )

  if (
    minutes <
    1
  ) {
    return "less than a minute ago"
  }

  if (
    minutes <
    60
  ) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  }

  const hours =
    Math.floor(
      minutes /
      60,
    )

  if (
    hours <
    24
  ) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
  }

  const days =
    Math.floor(
      hours /
      24,
    )

  return `${days} day${days === 1 ? "" : "s"} ago`
}

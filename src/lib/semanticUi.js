const jobStatusClasses = {
  Saved:
    "jp-status-saved",

  Applied:
    "jp-status-applied",

  Interview:
    "jp-status-interview",

  Offer:
    "jp-status-offer",

  Rejected:
    "jp-status-rejected",
}

const packageStatusClasses = {
  Draft:
    "jp-package-draft",

  "Ready for Review":
    "jp-package-ready",

  Approved:
    "jp-package-approved",

  Sent:
    "jp-package-sent",
}

const pipelineClasses = {
  Saved:
    "jp-pipeline-saved",

  Applied:
    "jp-pipeline-applied",

  Interview:
    "jp-pipeline-interview",

  Offer:
    "jp-pipeline-offer",

  Rejected:
    "jp-pipeline-rejected",
}

const commandGroupClasses = {
  Pages:
    "jp-tone-navigation",

  Functions:
    "jp-tone-automation",

  Settings:
    "jp-tone-navigation",

  "Data and Privacy":
    "jp-tone-document",

  "Tracked Jobs":
    "jp-tone-matching",

  "Quick Access":
    "jp-tone-navigation",
}

export function getJobStatusClass(
  status,
) {
  return (
    jobStatusClasses[
      status
    ] ||
    jobStatusClasses.Saved
  )
}

export function getPackageStatusClass(
  status,
) {
  return (
    packageStatusClasses[
      status
    ] ||
    packageStatusClasses.Draft
  )
}

export function getPipelineBarClass(
  status,
) {
  return [
    "h-full rounded-full transition-all duration-500",

    pipelineClasses[
      status
    ] ||
      pipelineClasses.Saved,
  ].join(
    " ",
  )
}

export function getMatchScoreClass(
  score,
  excludedRole =
    false,
  thresholds = {},
) {
  if (
    excludedRole
  ) {
    return "jp-match-excluded"
  }

  const strong =
    Number(
      thresholds.strong ??
        85,
    )

  const good =
    Number(
      thresholds.good ??
        70,
    )

  const possible =
    Number(
      thresholds.possible ??
        50,
    )

  const safeScore =
    Number(
      score,
    ) ||
    0

  if (
    safeScore >=
    strong
  ) {
    return "jp-match-strong"
  }

  if (
    safeScore >=
    good
  ) {
    return "jp-match-good"
  }

  if (
    safeScore >=
    possible
  ) {
    return "jp-match-possible"
  }

  return "jp-match-low"
}

export function getCommandGroupToneClass(
  group,
) {
  return (
    commandGroupClasses[
      group
    ] ||
    "jp-tone-neutral"
  )
}

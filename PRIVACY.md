# BreakVeil Privacy Notes

This document describes the behaviour of the open-source BreakVeil desktop application. It is not a privacy policy for Google, vacancy providers, external websites or modified third-party builds.

## Local workspace data

BreakVeil stores the following information on the user's Windows computer:

- Candidate profile details and preferences.
- Saved vacancies, application stages and activity history.
- Resume Library documents and application packages.
- Assistant drafts, vacancy comparisons and preparation checklists.
- Interface, automation and backup preferences.
- Local records of Gmail draft and sending activity.

The application provides controls under **Settings → Data & Privacy** for inspecting the local storage folder, creating backups, exporting readable data and clearing selected records.

## Connected services

BreakVeil sends information to a third party only when the user invokes or configures the related feature:

- **Vacancy providers:** search terms, location and filters are sent to enabled vacancy APIs or public feeds. Results are returned to the local workspace.
- **Gmail:** Google OAuth is used to create drafts and, only after an explicit action or configured controlled queue, send messages. BreakVeil requests compose/send functionality and does not request inbox-reading access.
- **Company research:** a company name, number or website may be sent to an enabled public or user-configured research source.
- **External websites:** selecting an original listing or external resource opens that address in the user's normal browser.

Each connected provider has its own terms and privacy practices.

## Credentials

- Reed, Adzuna and Jooble credentials are stored locally using Windows protected storage.
- Imported Google OAuth client credentials are encrypted locally using Windows protected storage.
- A Gmail OAuth token is stored locally until Gmail is disconnected.
- The source repository contains only a blank Google credentials example. Development credentials must remain in the ignored `electron/google/credentials.json` file.
- Credentials and OAuth tokens are excluded from BreakVeil's readable exports and application backups.

## Backups

Backup files can contain personal job-search information and Resume Library documents. They are compressed but are not password-encrypted. Users should keep them in a trusted location and delete copies they no longer need.

## Developer telemetry

The current BreakVeil build does not send anonymous usage analytics, advertising identifiers or crash reports to a service operated by the BreakVeil maintainers.

## Modified builds

Anyone can inspect and modify BreakVeil under the GPL. A modified build can behave differently. Users should obtain releases from the project's documented release channel or build the reviewed source themselves.

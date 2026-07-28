# BreakVeil AI

![BreakVeil AI icon](electron/assets/breakveil-icon.png)

BreakVeil AI is a private Windows desktop workspace for discovering jobs, preparing applications and tracking progress. It is designed to keep the candidate in control: searches, role matching, application material and automation are review-first, and personal workspace data is stored locally.
BreakVeil AI was coded and completed entirely by Open AI's ChatGPT.

**Source:** [github.com/Lightence/breakveil-ai](https://github.com/Lightence/breakveil-ai)

> BreakVeil is currently an early community release. Review the source, run it locally and report anything that does not behave as described.

## What BreakVeil does

- Searches supported vacancy sources from one place.
- Maintains a reusable candidate profile and Resume Library.
- Compares vacancies with the local profile.
- Tracks saved roles, applications, interviews and outcomes.
- Prepares reviewable application material and Gmail drafts.
- Provides controlled automation with sending limits and an emergency stop.
- Creates local backups and readable data exports.
- Includes light, dark and midnight themes plus keyboard and screen-reader support.

## Privacy at a glance

BreakVeil does not include developer analytics, advertising tracking or a developer-hosted account service. Jobs, profile details, application packages, drafts, preferences and activity history remain in BreakVeil's local application storage.

Information leaves the computer only when a user invokes or configures a connected feature, such as searching a vacancy provider, researching a company, connecting Gmail, creating or sending a Gmail draft, or opening an external website. See [PRIVACY.md](PRIVACY.md) for the detailed data map.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- Node.js 22 LTS or newer.
- npm.

## Run from source

1. Download or clone the repository.
2. Open PowerShell in the project folder.
3. Install the dependencies:

   ```powershell
   npm.cmd install
   ```

4. Start the desktop application:

   ```powershell
   npm.cmd run desktop
   ```

The first command may take a few minutes. BreakVeil opens automatically after the local interface is ready.

## Optional Google/Gmail setup

BreakVeil does not publish shared Google credentials. Each developer or distributor must create their own Google OAuth desktop client.

1. Enable the Gmail API in a Google Cloud project.
2. Configure the OAuth consent screen and add any required test users.
3. Create an OAuth client with the application type **Desktop app**.
4. Copy `electron/google/credentials.example.json` to `electron/google/credentials.json`.
5. Replace the placeholder values in the copied file with your own client values.

The real `credentials.json` file is deliberately ignored by Git and must never be committed. Gmail is optional; the rest of BreakVeil can be used without it.

Vacancy-provider credentials for Reed, Adzuna and Jooble are entered inside **Settings → Connections**. BreakVeil stores them using Windows protected storage.

## Check a change

Run these commands before submitting a contribution:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The lint command currently reports a small set of documented React compiler warnings but must finish with no errors.

## Create an unsigned Windows installer

```powershell
npm.cmd run package:win
```

Unsigned installers may trigger Windows SmartScreen warnings. Public releases should be produced by the project's documented signing process; see [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md).

## Contributing and security

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) when participating.
- Report security problems using [SECURITY.md](SECURITY.md), not a public issue containing exploit details or credentials.

## Licence

BreakVeil AI is free software licensed under the [GNU General Public License version 3](LICENSE), using the SPDX identifier `GPL-3.0-only`.

You may run, study, modify and redistribute the program under that licence. If you distribute a modified version, the GPL requires you to provide the corresponding source under the same licence. Third-party packages and assets remain subject to their own licence notices.

Copyright © 2026 BreakVeil contributors.

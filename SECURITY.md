# BreakVeil Security Policy

## Supported version

BreakVeil is currently an early community release. Security fixes are applied to the latest source and latest published release only.

## Report a vulnerability privately

Do not place passwords, tokens, personal information or working exploit instructions in a public issue.

Use GitHub's **Report a vulnerability** option to open a [private security advisory](https://github.com/Lightence/breakveil-ai/security/advisories/new). If that option is unavailable, open a public issue containing only a request for private contact and a short, non-sensitive summary.

Include, where safe:

- The affected version or commit.
- The area of the application involved.
- Reproduction steps without real credentials or personal data.
- The possible impact.
- Any suggested mitigation.

## Credential exposure

If a credential is accidentally published, revoke or rotate it immediately. Removing the visible file is not sufficient because the value may remain in repository history.

## Security expectations

- Real Google OAuth credentials must stay in the ignored `electron/google/credentials.json` file.
- API keys, OAuth tokens, signing credentials and certificate passwords must never be committed.
- External navigation must remain restricted to explicitly supported safe protocols.
- Electron must keep context isolation and sandboxing enabled and Node integration disabled for renderer windows.
- Sending automation must preserve user controls, limits, confirmation and emergency-stop behaviour.

Good-faith reports that protect users are welcome. Please allow maintainers reasonable time to investigate before public disclosure.

## Current dependency-audit note

As of 28 July 2026, `npm audit --omit=dev` reports the React Router advisory `GHSA-qwww-vcr4-c8h2`. The advisory concerns React Server Components action handling. BreakVeil is an Electron client using `HashRouter`; it does not run React Server Components, server actions or a React Router server runtime, so the affected feature is not present in BreakVeil. The dependency remains on the latest compatible release and will be updated when an upstream patched release is available.

Do not use `npm audit fix --force` to hide this report by downgrading React Router. Any dependency change must pass the full test and build checks.

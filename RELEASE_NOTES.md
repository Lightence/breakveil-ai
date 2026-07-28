# BreakVeil AI v0.4.4

This early-access update makes custom Windows installation folders reliable and recoverable.

## Included

- Local-first job discovery, tracking and application preparation.
- Candidate profile, Resume Library and local vacancy matching.
- Review-first application and sending controls.
- Analytics, backups, themes and accessibility support.
- GPL v3 source code and public release checks.
- Secure Google OAuth credentials import for installed Windows builds.
- An elevated all-users installer that can write to a user-selected local folder instead of requiring an AppData location.
- Recovery from incomplete installation registrations whose app and uninstaller files were never created.

## Important early-release notes

- This installer is **unsigned**, so Windows SmartScreen may show a warning. The project is applying for free open-source signing through SignPath Foundation.
- The public installer contains no shared Google OAuth credentials. Users can import their own Google OAuth Desktop app JSON file from **Automation**; BreakVeil encrypts it locally with Windows protected storage.
- BreakVeil is an early community release. Keep a backup of important application records and report problems through GitHub Issues.

The attached `SHA256SUMS.txt` file can be used to verify that the installer has not changed after publication.

## Code signing policy

Official binaries follow the BreakVeil [Code signing policy](https://github.com/Lightence/breakveil-ai/blob/main/CODE_SIGNING_POLICY.md) and [privacy policy](https://github.com/Lightence/breakveil-ai/blob/main/PRIVACY.md).

**Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).**

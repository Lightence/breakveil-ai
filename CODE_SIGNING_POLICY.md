# BreakVeil Code Signing Policy

This policy describes the intended release controls for official BreakVeil binaries.

## Purpose

Code signing links a release artifact to a reviewed source revision and helps users detect tampering. A signature does not replace source review, automated checks or safe application design.

## Signing service

BreakVeil intends to apply for the SignPath Foundation open-source programme after the public repository and first release are available.

Once the project is accepted, release pages will use the required attribution: **Free code signing provided by SignPath.io, certificate by SignPath Foundation.** Until approval is complete, release artifacts must be clearly marked as unsigned.

## Roles

- **Committers:** [Lightence](https://github.com/Lightence) and future maintainers explicitly granted write access.
- **Reviewers:** Lightence and future maintainers who assess correctness, privacy, security, accessibility and licence compliance.
- **Approvers:** Lightence, as repository owner, or an explicitly delegated release maintainer.

A contributor must not approve their own security-sensitive release change without another maintainer's review when another maintainer is available.

## Release requirements

An official signing request must:

1. Refer to a versioned revision in the public BreakVeil repository.
2. Be built from the corresponding public source and committed build scripts.
3. Pass the automated test suite, lint check and production build.
4. Contain no private credentials, user data or locally generated configuration.
5. Be approved by an authorised signing approver.
6. Produce hashes and release notes alongside the signed artifacts.

Only BreakVeil application binaries and installers built from the project's source may be signed. Dependencies must come from the locked package manifest and normal package registry process.

## Privacy

BreakVeil does not transfer information to networked systems unless the user requests or configures the relevant connected feature. The specific connected services and local storage behaviour are documented in [PRIVACY.md](PRIVACY.md).

## Compromise or misuse

If signing access, a release account or an artifact is suspected of compromise, maintainers will pause signing, remove the affected release, rotate relevant credentials, notify the signing provider and users, and request certificate revocation when appropriate.

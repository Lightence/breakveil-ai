# Contributing to BreakVeil

Thank you for helping improve BreakVeil. Contributions that make the application safer, clearer, more accessible or more useful to job seekers are welcome.

## Before starting

- Search [existing issues](https://github.com/Lightence/breakveil-ai/issues) before opening a new one.
- Keep a change focused on one problem.
- Discuss large behavioural or architectural changes before investing substantial time.
- Never include real CVs, job-search records, email addresses, API keys, OAuth files or other personal data.

## Local development

Use Windows with Node.js 22 LTS or newer.

```powershell
npm.cmd install
npm.cmd run desktop
```

The React interface is in `src/`. Electron main-process and preload code is in `electron/`. Automated checks are in `tests/`.

## Required checks

Before proposing a change, run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Add or update a regression test when changing behaviour. Test keyboard use and all supported themes when changing interface code. Do not remove existing accessibility features.

## Pull requests

A useful pull request:

- Explains the user problem and the chosen solution.
- Lists the checks that were run.
- Includes screenshots for visible interface changes.
- Avoids unrelated formatting or generated files.
- Preserves local-first privacy and review-first automation safeguards.

Maintainers may request changes before merging. Security-sensitive changes require explicit maintainer review.

## Licence of contributions

By submitting a contribution, you agree to license it under GNU GPL version 3 only (`GPL-3.0-only`), the same licence as BreakVeil. You must have the right to submit the code, text or assets you contribute.

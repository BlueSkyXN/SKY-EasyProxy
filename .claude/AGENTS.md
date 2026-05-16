# .claude navigation card

This directory contains local Claude-related settings for the repository. It is not part of the Chrome extension runtime.

Read this card before editing `.claude/settings.local.json` or adding/removing assistant configuration under `.claude/`.
Key file: `.claude/settings.local.json`.

## Why this is high-risk

- Local permission settings can change what assistant tooling may execute in this repository.
- The file may be machine-specific and should not be generalized into product behavior.
- Extension manual tests do not validate assistant permission configuration.

## Required before changes

- Confirm the user asked for a Claude/local-assistant configuration change.
- Preserve existing permissions unless the request specifically changes them.
- Keep local-only settings separate from repository runtime behavior.
- Review the resulting diff for accidental secrets, personal paths, or over-broad permissions.

## Do not

- Do not modify `.claude/` while implementing normal Chrome extension features.
- Do not copy credentials, tokens, or private proxy endpoints into assistant settings.
- Do not remove existing local permissions without a direct request.
- Do not treat `.claude/` as a source directory for the extension.

## Validation

There is no project-level automated validation for `.claude/` changes. After edits, inspect the diff and confirm only intended local assistant settings changed. Chrome extension manual testing is not required unless extension runtime files also changed.

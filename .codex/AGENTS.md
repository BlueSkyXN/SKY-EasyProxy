# .codex navigation card

This directory is the repository-local Codex configuration area. It may contain agent definitions, skill definitions, symlinks, or runtime mounting points that affect future Codex behavior in this repository.

Read this card before modifying `.codex/agents`, `.codex/skills`, symlinks, or any file that changes which Codex instructions/tools are active for this repo.
Key paths: `.codex/agents/`, `.codex/skills/`.

## Why this is high-risk

- Changes here can alter how future Codex sessions interpret or execute repository tasks.
- Broken symlinks or copied runtime assets can make local agent/skill loading confusing.
- These files are configuration for tools, not extension runtime files; extension validation will not catch mistakes here.

## Required before changes

- Confirm the requested change is about Codex behavior, not Chrome extension behavior.
- Inspect the target path and distinguish between real files, empty mount directories, and symlinks before editing.
- Keep changes narrow: prefer adding or updating the specific agent/skill file requested instead of reorganizing the whole directory.
- If replacing a local agent or skill with content from another repository, state the source path in the final summary.

## Do not

- Do not store API keys, tokens, proxy credentials, or private machine paths here.
- Do not delete `.codex/agents/` or `.codex/skills/` just because they are empty.
- Do not rewrite the user's global Codex home from this repository card.
- Do not vendor large external skill suites into this repository without explicit user approval.

## Validation

There is no project-level automated validation for `.codex/` changes. After edits, inspect the diff and confirm only intended Codex configuration files changed. Chrome extension manual testing is not required unless extension runtime files also changed.

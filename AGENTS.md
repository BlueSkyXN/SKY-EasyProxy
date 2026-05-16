# SKY-EasyProxy agent instructions

## Purpose

SKY-EasyProxy is a small Chrome Manifest V3 extension for managing proxy profiles from a popup UI. It stores profiles locally with Chrome Storage, applies proxy settings through Chrome Proxy API, and tests connectivity through the background service worker.

## Codex startup behavior

- Codex is normally started from the repository root.
- This file is the root router: it contains the default project rules, directory map, command index, and validation checklist.
- Subdirectory `AGENTS.md` files are navigation cards. They are not automatically in context when Codex starts from the root, so the directory map below tells future agents when to read them.
- Before editing any directory marked `Yes` in the `Local AGENTS.md` column, run `cat <path>/AGENTS.md` and apply that file's local rules.
- If multiple nested `AGENTS.md` files exist on the path to a target file, read them from shallow to deep before changing files.
- If an `AGENTS.override.md` appears in a target directory later, stop and ask the user before editing the ordinary `AGENTS.md` in that same directory, because override files replace normal instructions.

## Directory map

| Path | Responsibility | Local AGENTS.md | Read when |
|---|---|---:|---|
| `manifest.json` | Chrome MV3 manifest: extension metadata, permissions, popup entry, background service worker | No | Root rules apply |
| `index.html` | Popup document and all popup CSS; loads `proxy.js` as a module | No | Root rules apply |
| `proxy.js` | Popup UI behavior, profile CRUD, input validation, storage state, proxy activation, bypass rule validation, proxy test flow | No | Root rules apply |
| `background.js` | MV3 service worker; receives runtime messages, applies Chrome proxy settings, performs connectivity fetch | No | Root rules apply |
| `README.md` | Human-facing install, usage, feature, and FAQ documentation | No | Root rules apply |
| `LICENSE` | GPL license text | No | Usually do not edit |
| `.codex/` | Repository-local Codex agent/skill mounting area | Yes | Before changing `.codex/agents`, `.codex/skills`, symlinks, or Codex runtime assets |
| `.claude/` | Local Claude settings area, currently including `settings.local.json` | Yes | Before changing local tool permissions, settings, or hidden assistant config |

There are no `src/`, `test/`, `docs/`, `packages/`, `apps/`, `services/`, build output, migration, or generated-code directories in this repository. The extension's runtime files live at the repository root, so root rules are intentionally detailed enough for normal code changes.

## On-demand cat protocol

Before editing files under a directory that has a local `AGENTS.md`, read that local file first:

```bash
cat .codex/AGENTS.md
cat .claude/AGENTS.md
```

Use only the relevant command for the target directory. Do not read hidden config recursively unless the task requires it. These local cards are guardrails, not replacements for this root router.

## Actual project commands and workflows

This repository has no package manager, build system, lockfile, Makefile, CI workflow, or automated test command. Do not invent `npm`, `pnpm`, `yarn`, `pytest`, `make`, or bundler commands unless a future commit adds the corresponding configuration.

| Workflow | Purpose | Scope | Sandbox notes |
|---|---|---|---|
| Open `chrome://extensions/`, enable Developer Mode, choose "Load unpacked", select this repository | Load the extension for manual testing | Whole extension | Requires interactive Chrome UI; not available in a non-browser sandbox |
| Click "Reload" for the unpacked extension after changes | Re-run updated extension code | Whole extension | Requires interactive Chrome UI |
| Add, edit, delete proxy profiles in the popup | Validate popup state, form handling, storage, and list rendering | `index.html`, `proxy.js` | Requires Chrome extension runtime |
| Toggle the global proxy switch | Validate `chrome.proxy.settings.set` integration | `proxy.js`, `background.js`, `manifest.json` | Requires Chrome extension runtime and `proxy` permission |
| Click "Test" on a proxy profile | Validate temporary proxy application, background fetch, and restoration flow | `proxy.js`, `background.js` | Requires network access; uses `https://api.ipify.org?format=json` |
| Exercise bypass templates and custom bypass rules | Validate IPv4, IPv6, CIDR, wildcard domain parsing, and UI feedback | `proxy.js`, `index.html` | Requires popup UI |

If a future change adds a real build or test command, update this section in the same change. Until then, validation is manual and browser-based.

## Global implementation rules

- Keep the extension vanilla: no bundler, framework, package manager, transpiler, or dependency file unless the user explicitly asks for that larger change.
- Keep the flat root layout unless there is a concrete reason to introduce `src/` or another structure. If a structural move is needed, update `manifest.json`, `README.md`, and this file together.
- Use 2-space indentation in JavaScript and HTML/CSS.
- Use `camelCase` for variables and functions, and `PascalCase` for classes such as `SKYProxy`.
- Prefer single quotes in JavaScript string literals. Preserve existing double quotes where a surrounding template literal, JSON, or HTML attribute makes that clearer.
- Keep popup markup and styles in `index.html`; keep popup behavior and state in `proxy.js`; keep service-worker message handling and network/proxy operations in `background.js`.
- Avoid broad rewrites. This project is small enough that targeted fixes are easier to review than architectural churn.
- Keep comments short and useful. Existing comments are mostly Chinese; new comments may be Chinese when they explain non-obvious behavior.

## Chrome extension invariants

- `manifest.json` must remain Manifest V3 (`"manifest_version": 3`).
- `manifest.json` must keep `action.default_popup` aligned with the actual popup HTML path.
- `manifest.json` must keep `background.service_worker` aligned with the actual background script path.
- `proxy` permission is required for `chrome.proxy.settings.set`; do not remove it while proxy control remains a feature.
- `storage` permission is required for `chrome.storage.local`; do not remove it while profiles or active profile state are stored.
- `host_permissions` currently uses `<all_urls>` so the background test fetch can run broadly. If narrowing it, manually test the proxy test flow and document the changed behavior.
- MV3 service workers are event-driven. Do not assume persistent background state in `background.js`; keep durable state in `chrome.storage.local` or the popup when appropriate.

## Popup and state rules

- `SKYProxy` owns popup UI state: `profiles`, `activeProfile`, `editingIndex`, and `isTesting`.
- Stored profile data must pass through `sanitizeProfile` / validation before use. Do not render untrusted stored values directly into HTML without escaping.
- Keep `escapeHtml` protection on any value inserted into `innerHTML`, including names, schemes, status text derived from input, and bypass rules.
- `activeProfile` is an index into `profiles`. When adding deletion or reordering behavior, keep the index synchronized with `activeProfileId` in Chrome Storage.
- Use `setActiveProfile` when changing the active profile so memory state and storage state remain consistent.
- The global switch should reflect whether a profile is active. If no valid profile exists, it should not stay enabled.
- Deleting the active profile must disable proxy settings or otherwise leave Chrome in a deliberate, visible state.

## Proxy behavior rules

- Profile configs must keep Chrome's expected fixed-server shape:

```js
{
  mode: 'fixed_servers',
  rules: {
    singleProxy: {
      scheme: 'http' | 'https' | 'socks4' | 'socks5',
      host: 'example.com',
      port: 1080
    },
    bypassList: []
  }
}
```

- `validateScheme`, `validateHost`, `validatePort`, and bypass validation are part of the security boundary. Do not loosen them without an explicit reason and manual test coverage.
- IPv6 input may be bracketed for users, but Chrome proxy config should receive the sanitized host value expected by the existing code.
- Bypass rules currently support IPv4, IPv6, CIDR, and wildcard domains. If adding formats, update validation, UI display type, README examples, and manual test notes.
- `testProfile` temporarily applies a profile, calls the background `TEST_PROXY` flow, then restores the original proxy settings. Preserve this restoration behavior on success and failure.
- `isTesting` prevents concurrent proxy tests. Keep equivalent concurrency protection if the flow is refactored.
- Disabling proxy currently applies `{ mode: 'direct' }`. Do not replace that with an empty or ambiguous config without verifying Chrome behavior.

## Background service worker rules

- Keep the message contract between `proxy.js` and `background.js` explicit:
  - `SET_PROXY` receives a Chrome proxy config and returns `{ success: true }` or `{ success: false, error }`.
  - `TEST_PROXY` performs a fetch to `https://api.ipify.org?format=json` and returns `{ success: true, ip }` or `{ success: false, error }`.
- When adding message types, update both sender and listener in the same change.
- Keep `return true` for asynchronous `sendResponse` flows in `chrome.runtime.onMessage.addListener`.
- Handle thrown errors and surface concise user-facing status messages in the popup.
- Do not put popup DOM logic in `background.js`; the service worker has no DOM.

## UI rules

- Keep the popup compact: the body is currently `480px` by `600px`, with scrollable content where needed.
- Avoid adding landing-page or marketing-style UI inside the extension popup. The popup should remain a direct tool for managing profiles.
- Do not add visible instructional walls of text to the popup. Put detailed instructions in `README.md`; use labels, placeholder text, and concise status messages in the UI.
- Preserve modal behavior for adding and editing profiles, including `Escape` closing.
- Ensure long profile names, hosts, and bypass rules cannot break layout or inject HTML.
- If changing CSS, verify the popup at its fixed size and at the existing responsive breakpoint.

## Documentation rules

- Update `README.md` when user-visible behavior changes: supported proxy schemes, bypass formats, installation steps, permissions, security behavior, or testing behavior.
- Keep `README.md` human-facing. Do not move agent-only operational rules from this file into the README.
- If `manifest.json` permissions or host permissions change, call that out in any PR/release notes.

## Do not

- Do not add or modify non-AGENTS files when the task is only to organize agent instructions.
- Do not add a package manager, dependency, build step, transpiler, or generated output unless the user explicitly asks for it.
- Do not commit personal proxy endpoints, credentials, tokens, or private network details. For quick local testing, keep such values local and do not bake them into committed defaults.
- Do not remove input validation or HTML escaping as a shortcut.
- Do not make `background.js` depend on popup globals or DOM APIs.
- Do not silently change Chrome permissions in `manifest.json`; permission changes are user-visible and must be tested manually.
- Do not leave Chrome proxy settings in a temporary test state after a failed test flow.
- Do not edit `LICENSE` unless the task is explicitly about licensing.

## Validation

Because there is no automated test/build system, use the smallest relevant manual checklist after code changes:

1. Load the repository as an unpacked extension in Chrome.
2. Reload the extension after every code change.
3. Open the popup and verify it renders without console errors.
4. Add a proxy profile with a valid host and port.
5. Edit that profile and confirm values persist.
6. Delete a profile and confirm active state does not point to a stale index.
7. Toggle the global proxy switch on and off.
8. Run "Test" on a profile and confirm the original proxy settings are restored afterward. This requires network access to `api.ipify.org`.
9. Check bypass templates (`Basic`, `Development`, `China`) and custom IPv4, IPv6, CIDR, and wildcard-domain rules.
10. If `manifest.json` changed, reload the unpacked extension and verify Chrome accepts the manifest.

For docs-only or AGENTS-only changes, browser validation is not required. Inspect the diff and confirm only the intended documentation files changed.

## Commit and PR notes

- The visible commit history uses short version-number commits such as `0.2.2`, `0.2.1`, and `0.2.0` for releases.
- For release commits, follow the existing version-number pattern if the user asks to commit.
- For normal work, use a short descriptive commit message only when the user asks for a commit.
- PR notes should include a concise summary, manual test steps and result, screenshots or GIFs for UI changes, and explicit mention of any `manifest.json` change.

## Notes for future agents

- The repository is intentionally small. Read the whole relevant file before changing behavior; guessing from partial snippets is unnecessary here.
- `proxy.js` is the primary risk area because it combines validation, storage, UI rendering, proxy activation, and temporary test state.
- `background.js` is small but high-impact because it directly applies Chrome proxy settings.
- Hidden assistant configuration directories are covered by local guardrail cards. Read them before changing those directories.

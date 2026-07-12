# Changelog

## 1.0.7

- Resolved all npm advisories reported through the GitHub Dependabot dependency graph.
- Upgraded Electron, electron-builder, Vite, Vitest, and their vulnerable transitive dependencies.
- Added a restrictive Content Security Policy and denied unused browser permissions and webviews.
- Restricted external navigation to trusted HTTPS GitHub links while preserving the Electron sandbox.

## 1.0.6

- Fixed long console histories scrolling the entire application shell and pushing navigation off-screen.
- Locked the sidebar and top-level layout to the desktop viewport.
- Made Console output the only scrolling region on the Console page.
- Preserved an admin's scroll position when reviewing older entries while continuing to auto-follow at the bottom.

## 1.0.5

- Added persisted, per-server RCON automations with intervals from 1 minute to 7 days.
- Added enable/disable, Run Now, edit, deletion, next-run, last-run, and result controls.
- Automation timers exist only while PalRCON is open; missed closed-app runs are skipped.
- Added single-instance enforcement to prevent duplicate schedulers.
- Routed automation responses through Console and the structured `Info`/`ShowPlayers` parsers.
- Added explicit confirmation for destructive enabled automations.

## 1.0.4

- Added command history navigation, autocomplete, favorites, copy controls, and console-log export.
- Added structured Overview and Players snapshots for manually executed `Info` and `ShowPlayers` commands.
- Added credential-safe DNS, TCP, RCON authentication, REST, and packet diagnostics.
- Added password-free profile import/export and clearer credential-recovery states.
- Added manual and opt-in startup update checks using GitHub Releases.
- Added a PalRCON application icon, Windows version metadata, and automated SHA-256 release checksums.
- Preserved the manual-only RCON guarantee and zero background command polling.

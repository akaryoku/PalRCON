# PalRCON

PalRCON is a local Windows desktop administration client for Palworld dedicated servers. It connects directly from the desktop app to the server; it has no web service, cloud component, analytics, or telemetry.

## Connection behavior

- **RCON is manual-only.** PalRCON sends an RCON command only after an administrator enters it in **Console** and selects **Run** (or presses Enter).
- **Connection testing does not execute a command.** It performs the RCON authentication handshake and closes the socket.
- **No automatic polling.** The app does not query a server at startup and has no background refresh timer.
- **Dashboard data is REST-only.** When REST is enabled, **Load REST data** performs read-only requests for server info, players, metrics, and settings.
- **No hidden fallback.** A failed REST request never falls back to an RCON command.

## Features

- Multiple encrypted local server profiles
- Source RCON console with response history and command reference
- Optional Palworld REST dashboard, metrics, player list, and settings
- REST-backed announcements, saves, and moderation actions
- Confirmation prompts for destructive operations
- Explicit connection errors and timeout cleanup

Passwords are encrypted through Electron `safeStorage`, which uses Windows data protection. If a Windows account, executable identity, or portable-build context changes and an older password can no longer be decrypted, PalRCON preserves the server metadata and asks for the password again.

## Development

Codex/ChatGPT was used to create this project, this project was 100% AI-assisted as it was merely a fun project for myself to see if I could get it working for my own server. Project includes no paid feature or cloud hosted connections and purely ran locally.

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Verification:

```powershell
npm run typecheck
npm test
npm run build
```

Create Windows installer and portable builds:

```powershell
npm run package
```

Artifacts are written to `release/` as separate setup and portable executables.

## Palworld server configuration

Set `AdminPassword` and enable RCON in `PalWorldSettings.ini`. The optional dashboard requires `RESTAPIEnabled=True` and a matching `RESTAPIPort`. Pocketpair recommends restricting both administrative interfaces with appropriate firewall rules and avoiding direct public exposure where possible.

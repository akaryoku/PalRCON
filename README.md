# PalRCON

PalRCON is a local Windows desktop administration client for Palworld dedicated servers. It connects directly from the desktop app to the server; it has no web service, cloud component, analytics, or telemetry.

<img width="336" height="213" alt="image" src="https://github.com/user-attachments/assets/4ae691f4-c6e0-42b5-8dc9-fc43f71fce2c" />
<img width="336" height="213" alt="image" src="https://github.com/user-attachments/assets/8e8615b5-d28f-486a-b9ee-77275197c8e9" />
<img width="336" height="213" alt="Screenshot 2026-07-11 173522" src="https://github.com/user-attachments/assets/d292166e-ba15-4049-b6e9-893d8932e8ee" />



## Connection behavior

- **RCON is explicit-only.** PalRCON sends commands from **Console**, or from automations an administrator has deliberately created and enabled.
- **Connection testing does not execute a command.** It performs the RCON authentication handshake and closes the socket.
- **No unconfigured polling.** The app does not query a server at startup. Only enabled automations create recurring RCON timers, and only while PalRCON is open.
- **Dashboard data is REST-only.** When REST is enabled, **Load REST data** performs read-only requests for server info, players, metrics, and settings.
- **No hidden fallback.** A failed REST request never falls back to an RCON command.

## Features

- Multiple encrypted local server profiles
- Source RCON console with response history and command reference
- Command autocomplete, arrow-key history, favorites, copy controls, and log export
- In-app RCON automations with bounded intervals, enable/disable controls, Run Now, and last/next-run status
- Structured `Info` and `ShowPlayers` views generated from manually submitted commands
- Credential-safe DNS, TCP, RCON authentication, REST, and packet diagnostics
- Password-free profile import and export
- Optional Palworld REST dashboard, metrics, player list, and settings
- REST-backed announcements, saves, and moderation actions
- Confirmation prompts for destructive operations
- Explicit connection errors and timeout cleanup
- Manual and opt-in startup update checks against GitHub Releases

Passwords are encrypted through Electron `safeStorage`, which uses Windows data protection. If a Windows account, executable identity, or portable-build context changes and an older password can no longer be decrypted, PalRCON preserves the server metadata and asks for the password again.

The update checker is disabled at startup by default. A manual check, or an explicitly enabled startup check, makes one read-only request to the public `akaryoku/PalRCON` GitHub Releases API. PalRCON never downloads or installs an update automatically.

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

Artifacts are written to `release/` as separate setup and portable executables. Packaging also generates the application icon, applies Windows version metadata, and writes `SHA256SUMS.txt` for the current release files.

Every delivered change increments the patch version (`1.0.5`, `1.0.6`, and so on).

## Palworld server configuration

Set `AdminPassword` and enable RCON in `PalWorldSettings.ini`. The optional dashboard requires `RESTAPIEnabled=True` and a matching `RESTAPIPort`. Pocketpair recommends restricting both administrative interfaces with appropriate firewall rules and avoiding direct public exposure where possible.

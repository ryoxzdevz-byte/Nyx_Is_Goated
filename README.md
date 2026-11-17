# Nyx

Desktop music player (private local build) with synced lyrics, queue/playback controls, offline downloads, and Windows installer releases.

## Download (Windows)

1. Open the latest release: https://github.com/ryoxzdevz-byte/Nyx_Is_Goated/releases/latest
2. Download `Nyx-Setup-<version>.exe` (for example `Nyx-Setup-0.2.13.exe`).
3. Run the installer. Windows SmartScreen may warn because the installer is not code-signed; choose the option to keep/run it only if you trust this local build.
4. Launch **Nyx** from the Start Menu or desktop shortcut.

To update, install a newer `Nyx-Setup-<version>.exe` from Releases, or use **Settings > About > Check for updates** when available.

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- Windows 10/11, macOS, or Linux

### Setup

```bash
git clone https://github.com/ryoxzdevz-byte/Nyx_Is_Goated.git
cd Nyx_Is_Goated
pnpm install
```

### Run

```bash
pnpm dev
```

### Test / Check

```bash
pnpm test
pnpm check
```

## Build Installers

```bash
pnpm electron:build:win    # Windows NSIS installer (release/Nyx-Setup-<version>.exe)
pnpm electron:build:mac    # macOS DMG/ZIP
pnpm electron:build:linux  # Linux AppImage/deb
```

Built artifacts are placed in `release/` (not committed).

## Web + iOS (iPhone)

The desktop app is Electron-only. A separate web/iOS target reuses the same React UI, with a small Node server replacing the Electron bridge (request signing, auth refresh, cover signing) and a Capacitor shell producing a sideloadable IPA.

### Deploy the server

```bash
pnpm web:build
pnpm api
```

The server listens on `PORT` (default `8787`), serves `dist/`, exposes `/api/liner/*` (signed Liner proxy), `/api/bridge/*` (signing/auth) and `/api/health`. Put it behind an HTTPS reverse proxy and point your domain at it (`docker build -t nyx-api . && docker run -p 8787:8787 -e NYX_API_TOKEN=... nyx-api` is also supported). Set `NYX_API_TOKEN` to require the `x-nyx-token` header, and `LINER_API_ORIGIN` to override the upstream API.

For local testing: `pnpm web:dev` in one terminal and `pnpm api:dev` in another, then open `http://localhost:8787` (or `http://<PC-IP>:8787` on the iPhone).

### Build the IPA

1. Set GitHub repository secrets: `NYX_SERVER_URL` (public HTTPS URL of the deployed web app), `NYX_API_URL` (e.g. `https://your-domain/api/liner`) and `NYX_API_TOKEN` (if you enabled it).
2. Run **Actions > Build Nyx iOS IPA > Run workflow**, or push a tag like `nyx-ios-1.0`.
3. Download the `Nyx-IPA` artifact.
4. Sideload `Nyx.ipa` with AltStore, Sideloadly or a similar tool using your Apple ID. With a free Apple ID you must re-sign/reinstall about every 7 days. On the iPhone go to Settings > General > VPN & Device Management and trust your certificate before opening the app.

To build locally, macOS/Xcode is required: `NYX_SERVER_URL=... pnpm web:build && NYX_SERVER_URL=... pnpm ios:sync && pnpm ios:open`.

### Feature notes

Core browsing, search, streaming, lyrics, queue and settings work in the web/iOS target. Offline downloads are available in the native iOS build: downloaded audio, covers and lyrics are stored in the app's private Library and remain playable offline. Downloads use best-effort direct streams (Liner/R2, SoundCloud and direct YouTube); bot-checked or fragmented YouTube streams may still fail. Local file import, the floating overlay, Touch Bar, Discord Rich Presence, window controls and YouTube TV/PoToken account playback remain desktop-only. Plain browser web builds do not support offline downloads.

## Notes

- This is a private, personal, local build. Follow the repository `LICENSE`.
- Some playback features rely on official upstream services; behavior may change if those services change.
- Use system audio output settings / the in-app output device selector to play through Bluetooth speakers or devices exposed as Windows outputs.

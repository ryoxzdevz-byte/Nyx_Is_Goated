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

## Notes

- This is a private, personal, local build. Follow the repository `LICENSE`.
- Some playback features rely on official upstream services; behavior may change if those services change.
- Use system audio output settings / the in-app output device selector to play through Bluetooth speakers or devices exposed as Windows outputs.

import { createWebSavedTracks } from "./savedTracks";

const AUTH_KEY = "liner_auth_session";
const YOUTUBE_AUTH_KEY = "nyx_youtube_auth_session";

type Listener<T> = (value: T) => void;

interface Session {
  accessToken: string;
  refreshToken: string;
  [key: string]: unknown;
}

const isWeb = typeof __NYX_WEB__ !== "undefined" && __NYX_WEB__;
const devBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(
  /\/+$/,
  "",
);
const apiBase =
  (typeof window !== "undefined" && (window as any).__NYX_API_BASE__) ||
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  (isWeb && typeof window !== "undefined"
    ? `${window.location.origin}/api/liner`
    : "https://api.tryliner.fun");
const bridgeBase =
  (typeof window !== "undefined" && (window as any).__NYX_BRIDGE_BASE__) ||
  devBase ||
  (isWeb && typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "https://api.tryliner.fun/api");
const apiToken =
  (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim() ?? "";

let timeOffsetMs = 0;

function headers(): Record<string, string> {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (apiToken) result["x-nyx-token"] = apiToken;
  return result;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${bridgeBase}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Nyx API ${path} failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }
  return (await response.json()) as T;
}

function readSession(key: string): Session | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, next: Session | null): Session | null {
  try {
    if (next) localStorage.setItem(key, JSON.stringify(next));
    else localStorage.removeItem(key);
  } catch {}
  return next;
}

function sessionBridge(key: string) {
  const listeners = new Set<Listener<Session | null>>();
  const emit = (value: Session | null) =>
    listeners.forEach((listener) => listener(value));
  return {
    get: () => readSession(key),
    set: async (next: Session | null) => {
      const stored = writeSession(key, next);
      emit(stored);
      window.dispatchEvent(new Event("auth:changed"));
      return stored;
    },
    onChange: (cb: Listener<Session | null>) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

const authSession = sessionBridge(AUTH_KEY);
const youtubeAuthSession = sessionBridge(YOUTUBE_AUTH_KEY);

const noop = () => {};
const noopAsync = async () => {};
const noopUnsubscribe = () => noop;

export function installWebBridge(): void {
  if (typeof window === "undefined" || window.linerElectron) return;

  (window as any).__NYX_API_BASE__ = apiBase;
  (window as any).__NYX_WEB__ = true;
  document.documentElement.classList.add("nyx-web", "nyx-native");
  const savedTracks = createWebSavedTracks();

  const bridge = {
    platform: "darwin",
    isHyprland: false,

    signRequest: async (input: {
      method: string;
      path: string;
      body?: string | null;
      timestamp?: number;
    }) =>
      post<{ signature: string; timestamp: number; nonce: string }>(
        "/bridge/sign",
        input,
      ),
    signMonitorRequest: async (input: {
      method: string;
      path: string;
      body?: string | null;
      timestamp?: number;
    }) =>
      post<{ signature: string; timestamp: number; nonce: string }>(
        "/bridge/sign-monitor",
        input,
      ),
    signRawPayload: async (payload: number[] | Uint8Array) => {
      const bytes =
        payload instanceof Uint8Array ? payload : new Uint8Array(payload);
      let binary = "";
      bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
      const result = await post<{ signature: string }>("/bridge/sign-raw", {
        payload: btoa(binary),
      });
      return result.signature;
    },
    signCoverUrl: async (payload: string) => {
      const result = await post<{ token: string }>("/bridge/sign-cover", {
        payload,
      });
      return result.token;
    },
    syncServerTime: async (date: string | number) => {
      const result = await post<{ offsetMs: number }>("/bridge/time", { date });
      timeOffsetMs = Number.isFinite(result.offsetMs) ? result.offsetMs : 0;
      return timeOffsetMs;
    },
    getServerTimeOffset: async () => timeOffsetMs,

    authSession: {
      get: authSession.get,
      set: authSession.set,
      onChange: authSession.onChange,
      refresh: async (input: { refreshToken?: string }) => {
        const result = await post<{
          outcome: string;
          session: Session | null;
          reason?: string;
        }>("/bridge/auth/refresh", { refreshToken: input.refreshToken });
        if (
          result.session &&
          (result.outcome === "refreshed" || result.outcome === "rotated")
        ) {
          authSession.set(result.session);
        }
        return result;
      },
    },
    youtubeAuthSession: {
      get: youtubeAuthSession.get,
      set: youtubeAuthSession.set,
    },

    getAppVersion: async () => __APP_VERSION__,
    writeClipboardText: async (text: string) => {
      await navigator.clipboard.writeText(text);
      return true;
    },
    getAudioOutputDevices: async () => [],
    onDeeplink: noopUnsubscribe,
    onWindowStateChange: noopUnsubscribe,
    onWindowRestored: noopUnsubscribe,
    onAppFlush: noopUnsubscribe,
    onWindowMinimized: noopUnsubscribe,
    onBundleStamp: noopUnsubscribe,
    onUpdateAvailable: noopUnsubscribe,
    onUpdateDownloadProgress: noopUnsubscribe,
    onUpdateDownloaded: noopUnsubscribe,
    onUpdateError: noopUnsubscribe,
    onOverlayAction: noopUnsubscribe,
    onOverlayState: noopUnsubscribe,
    onOverlayVisibility: noopUnsubscribe,
    onOverlaySettingsChanged: noopUnsubscribe,
    onTouchBarAction: noopUnsubscribe,
    onTouchBarRequestSync: noopUnsubscribe,
    onShortcutStatus: noopUnsubscribe,

    minimize: noopAsync,
    toggleMaximize: noopAsync,
    toggleFullScreen: noopAsync,
    close: noopAsync,
    relaunchApp: async () => false,
    dragStart: noop,
    dragMove: noop,
    dragEnd: noop,
    notePresence: noop,
    setBackgroundMaterial: async () => false,
    isMaximized: async () => false,
    isFullScreen: async () => false,
    getRememberWindowBounds: async () => false,
    setRememberWindowBounds: async () => false,
    setAppIcon: noopAsync,
    openDownloads: async () => false,
    openExportFolder: async () => false,
    openBluetoothSettings: async () => false,
    openUninstall: async () => false,
    openCacheFolder: async () => false,
    savedTracksOpenFolder: async () => false,
    ...(savedTracks
      ? {
          savedTracksList: savedTracks.savedTracksList,
          savedTracksSave: savedTracks.savedTracksSave,
          savedTracksDownload: savedTracks.savedTracksDownload,
          savedTracksRemove: savedTracks.savedTracksRemove,
          savedTracksRemoveAll: savedTracks.savedTracksRemoveAll,
          savedTracksUsage: savedTracks.savedTracksUsage,
          savedTracksUsageOf: savedTracks.savedTracksUsageOf,
          savedTracksGetLyrics: savedTracks.savedTracksGetLyrics,
          savedTracksSetLyrics: savedTracks.savedTracksSetLyrics,
        }
      : {}),
    clearCoversCache: async () => true,
    clearAudioCache: async () => true,
    clearHttpCache: async () => true,
    checkForUpdates: async () => ({ available: false }),
    downloadUpdate: async () => ({ success: false }),
    quitAndInstall: async () => false,
    getDiscordStatus: async () => ({ connected: false }),
    discordUpdateState: noop,
    discordUpdateSettings: noop,
    touchbarUpdateState: noop,
    sendTouchBarAction: noop,
    getTouchBarInitialState: async () => null,
    overlayUpdateState: noop,
    overlayReady: noop,
    sendOverlayAction: noop,
    toggleOverlay: async () => false,
    isOverlayOpen: async () => false,
    closeOverlay: noop,
    getOverlayInitialState: async () => null,
    updateOverlaySettings: noop,
    pauseOverlayShortcuts: noop,
    setOverlayAuthenticated: noop,
    getShortcutStatus: async () => ({}),
    bundleCheck: async () => ({ available: false }),
    bundleDownloadAndInstall: async () => ({ success: false }),
    bundleHotSwap: async () => false,
    bundleRollback: async () => false,
    bundleGetStatus: async () => ({
      appVersion: __APP_VERSION__,
      bundleVersion: __APP_VERSION__,
      isOta: false,
      sha256: null,
      effectivePath: "",
    }),
  };

  (window as any).linerElectron = bridge;
}

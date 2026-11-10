import { useTheme } from "next-themes";
import { usePageBackdropStore } from "@/shared/lib";

export type GlassIntensity = "off" | "default" | "strong";
export type WindowMaterial = "auto" | "acrylic" | "mica" | "none";
export type BackgroundTint =
  | "system"
  | "dark"
  | "white"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "cyan"
  | "purple"
  | "pink";

export const GLASS_INTENSITY_STORAGE_KEY = "nyx_glass_intensity_v1";
export const WINDOW_MATERIAL_STORAGE_KEY = "nyx_window_material_v1";
export const BACKGROUND_TINT_STORAGE_KEY = "nyx_background_tint_v1";

export const BACKGROUND_TINT_VALUES: BackgroundTint[] = [
  "system",
  "dark",
  "white",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "cyan",
  "purple",
  "pink",
];

// Soft, colourful gradients used when the blurred cover/glass background is
// turned off: noticeable colour, but never flat/dark enough to swallow the UI.
const BACKGROUND_TINT_CSS: Record<Exclude<BackgroundTint, "system">, string> = {
  dark: "#0a0a0b",
  white: "#f4f4f6",
  red: "radial-gradient(120% 110% at 12% 0%, rgba(255, 107, 129, 0.42), transparent 58%), linear-gradient(180deg, #2a171d, #161013)",
  orange: "radial-gradient(120% 110% at 12% 0%, rgba(255, 172, 84, 0.40), transparent 58%), linear-gradient(180deg, #2a2115, #161208)",
  yellow: "radial-gradient(120% 110% at 12% 0%, rgba(255, 216, 102, 0.36), transparent 58%), linear-gradient(180deg, #282517, #15140d)",
  green: "radial-gradient(120% 110% at 12% 0%, rgba(98, 216, 143, 0.36), transparent 58%), linear-gradient(180deg, #15251c, #0d1611)",
  blue: "radial-gradient(120% 110% at 12% 0%, rgba(110, 170, 255, 0.40), transparent 58%), linear-gradient(180deg, #141e2e, #0c121c)",
  cyan: "radial-gradient(120% 110% at 12% 0%, rgba(103, 232, 249, 0.36), transparent 58%), linear-gradient(180deg, #10262a, #0a1719)",
  purple: "radial-gradient(120% 110% at 12% 0%, rgba(178, 148, 255, 0.42), transparent 58%), linear-gradient(180deg, #1e1832, #120f1e)",
  pink: "radial-gradient(120% 110% at 12% 0%, rgba(255, 128, 196, 0.40), transparent 58%), linear-gradient(180deg, #2b1727, #17101a)",
};

export function readStoredGlassIntensity(): GlassIntensity {
  try {
    const v = localStorage.getItem(GLASS_INTENSITY_STORAGE_KEY);
    if (v === "off" || v === "strong" || v === "default") return v;
    return "default";
  } catch {
    return "default";
  }
}

export function storeGlassIntensity(value: GlassIntensity) {
  try {
    localStorage.setItem(GLASS_INTENSITY_STORAGE_KEY, value);
  } catch {}
}

export function readStoredWindowMaterial(): WindowMaterial {
  try {
    const v = localStorage.getItem(WINDOW_MATERIAL_STORAGE_KEY);
    if (v === "acrylic" || v === "mica" || v === "none" || v === "auto")
      return v;
    return "auto";
  } catch {
    return "auto";
  }
}

export function storeWindowMaterial(value: WindowMaterial) {
  try {
    localStorage.setItem(WINDOW_MATERIAL_STORAGE_KEY, value);
  } catch {}
}

export function applyGlassIntensity(
  value: GlassIntensity = readStoredGlassIntensity(),
) {
  if (typeof document === "undefined") return value;
  document.documentElement.dataset.glassIntensity = value;
  return value;
}

export function applyWindowMaterialPreference(
  value: WindowMaterial = readStoredWindowMaterial(),
) {
  if (typeof document === "undefined") return value;
  document.documentElement.dataset.windowMaterial = value;
  void window.linerElectron?.setBackgroundMaterial?.(value).catch(() => {});
  return value;
}

export function readStoredBackgroundTint(): BackgroundTint {
  try {
    const v = localStorage.getItem(BACKGROUND_TINT_STORAGE_KEY);
    if (v && BACKGROUND_TINT_VALUES.includes(v as BackgroundTint))
      return v as BackgroundTint;
    return "system";
  } catch {
    return "system";
  }
}

export function storeBackgroundTint(value: BackgroundTint) {
  try {
    localStorage.setItem(BACKGROUND_TINT_STORAGE_KEY, value);
  } catch {}
}

export function applyBackgroundTint(
  value: BackgroundTint = readStoredBackgroundTint(),
) {
  if (typeof document === "undefined") return value;
  const root = document.documentElement;
  if (value === "system") {
    root.removeAttribute("data-bg-tint");
    root.style.removeProperty("--nyx-bg-tint");
    return value;
  }
  root.dataset.bgTint = value;
  root.style.setProperty("--nyx-bg-tint", BACKGROUND_TINT_CSS[value]);
  return value;
}

function getIsDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function useIsDarkTheme(): boolean {
  const { resolvedTheme } = useTheme();
  return resolvedTheme ? resolvedTheme === "dark" : getIsDarkTheme();
}

export function useEffectiveCoverGlow(): boolean {
  return useIsDarkTheme();
}

export function useHasPageBackdrop(): boolean {
  const coverGlow = useEffectiveCoverGlow();
  const hasCover = usePageBackdropStore((s) => Boolean(s.coverUrl));
  return coverGlow && hasCover;
}

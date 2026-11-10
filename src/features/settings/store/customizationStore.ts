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
  red: "radial-gradient(125% 115% at 12% 0%, rgba(255, 90, 120, 0.58), transparent 56%), linear-gradient(180deg, #3a1a23, #170e11)",
  orange: "radial-gradient(125% 115% at 12% 0%, rgba(255, 162, 74, 0.56), transparent 56%), linear-gradient(180deg, #382614, #171007)",
  yellow: "radial-gradient(125% 115% at 12% 0%, rgba(255, 214, 82, 0.52), transparent 56%), linear-gradient(180deg, #352f15, #161309)",
  green: "radial-gradient(125% 115% at 12% 0%, rgba(72, 230, 150, 0.52), transparent 56%), linear-gradient(180deg, #163324, #0b1710)",
  blue: "radial-gradient(125% 115% at 12% 0%, rgba(96, 165, 255, 0.58), transparent 56%), linear-gradient(180deg, #172840, #0a111d)",
  cyan: "radial-gradient(125% 115% at 12% 0%, rgba(80, 236, 255, 0.54), transparent 56%), linear-gradient(180deg, #11343a, #08181b)",
  purple: "radial-gradient(125% 115% at 12% 0%, rgba(176, 132, 255, 0.60), transparent 56%), linear-gradient(180deg, #271c46, #120d20)",
  pink: "radial-gradient(125% 115% at 12% 0%, rgba(255, 112, 196, 0.58), transparent 56%), linear-gradient(180deg, #3a1834, #170e19)",
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

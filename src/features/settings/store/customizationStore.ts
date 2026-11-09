import { useTheme } from "next-themes";
import { usePageBackdropStore } from "@/shared/lib";

export type GlassIntensity = "off" | "default" | "strong";
export type WindowMaterial = "auto" | "acrylic" | "mica" | "none";

export const GLASS_INTENSITY_STORAGE_KEY = "nyx_glass_intensity_v1";
export const WINDOW_MATERIAL_STORAGE_KEY = "nyx_window_material_v1";

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

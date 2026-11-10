import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { MenuSelect, ToggleSwitch } from "@/shared/ui";
import { revealThemeChange } from "@/shared/lib";
import {
  applyBackgroundTint,
  applyGlassIntensity,
  applyWindowMaterialPreference,
  readStoredBackgroundTint,
  readStoredGlassIntensity,
  readStoredWindowMaterial,
  storeBackgroundTint,
  storeGlassIntensity,
  storeWindowMaterial,
  type BackgroundTint,
  type GlassIntensity,
  type WindowMaterial,
} from "../../store/customizationStore";
import { useVisualModeStore } from "@/features/player/store/visualModeStore";
import { SettingBlock, SettingRow, SettingSection, SegmentedControl } from "../controls";
import { ThemeCard } from "./ThemeCard";

export function AppearanceTab({ searchQuery }: { searchQuery?: string }) {
  const { t, locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const electron = typeof window !== "undefined" ? window.linerElectron : null;
  const [rememberWindowBounds, setRememberWindowBounds] = useState(false);
  const [appliedGlass] = useState<GlassIntensity>(() =>
    readStoredGlassIntensity(),
  );
  const [savedGlass, setSavedGlass] = useState<GlassIntensity>(appliedGlass);
  const [windowMaterial, setWindowMaterial] = useState<WindowMaterial>(() =>
    readStoredWindowMaterial(),
  );
  const [backgroundTint, setBackgroundTint] = useState<BackgroundTint>(() =>
    readStoredBackgroundTint(),
  );
  const [restarting, setRestarting] = useState(false);
  const visualMode = useVisualModeStore((s) => s.mode);
  const setVisualMode = useVisualModeStore((s) => s.setMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    electron
      ?.getRememberWindowBounds?.()
      .then((enabled) => {
        if (!cancelled) setRememberWindowBounds(enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [electron]);

  const changeRememberWindowBounds = (enabled: boolean) => {
    setRememberWindowBounds(enabled);
    electron
      ?.setRememberWindowBounds?.(enabled)
      .then(setRememberWindowBounds)
      .catch(() => setRememberWindowBounds(!enabled));
  };

  const changeGlassIntensity = (value: GlassIntensity) => {
    setSavedGlass(value);
    storeGlassIntensity(value);
    applyGlassIntensity(value);
  };

  const changeWindowMaterial = (value: WindowMaterial) => {
    setWindowMaterial(value);
    storeWindowMaterial(value);
    applyWindowMaterialPreference(value);
  };

  const changeBackgroundTint = (value: BackgroundTint) => {
    setBackgroundTint(value);
    storeBackgroundTint(value);
    applyBackgroundTint(value);
  };

  const restartToApplyGlass = async () => {
    setRestarting(true);
    applyGlassIntensity(savedGlass);
    applyWindowMaterialPreference(windowMaterial);
    try {
      if (electron?.relaunchApp) await electron.relaunchApp();
      else window.location.reload();
    } finally {
      setRestarting(false);
    }
  };

  const glassRestartPending = mounted && savedGlass !== appliedGlass;

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.language.label")}
        description={t("settings.language.description")}
        titleKey="settings.language.label"
        descKey="settings.language.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <MenuSelect
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={setLocale}
              className="min-w-[130px]"
              aria-label={t("settings.language.label")}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingBlock
        title={t("settings.theme.title")}
        description={t("settings.theme.description")}
        titleKey="settings.theme.title"
        descKey="settings.theme.description"
        searchQuery={searchQuery}
      >
        {mounted ? (
          <div className="grid grid-cols-3 gap-[10px]">
            {(
              [
                { value: "system", label: t("settings.theme.system") },
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
              ] as const
            ).map((item) => {
              return (
                <ThemeCard
                  key={item.value}
                  mode={item.value}
                  label={item.label}
                  active={theme === item.value}
                  onSelect={(event) =>
                    revealThemeChange(() => setTheme(item.value), {
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }
                />
              );
            })}
          </div>
        ) : null}
      </SettingBlock>

      <SettingRow
        title="Blur style"
        description="Adjust Nyx blur/glass intensity. Off disables the glass look; Strong uses heavier blur."
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel="Blur style"
              value={savedGlass}
              onChange={(v) => changeGlassIntensity(v as GlassIntensity)}
              options={[
                { value: "off", label: "Off" },
                { value: "default", label: "Soft" },
                { value: "strong", label: "Strong" },
              ]}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title={t("settings.appearance.background_tint.title") || "Background colour"}
        description={
          t("settings.appearance.background_tint.description") ||
          "Used when the blurred background is off. Pick a soft colourful backdrop; System keeps the default theme."
        }
        searchQuery={searchQuery}
        control={
          mounted ? (
            <MenuSelect
              value={backgroundTint}
              onChange={(v) => changeBackgroundTint(v as BackgroundTint)}
              options={[
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
              ].map((value) => ({
                value,
                label:
                  t(`settings.appearance.background_tint.${value}`) ||
                  value.charAt(0).toUpperCase() + value.slice(1),
              }))}
              className="min-w-[130px]"
              aria-label="Background colour"
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title="Window blur material (Windows)"
        description="Controls the Electron window material behind Nyx. Auto/Acrylic usually give the most visible blur on Windows."
        searchQuery={searchQuery}
        control={
          mounted ? (
            <MenuSelect
              value={windowMaterial}
              onChange={(v) => changeWindowMaterial(v as WindowMaterial)}
              options={[
                { value: "auto", label: "Auto" },
                { value: "acrylic", label: "Acrylic" },
                { value: "mica", label: "Mica" },
                { value: "none", label: "None" },
              ]}
              className="min-w-[130px]"
              aria-label="Window blur material"
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title="Performance mode"
        description="Full is smoothest visuals. Balanced/lite reduce effects if your PC struggles."
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel="Performance mode"
              value={visualMode}
              onChange={setVisualMode}
              options={[
                { value: "full", label: "Full" },
                { value: "balanced", label: "Balanced" },
                { value: "lite", label: "Lite" },
              ]}
            />
          ) : (
            <span />
          )
        }
      />

      <AnimatePresence initial={false}>
        {glassRestartPending ? (
          <motion.div
            key="glass-restart"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <SettingRow
              title={t("settings.appearance.strong_glass.restart_title")}
              description={t("settings.appearance.strong_glass.restart_desc")}
              titleKey="settings.appearance.strong_glass.restart_title"
              descKey="settings.appearance.strong_glass.restart_desc"
              searchQuery={searchQuery}
              control={
                <button
                  type="button"
                  onClick={() => void restartToApplyGlass()}
                  disabled={restarting}
                  className="h-[32px] rounded-[10px] border-0 bg-fill px-[12px] text-label font-[500] text-text-primary transition-[background-color,opacity,transform] hover:bg-fill-hover active:scale-[0.98] disabled:opacity-60"
                >
                  {restarting
                    ? t("settings.appearance.strong_glass.restarting")
                    : t("settings.appearance.strong_glass.restart")}
                </button>
              }
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {electron?.setRememberWindowBounds ? (
        <SettingRow
          title={t("settings.remember_window_bounds.title")}
          description={t("settings.remember_window_bounds.description")}
          titleKey="settings.remember_window_bounds.title"
          descKey="settings.remember_window_bounds.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={rememberWindowBounds}
              onChange={changeRememberWindowBounds}
            />
          }
        />
      ) : null}
    </SettingSection>
  );
}

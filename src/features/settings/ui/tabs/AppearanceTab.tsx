import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { MenuSelect, ToggleSwitch } from "@/shared/ui";
import { revealThemeChange } from "@/shared/lib";
import {
  applyGlassIntensity,
  readStoredGlassIntensity,
  storeGlassIntensity,
  type GlassIntensity,
} from "../../store/customizationStore";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
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
  const [restarting, setRestarting] = useState(false);

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
  };

  const restartToApplyGlass = async () => {
    setRestarting(true);
    applyGlassIntensity(savedGlass);
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
        title={t("settings.appearance.strong_glass.title")}
        description={t("settings.appearance.strong_glass.description")}
        titleKey="settings.appearance.strong_glass.title"
        descKey="settings.appearance.strong_glass.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={mounted ? savedGlass === "strong" : false}
            onChange={(checked) =>
              changeGlassIntensity(checked ? "strong" : "default")
            }
          />
        }
      />

      {glassRestartPending ? (
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
              className="h-[32px] rounded-[10px] border-0 bg-fill px-[12px] text-label font-[500] text-text-primary transition-colors hover:bg-fill-hover disabled:opacity-60"
            >
              {restarting
                ? t("settings.appearance.strong_glass.restarting")
                : t("settings.appearance.strong_glass.restart")}
            </button>
          }
        />
      ) : null}

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

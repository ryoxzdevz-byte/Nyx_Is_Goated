import { useState, useEffect } from "react";
import { useTranslation } from "@/languages";
import { playerEngine, usePlayerStore } from "@/features/player";
import { ToggleSwitch } from "@/shared/ui";
import { SettingRow, SettingSection, SegmentedControl } from "../controls";

export function PlaybackTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const autoplaySimilar = usePlayerStore((state) => state.autoplaySimilar);
  const setAutoplaySimilar = usePlayerStore(
    (state) => state.setAutoplaySimilar,
  );
  const trackDoubleClickBehavior = usePlayerStore(
    (state) => state.trackDoubleClickBehavior,
  );
  const setTrackDoubleClickBehavior = usePlayerStore(
    (state) => state.setTrackDoubleClickBehavior,
  );
  const defaultPlaybackContext = usePlayerStore(
    (state) => state.defaultPlaybackContext,
  );
  const setDefaultPlaybackContext = usePlayerStore(
    (state) => state.setDefaultPlaybackContext,
  );
  const pauseOnDeviceChange = usePlayerStore(
    (state) => state.pauseOnDeviceChange,
  );
  const setPauseOnDeviceChange = usePlayerStore(
    (state) => state.setPauseOnDeviceChange,
  );
  const audioOutputDeviceId = usePlayerStore(
    (state) => state.audioOutputDeviceId,
  );
  const [outputDevices, setOutputDevices] = useState<
    Array<{ deviceId: string; label: string }>
  >([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    const load = async () => {
      try {
        const devices =
          (await window.linerElectron?.getAudioOutputDevices?.()) ??
          (await navigator.mediaDevices
            .enumerateDevices()
            .then((list) =>
              list
                .filter((d) => d.kind === "audiooutput")
                .map((d) => ({
                  deviceId: d.deviceId,
                  label: d.label || "Audio output",
                })),
            )
            .catch(() => []));
        if (active) setOutputDevices(devices);
      } catch {
        if (active) setOutputDevices([]);
      }
    };
    void load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", load);
    };
  }, [mounted]);

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.autoplay_similar.title")}
        description={t("settings.autoplay_similar.description")}
        titleKey="settings.autoplay_similar.title"
        descKey="settings.autoplay_similar.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={autoplaySimilar}
            onChange={setAutoplaySimilar}
          />
        }
      />

      <SettingRow
        title={t("settings.track_double_click.title")}
        description={t("settings.track_double_click.description")}
        titleKey="settings.track_double_click.title"
        descKey="settings.track_double_click.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel={t("settings.track_double_click.title")}
              value={trackDoubleClickBehavior}
              onChange={setTrackDoubleClickBehavior}
              options={[
                {
                  value: "play",
                  label: t("settings.track_double_click.play"),
                },
                {
                  value: "queue",
                  label: t("settings.track_double_click.queue"),
                },
              ]}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title={t("settings.default_playback_context.title")}
        description={t("settings.default_playback_context.description")}
        explained
        titleKey="settings.default_playback_context.title"
        descKey="settings.default_playback_context.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel={t("settings.default_playback_context.title")}
              value={defaultPlaybackContext}
              onChange={setDefaultPlaybackContext}
              options={[
                {
                  value: "resume",
                  label: t("settings.default_playback_context.resume"),
                },
                {
                  value: "empty",
                  label: t("settings.default_playback_context.empty"),
                },
              ]}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title={t("settings.audio.output_device.title")}
        description={t("settings.audio.output_device.description")}
        titleKey="settings.audio.output_device.title"
        descKey="settings.audio.output_device.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <select
              aria-label={t("settings.audio.output_device.title")}
              value={audioOutputDeviceId}
              onChange={(e) =>
                void playerEngine.setAudioOutputDevice(e.target.value)
              }
              className="h-[34px] max-w-[260px] rounded-item border border-border-subtle bg-fill px-[10px] text-label text-text-primary outline-none"
            >
              <option value="default">
                {t("settings.audio.output_device.default")}
              </option>
              {outputDevices
                .filter((d) => d.deviceId && d.deviceId !== "default")
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label ||
                      `${t("settings.audio.output_device.device")} ${i + 1}`}
                  </option>
                ))}
            </select>
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title={t("settings.audio.pause_on_device_change.title")}
        description={t("settings.audio.pause_on_device_change.description")}
        titleKey="settings.audio.pause_on_device_change.title"
        descKey="settings.audio.pause_on_device_change.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={pauseOnDeviceChange}
            onChange={setPauseOnDeviceChange}
          />
        }
      />
    </SettingSection>
  );
}

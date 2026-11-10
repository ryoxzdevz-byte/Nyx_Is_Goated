import { useEffect } from "react";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useUpdaterStore } from "../store/updaterStore";

export default function UpdateToastBridge() {
  const { toast, dismiss } = useToast();
  const { t } = useTranslation();

  const status = useUpdaterStore((state) => state.status);
  const updateInfo = useUpdaterStore((state) => state.updateInfo);
  const downloadProgress = useUpdaterStore((state) => state.downloadProgress);
  const error = useUpdaterStore((state) => state.error);
  const installUpdate = useUpdaterStore((state) => state.installUpdate);
  const reset = useUpdaterStore((state) => state.reset);
  const initUpdaterListeners = useUpdaterStore(
    (state) => state.initUpdaterListeners,
  );

  // initialize ipc listeners from electron main process
  useEffect(() => {
    const cleanup = initUpdaterListeners();
    return cleanup;
  }, [initUpdaterListeners]);

  useEffect(() => {
    const TOAST_ID = "app-update-card";

    if (status === "downloading") {
      const version = updateInfo?.version ? `v${updateInfo.version}` : "";
      let desc = version;
      if (downloadProgress && downloadProgress.total > 0) {
        const currentMb = (downloadProgress.transferred / (1024 * 1024)).toFixed(1);
        const totalMb = (downloadProgress.total / (1024 * 1024)).toFixed(1);
        const speedMb =
          downloadProgress.bytesPerSecond > 0
            ? `${(downloadProgress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
            : "";
        desc = [version, `${downloadProgress.percent}%`, `${currentMb}/${totalMb} MB`, speedMb]
          .filter(Boolean)
          .join(" • ");
      } else if (downloadProgress && downloadProgress.percent > 0) {
        desc = [version, `${downloadProgress.percent}%`].filter(Boolean).join(" • ");
      }

      toast(t("updater.downloading_title") || "Downloading update…", "loader", {
        id: TOAST_ID,
        description: desc,
        duration: 999999,
        onDismiss: reset,
      });
      return;
    }

    if (status === "downloaded") {
      const version = updateInfo?.version ? `v${updateInfo.version}` : "";
      toast(t("updater.downloaded_title") || "Update ready", "checkmark", {
        id: TOAST_ID,
        description: version ? `${version} ready to install` : t("updater.downloaded_desc", { version: "" }) || "Ready to install.",
        duration: 999999,
        action: {
          label: t("updater.restart") || t("updater.install_button") || "Install",
          onClick: () => {
            void installUpdate();
          },
        },
        onDismiss: reset,
      });
      return;
    }

    if (status === "error" && error) {
      toast(t("updater.error_title") || "Update failed", "error", {
        id: TOAST_ID,
        description: error,
        duration: 6000,
        onDismiss: reset,
      });
      return;
    }

    if (status === "idle" || status === "checking" || status === "available") {
      dismiss(TOAST_ID);
    }
  }, [
    status,
    updateInfo,
    downloadProgress,
    error,
    toast,
    dismiss,
    t,
    installUpdate,
    reset,
  ]);

  return null;
}

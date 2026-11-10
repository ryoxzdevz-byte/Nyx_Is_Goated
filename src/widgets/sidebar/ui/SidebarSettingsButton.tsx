import { sidebarNavItems } from "@/features/navigation/data/navigation";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib";

export function SidebarSettingsButton() {
  const { t } = useTranslation();
  const settingsOpen = useModalStore((state) => state.settingsOpen);
  const toggleSettings = useModalStore((state) => state.toggleSettings);

  const settingsItem = sidebarNavItems.find((item) => item.id === "settings");
  if (!settingsItem) return null;

  const Icon = settingsItem.Icon;
  const tooltipLabel = t("common.sidebar.settings") || settingsItem.label;

  return (
    <Tooltip content={tooltipLabel} side="right" sideOffset={12}>
      <button
        type="button"
        aria-pressed={settingsOpen}
        onClick={toggleSettings}
        className="group relative inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer transition-transform duration-150 active:scale-[0.94]"
      >
        <span
          className={cn(
            "relative flex h-[40px] w-[40px] items-center justify-center rounded-[13px] transition-colors duration-150",
            settingsOpen ? "bg-fill" : "group-hover:bg-fill-subtle",
          )}
        >
          <Icon
            size={23}
            className={cn(
              "relative z-10 text-text-primary transition-opacity duration-150 ease-out",
              settingsOpen
                ? "opacity-100"
                : "opacity-55 group-hover:opacity-90",
            )}
          />
          {settingsOpen && (
            <span className="absolute left-[-9px] h-[15px] w-[2px] rounded-full bg-text-primary/45" />
          )}
        </span>
      </button>
    </Tooltip>
  );
}

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { sidebarNavItems } from "@/features/navigation/data/navigation";
import { useTranslation } from "@/languages";
import { Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { useOfflineModeStore } from "@/features/connectivity";

export interface SidebarNavItemsProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
}

export function SidebarNavItems({
  searchOpen,
  onSearchToggle,
}: SidebarNavItemsProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const offline = useOfflineModeStore((state) => state.offline);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const isRouteActive = (href: string) => {
    if (pendingHref) return href === pendingHref;
    if (href === "/") {
      return pathname === "/" || pathname === "/home";
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const isItemActive = (id: string, href?: string) => {
    if (id === "search") {
      return searchOpen;
    }
    return href ? isRouteActive(href) : false;
  };

  return (
    <>
      {sidebarNavItems
        .filter((item) => item.id !== "settings")
        .filter((item) => !offline || item.id === "library")
        .map((item) => {
          const active = isItemActive(item.id, item.href);
          const Icon = item.Icon;
          const tooltipLabel = t(`common.sidebar.${item.id}`) || item.label;

          if (item.id === "search") {
            return (
              <Tooltip
                key={item.id}
                content={tooltipLabel}
                side="right"
                sideOffset={12}
              >
                <button
                  type="button"
                  aria-pressed={searchOpen}
                  onClick={onSearchToggle}
                  className="group relative inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer transition-transform duration-150 active:scale-[0.94]"
                >
                  <span
                    className={cn(
                      "relative flex h-[40px] w-[40px] items-center justify-center rounded-[13px] transition-colors duration-150",
                      active ? "bg-fill" : "group-hover:bg-fill-subtle",
                    )}
                  >
                    <Icon
                      size={23}
                      className={cn(
                        "relative z-10 text-text-primary transition-opacity duration-150 ease-out",
                        active
                          ? "opacity-100"
                          : "opacity-55 group-hover:opacity-90",
                      )}
                    />
                    {active && (
                      <span className="absolute left-[-9px] h-[15px] w-[2px] rounded-full bg-text-primary/45" />
                    )}
                  </span>
                </button>
              </Tooltip>
            );
          }

          return (
            <Tooltip
              key={item.id}
              content={tooltipLabel}
              side="right"
              sideOffset={12}
            >
              <Link
                key={item.id}
                to={item.href!}
                aria-current={active ? "page" : undefined}
                onPointerDown={(event) => {
                  if (event.button === 0) setPendingHref(item.href!);
                }}
                onPointerLeave={(event) => {
                  if (event.buttons & 1) setPendingHref(null);
                }}
                onPointerCancel={() => setPendingHref(null)}
                className="group relative inline-flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-[0.94]"
              >
                <span
                  className={cn(
                    "relative flex h-[40px] w-[40px] items-center justify-center rounded-[13px] transition-colors duration-150",
                    active ? "bg-fill" : "group-hover:bg-fill-subtle",
                  )}
                >
                  <Icon
                    size={23}
                    className={cn(
                      "relative z-10 text-text-primary",
                      active
                        ? "opacity-100"
                        : "opacity-55 transition-opacity duration-150 ease-out group-hover:opacity-90",
                    )}
                  />
                  {active && (
                    <span className="absolute left-[-9px] h-[15px] w-[2px] rounded-full bg-text-primary/45" />
                  )}
                </span>
              </Link>
            </Tooltip>
          );
        })}
    </>
  );
}

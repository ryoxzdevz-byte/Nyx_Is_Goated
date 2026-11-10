import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

export interface SettingsNavIconProps {
  size?: number;
  weight?: "Bold";
  className?: string;
}

const itemClass =
  "group relative flex h-[32px] w-full cursor-pointer items-center gap-[10px] rounded-[11px] border-0 bg-transparent px-[10px] text-left text-body font-[500] leading-none transition-[color,background-color,transform] duration-150 active:scale-[0.985]";

export function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  role,
}: {
  icon: ComponentType<SettingsNavIconProps>;
  label: ReactNode;
  active?: boolean;
  onClick: () => void;
  role?: "tab";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role ? active : undefined}
      onClick={onClick}
      className={cn(
        itemClass,
        active
          ? "text-text-primary"
          : "text-text-secondary hover:bg-fill-subtle hover:text-text-primary",
      )}
    >
      {active ? (
        <motion.span
          layoutId="settings-nav-active"
          transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.72 }}
          className="absolute inset-0 rounded-[11px] bg-fill-hover"
        />
      ) : (
        <span className="absolute inset-0 rounded-[11px] bg-transparent transition-colors duration-150 group-hover:bg-fill-subtle" />
      )}
      <Icon
        size={17}
        weight="Bold"
        className={cn(
          "relative shrink-0 transition-[color,opacity,transform] duration-150",
          active
            ? "text-text-primary"
            : "text-text-tertiary group-hover:text-text-secondary",
        )}
      />
      <span className="relative truncate">{label}</span>
      {active ? (
        <span className="relative ml-auto h-[14px] w-[3px] rounded-full bg-text-primary/30" />
      ) : null}
    </button>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 px-[10px] pb-[5px] pt-[1px] text-[11px] font-[600] uppercase tracking-[0.05em] leading-[14px] text-text-tertiary/90">
      {children}
    </p>
  );
}

import { memo, useState } from "react";
import PageCoverBackdrop from "./PageCoverBackdrop";
import { useActiveBackgroundCover } from "../hooks/useActiveBackgroundCover";

export interface DynamicBlurBackgroundProps {
  isDark?: boolean;
  force?: boolean;
}

interface ShownCover {
  src: string | null;
  crossOrigin?: "anonymous";
}

function isStrongGlass() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.glassIntensity === "strong"
  );
}

export function DynamicBlurBackground({
  isDark = true,
  force = false,
}: DynamicBlurBackgroundProps) {
  const { cover, pageBackdropOptions } = useActiveBackgroundCover();
  const [shown, setShown] = useState<ShownCover | null>(null);
  const strong = isStrongGlass();

  if (cover.kind === "ready") {
    if (shown?.src !== cover.src || shown.crossOrigin !== cover.crossOrigin) {
      setShown({ src: cover.src, crossOrigin: cover.crossOrigin });
    }
  } else if (cover.kind === "none" && shown && shown.src !== null) {
    setShown({ src: null });
  }

  if (!shown && !force) return null;

  if (!shown?.src) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-item"
      >
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "radial-gradient(120% 90% at 20% 0%, rgba(120,90,255,0.18), transparent 55%), radial-gradient(90% 80% at 100% 20%, rgba(255,120,180,0.10), transparent 60%), linear-gradient(180deg, rgba(18,18,22,0.72), rgba(10,10,12,0.92))"
              : "radial-gradient(120% 90% at 20% 0%, rgba(120,90,255,0.12), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.68), rgba(245,245,247,0.9))",
            filter: `blur(${strong ? 56 : 28}px) saturate(140%)`,
            transform: "scale(1.08)",
          }}
        />
      </div>
    );
  }

  return (
    <PageCoverBackdrop
      coverSrc={shown.src}
      coverCrossOrigin={shown.crossOrigin}
      isDark={isDark}
      blur={(pageBackdropOptions?.blur ?? 56) + (strong ? 24 : 0)}
      dim={(pageBackdropOptions?.dim ?? 0.22) + (strong ? 0.08 : 0)}
    />
  );
}

export default memo(DynamicBlurBackground);

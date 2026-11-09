import { memo, useState } from "react";
import PageCoverBackdrop from "./PageCoverBackdrop";
import { useActiveBackgroundCover } from "../hooks/useActiveBackgroundCover";

export interface DynamicBlurBackgroundProps {
  isDark?: boolean;
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

  if (!shown) return null;

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

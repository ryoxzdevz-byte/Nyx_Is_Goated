import { memo } from "react";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import { useTranslation } from "@/languages";
import type { DailyMix } from "../hooks/useDailyMixes";
import DailyMixCard from "./DailyMixCard";

function NyxMark({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 45 35" width={size} height={(size * 35) / 45} aria-hidden="true">
      <mask id="nyx-mixes-mark">
        <rect width="45" height="35" fill="black" />
        <circle cx="18" cy="17.5" r="13" fill="white" />
        <circle cx="25" cy="13.5" r="11.5" fill="black" />
      </mask>
      <circle cx="18" cy="17.5" r="13" fill="currentColor" mask="url(#nyx-mixes-mark)" />
      <path d="M36 6.5l1.1 3.1 3.1 1.1-3.1 1.1-1.1 3.1-1.1-3.1-3.1-1.1 3.1-1.1L36 6.5Z" fill="currentColor" />
      <circle cx="38.5" cy="21.5" r="1.4" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

export interface DailyMixesSectionProps {
  mixes: DailyMix[];
  headingMarginTop?: string;
  accentCoverUrl?: string;
}

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-roboto-flex), sans-serif",
  fontWeight: 564,
  fontVariationSettings:
    "'wght' 564, 'GRAD' 105, 'XOPQ' 100, 'wdth' 134, 'opsz' 144",
};

function DailyMixesSection({
  mixes,
  headingMarginTop = "mt-[22px]",
}: DailyMixesSectionProps) {
  const { t } = useTranslation();
  if (mixes.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div
        className={`${headingMarginTop} px-3 flex items-center justify-between`}
      >
        <div className="group flex items-center gap-3">
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-fill text-text-primary">
            <NyxMark size={18} />
          </span>
          <h2
            className="font-roboto-flex-heading text-text-primary text-[36px] m-0 leading-none tracking-tight"
            style={headingStyle}
          >
            {t("home.dailyMixes") || "Your Mixes"}
          </h2>
        </div>
      </div>

      <ScrollableRow className="flex gap-[28px] pl-3 pr-3 mt-[12px] overflow-x-auto pb-[2px]">
        {mixes.map((mix, index) => (
          <DailyMixCard
            key={`daily-mix-${mix.id}-${index}`}
            mix={mix}
            index={index}
          />
        ))}
      </ScrollableRow>
    </div>
  );
}

export default memo(DailyMixesSection);

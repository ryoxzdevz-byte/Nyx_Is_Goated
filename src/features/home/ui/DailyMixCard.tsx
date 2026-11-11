import { memo, useState } from "react";
import { ScrollableText } from "@/shared/ui";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import ArtistLink from "@/features/artist/ui/ArtistLink";
import type { DailyMix } from "../hooks/useDailyMixes";
import { useDailyMixActions } from "../hooks/useDailyMixActions";
import DailyMixCover from "./DailyMixCover";

export interface DailyMixCardProps {
  mix: DailyMix;
  index?: number;
}

function DailyMixCard({ mix, index }: DailyMixCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const {
    menuItems,
    menuOpen,
    setMenuOpen,
    menuPosition,
    setMenuPosition,
    handleContextMenu,
    handleClick,
  } = useDailyMixActions(mix);

  const mixNumber = mix.title.match(/\d+/)?.[0] ?? String((index ?? 0) + 1);
  const hasArtists = mix.clusterArtists && mix.clusterArtists.length > 0;

  return (
    <div
      className="group flex-shrink-0 w-[175px] cursor-pointer select-none"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      <DailyMixCover
        coverUrl={mix.coverUrl}
        mixNumber={mixNumber}
        imageLoaded={imageLoaded}
        onLoad={() => setImageLoaded(true)}
      />

      <div className="flex flex-col mt-[8px]">
        <span className="truncate text-label font-[500] text-text-primary">
          {mix.title}
        </span>
        {hasArtists ? (
          <div className="min-w-0 text-body text-text-tertiary" onClick={(e) => e.stopPropagation()}>
            <ArtistLink name={mix.clusterArtists.join(", ")} className="truncate text-body text-text-tertiary" />
          </div>
        ) : (
          <ScrollableText
            text={mix.description || ""}
            isParentHovered={isCardHovered}
            className="text-body text-text-tertiary"
            fadeColorClass="from-bg-primary"
          />
        )}
      </div>

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={(isOpen) => {
            setMenuOpen(isOpen);
            if (!isOpen) setMenuPosition(null);
          }}
          position={menuPosition}
        />
      )}
    </div>
  );
}

export default memo(DailyMixCard);

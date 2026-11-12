import {
  SkipNext,
  SkipPrevious,
  Repeat,
  RepeatOne,
  Shuffle,
} from "@solar-icons/react";
import { motion } from "framer-motion";
import { PlayerMorphIcon, ICON_PLAY, ICON_PAUSE } from "./morphPlayerIcons";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import { isRadioContext, nextRepeatMode } from "../engine/radioMode";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";

const iconButtonClass =
  "inline-flex h-[36px] w-[36px] items-center justify-center text-white opacity-80 transition-[transform,opacity] duration-150 ease-out hover:scale-[1.08] hover:opacity-100 active:scale-[0.88] shrink-0 border-none bg-transparent cursor-pointer";

interface PlayPauseIconProps {
  status: string;
}

function PlayPauseIcon({ status }: PlayPauseIconProps) {
  const loading = status === "loading";
  const playing = status === "playing";
  return (
    <span className="relative flex h-[30px] w-[30px] items-center justify-center">
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-transform",
          loading && "opacity-0",
          !playing && "translate-x-[2px]",
        )}
      >
        <PlayerMorphIcon icon={playing ? ICON_PAUSE : ICON_PLAY} size={30} />
      </span>
      {loading && (
        <span
          className="absolute h-[24px] w-[24px] animate-spin rounded-full border-[2px] border-current border-t-transparent"
          aria-label="Loading playback"
        />
      )}
    </span>
  );
}

export function FullscreenTransportControls() {
  const player = usePlayerState();
  const { t } = useTranslation();

  return (
    <div className="flex w-full items-center justify-center gap-[18px]">
      <button
        type="button"
        aria-label={
          player.shuffle ? t("player.shuffle_on") : t("player.shuffle_off")
        }
        onClick={() => playerEngine.setShuffle(!player.shuffle)}
        className={cn(
          iconButtonClass,
          player.shuffle ? "!opacity-100" : "!opacity-60",
          "group",
        )}
      >
        <motion.span
          key={player.shuffle ? "shuffle-on" : "shuffle-off"}
          initial={{ scale: 0.82, rotate: player.shuffle ? -14 : 14 }}
          animate={{ scale: player.shuffle ? 1.1 : 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
          whileTap={{ scale: 0.85, rotate: 18 }}
          className="inline-flex"
        >
          <Shuffle size={24} weight="Outline" />
        </motion.span>
      </button>

      <button
        type="button"
        aria-label="Previous track"
        onClick={() => void playerEngine.skipPrevious()}
        className={cn(iconButtonClass, "group")}
      >
        <SkipPrevious
          size={22}
          weight="Bold"
          className="transition-transform duration-150 ease-out group-active:-translate-x-[2px]"
        />
      </button>

      <button
        type="button"
        aria-label={player.status === "playing" ? "Pause" : "Play"}
        onClick={() => void playerEngine.togglePlayPause()}
        className={cn(iconButtonClass, "h-[44px] w-[44px] opacity-95")}
      >
        <PlayPauseIcon status={player.status} />
      </button>

      <button
        type="button"
        aria-label="Next track"
        onClick={() => void playerEngine.skipNext()}
        className={cn(iconButtonClass, "group")}
      >
        <SkipNext
          size={22}
          weight="Bold"
          className="transition-transform duration-150 ease-out group-active:translate-x-[2px]"
        />
      </button>

      <button
        type="button"
        aria-label="Repeat"
        onClick={() =>
          playerEngine.setRepeat(
            nextRepeatMode(
              player.repeat,
              isRadioContext(player.playbackContext),
            ),
          )
        }
        className={cn(
          iconButtonClass,
          player.repeat !== "off" ? "!opacity-100" : "!opacity-60",
          "group",
        )}
      >
        <motion.span
          key={`repeat-${player.repeat}`}
          initial={{ scale: 0.82, rotate: player.repeat === "off" ? 12 : -14 }}
          animate={{ scale: player.repeat !== "off" ? 1.1 : 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
          whileTap={{ scale: 0.85, rotate: -12 }}
          className="inline-flex"
        >
          {player.repeat === "one" ? (
            <RepeatOne size={24} />
          ) : (
            <Repeat size={24} />
          )}
        </motion.span>
      </button>
    </div>
  );
}

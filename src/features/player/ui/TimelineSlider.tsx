import { useState, useRef, useCallback, memo } from "react";

export interface TimelineSliderProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  trackBg?: string;
  trackActiveBg?: string;
  fillColor?: string;
  showTime?: boolean;
  onScrub?: (positionMs: number) => void;
  showThumb?: boolean;
}

export function formatPlaybackTime(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export const TimelineSlider = memo(function TimelineSlider({
  positionMs,
  durationMs,
  onSeek,
  className = "",
  trackClassName = "",
  fillClassName = "",
  size = "md",
  trackBg,
  trackActiveBg,
  fillColor,
  showTime = false,
  onScrub,
  showThumb = true,
}: TimelineSliderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = Math.max(0, durationMs);
  const currentPosition =
    isDragging && scrubPosition !== null
      ? scrubPosition
      : Math.min(Math.max(0, positionMs), duration || Infinity);

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, currentPosition / duration)) : 0;
  const percentage = progress * 100;

  const calculatePositionFromPointer = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return currentPosition;
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * duration;
    },
    [currentPosition, duration],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const targetPos = calculatePositionFromPointer(e.clientX);
      setScrubPosition(targetPos);
      onScrub?.(targetPos);

      const onPointerMove = (ev: PointerEvent) => {
        const pos = calculatePositionFromPointer(ev.clientX);
        setScrubPosition(pos);
        onScrub?.(pos);
      };

      const onPointerUp = (ev: PointerEvent) => {
        const finalPos = calculatePositionFromPointer(ev.clientX);
        setIsDragging(false);
        setScrubPosition(null);
        try {
          (e.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
        } catch {}
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        onSeek(finalPos);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [calculatePositionFromPointer, onScrub, onSeek],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (duration <= 0) return;
      const step = 5000; // 5 seconds
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeek(Math.min(duration, currentPosition + step));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeek(Math.max(0, currentPosition - step));
      } else if (e.key === "Home") {
        e.preventDefault();
        onSeek(0);
      } else if (e.key === "End") {
        e.preventDefault();
        onSeek(duration);
      }
    },
    [currentPosition, duration, onSeek],
  );

  const containerHeights = {
    xs: "h-[16px]",
    sm: "h-[20px]",
    md: "h-[24px]",
    lg: "h-[28px]",
  }[size];

  const baseTrackHeights = {
    xs: "h-[3px]",
    sm: "h-[4px]",
    md: "h-[4px]",
    lg: "h-[5px]",
  }[size];

  const thumbSize = {
    xs: "h-[10px] w-[10px]",
    sm: "h-[12px] w-[12px]",
    md: "h-[12px] w-[12px]",
    lg: "h-[14px] w-[14px]",
  }[size];

  const isActive = isHovered || isDragging;

  const defaultTrackBg = trackBg ?? "rgba(255, 255, 255, 0.2)";
  const defaultTrackActiveBg = trackActiveBg ?? defaultTrackBg;

  return (
    <div
      className={`group relative flex ${containerHeights} items-center select-none prevent-seek ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showTime && (
        <span className="text-[11px] tabular-nums text-text-tertiary w-[36px] text-right shrink-0 pr-[8px]">
          {formatPlaybackTime(currentPosition)}
        </span>
      )}

      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentPosition}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        className="relative flex h-full flex-1 items-center cursor-pointer outline-none"
      >
        <div
          ref={trackRef}
          className={`relative w-full rounded-full origin-center ${baseTrackHeights} ${trackClassName}`}
          style={{
            backgroundColor: isActive ? defaultTrackActiveBg : defaultTrackBg,
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div
              className={`absolute inset-0 rounded-full transition-transform ease-out ${
                isDragging ? "duration-0" : "duration-75"
              } ${fillClassName || "bg-text-primary"}`}
              style={{
                transform: `translateX(${percentage - 100}%)`,
                ...(fillColor ? { backgroundColor: fillColor } : {}),
              }}
            />
          </div>
          {showThumb && (
            <div
              className={`pointer-events-none absolute top-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.35)] transition-[opacity,transform] duration-100 ${
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-75"
              } ${thumbSize}`}
              style={{
                left: `${percentage}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </div>
      </div>

      {showTime && (
        <span className="text-[11px] tabular-nums text-text-tertiary w-[36px] shrink-0 pl-[8px]">
          {formatPlaybackTime(duration)}
        </span>
      )}
    </div>
  );
});

export default TimelineSlider;

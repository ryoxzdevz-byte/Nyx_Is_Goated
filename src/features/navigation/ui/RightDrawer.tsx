import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Back2Line, CloseLine } from "@mingcute/react";
import {
  usePlayerState,
  usePlayerStore,
  playerEngine,
  isRadioContext,
  nextRepeatMode,
} from "@/features/player";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { useTranslation } from "@/languages";
import {
  ReorderDropPlaceholder,
  FloatingDragCard,
  showToast,
} from "@/shared/ui";
import { useListReorder } from "@/shared/hooks";
import RightDrawerHeader from "./RightDrawerHeader";

const QUEUE_ITEM_HEIGHT = 68;
const REMOVE_FADE_MS = 200;
const REMOVE_SHIFT_DELAY_MS = 70;
const REMOVE_SHIFT_MS = 280;
const REMOVE_MS = REMOVE_SHIFT_DELAY_MS + REMOVE_SHIFT_MS;
const CALM_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const RESTORE_FADE_DELAY_MS = REMOVE_SHIFT_MS - REMOVE_SHIFT_DELAY_MS;

interface QueueRestore {
  index: number;
  phase: "start" | "run";
}

const QueueList = memo(function QueueList({
  queue,
  queueLimit,
  currentIndex,
  playbackContext,
  playbackContextCover,
  scrollContainerRef,
}: {
  queue: any[];
  queueLimit: number;
  currentIndex: number;
  playbackContext: any;
  playbackContextCover: any;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const startIndex = Math.max(0, currentIndex);
  const upcomingQueue = useMemo(
    () => queue.slice(startIndex),
    [queue, startIndex],
  );
  const visibleQueue = useMemo(
    () => upcomingQueue.slice(0, queueLimit),
    [upcomingQueue, queueLimit],
  );
  const rowKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return visibleQueue.map((item) => {
      const count = seen.get(item.id) ?? 0;
      seen.set(item.id, count + 1);
      return `${item.id}#${count}`;
    });
  }, [visibleQueue]);

  const queueContainerRef = useRef<HTMLDivElement>(null);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      playerEngine.reorderQueue(startIndex + fromIndex, startIndex + toIndex);
    },
    [startIndex],
  );

  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<QueueRestore | null>(null);
  const playRestore = useCallback(
    (index: number) => {
      if (reduceMotion) return;
      setRestoring({ index, phase: "start" });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setRestoring({ index, phase: "run" })),
      );
      window.setTimeout(() => setRestoring(null), REMOVE_MS + 60);
    },
    [reduceMotion],
  );
  // slide the row out to the left, then drop it once the animation is done
  const handleRemove = useCallback(
    (index: number, id: string) => {
      const realIndex = startIndex + index;
      setRemovingIndex(index);
      window.setTimeout(
        () => {
          const track = usePlayerStore.getState().queue[realIndex];
          // the queue may have changed during the animation: only remove that same track
          const undo =
            track?.id === id ? playerEngine.removeFromQueue(realIndex) : null;
          if (track && undo) {
            showToast(t("common.removed_from_queue"), "checkmark", {
              description: track.artists
                ? `${track.title} — ${track.artists}`
                : track.title,
              action: {
                label: t("common.undo"),
                icon: <Back2Line size={14} />,
                onClick: () => {
                  undo();
                  const restored = usePlayerStore.getState().queue[realIndex];
                  if (restored?.id === id) playRestore(index);
                },
              },
            });
          }
          setRemovingIndex(null);
        },
        reduceMotion ? 0 : REMOVE_MS,
      );
    },
    [reduceMotion, t, playRestore, startIndex],
  );

  const {
    isDragging,
    dragIndex,
    dropIndex,
    draggedItem,
    pointerPos,
    grabOffset,
    itemWidth,
    handleCardGrab,
  } = useListReorder<any>({
    items: visibleQueue,
    scrollContainerRef,
    listContainerRef: queueContainerRef,
    itemHeight: QUEUE_ITEM_HEIGHT,
    onReorder: handleReorder,
    edgeThreshold: QUEUE_ITEM_HEIGHT,
    maxScrollSpeed: 18,
  });

  return (
    <div
      ref={queueContainerRef}
      className="relative w-full"
      style={{ height: `${visibleQueue.length * QUEUE_ITEM_HEIGHT}px` }}
    >
      {isDragging && dropIndex !== null && (
        <div
          style={{
            position: "absolute",
            top: `${dropIndex * QUEUE_ITEM_HEIGHT}px`,
            left: 0,
            width: "100%",
            height: `${QUEUE_ITEM_HEIGHT}px`,
            pointerEvents: "none",
            zIndex: 0,
          }}
          className="px-0 py-[2px]"
        >
          <ReorderDropPlaceholder />
        </div>
      )}

      {visibleQueue.map((item, index) => {
        const isThisDragged = isDragging && index === dragIndex;
        const isRemoving = removingIndex === index;
        const restoringHere = restoring?.index === index;
        const restoreBelow = restoring !== null && index > restoring.index;
        const restoreStart = restoring?.phase === "start";
        const hidden = isRemoving || (restoringHere && restoreStart);

        let shiftY = 0;
        if (
          isDragging &&
          dragIndex !== null &&
          dropIndex !== null &&
          index !== dragIndex
        ) {
          if (dragIndex < dropIndex) {
            if (index > dragIndex && index <= dropIndex)
              shiftY = -QUEUE_ITEM_HEIGHT;
          } else if (dragIndex > dropIndex) {
            if (index >= dropIndex && index < dragIndex)
              shiftY = QUEUE_ITEM_HEIGHT;
          }
        }
        if (removingIndex !== null && index > removingIndex)
          shiftY = -QUEUE_ITEM_HEIGHT;
        if (restoreBelow && restoreStart) shiftY = -QUEUE_ITEM_HEIGHT;

        const restoreFade = `transform ${REMOVE_FADE_MS}ms ${CALM_EASE} ${RESTORE_FADE_DELAY_MS}ms, opacity ${REMOVE_FADE_MS}ms ${CALM_EASE} ${RESTORE_FADE_DELAY_MS}ms, filter ${REMOVE_FADE_MS}ms ${CALM_EASE} ${RESTORE_FADE_DELAY_MS}ms`;
        let transition: string | undefined;
        if (isDragging)
          transition =
            "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease";
        else if (restoring)
          transition = restoreStart
            ? "none"
            : restoringHere
              ? restoreFade
              : restoreBelow
                ? `transform ${REMOVE_SHIFT_MS}ms ${CALM_EASE}`
                : undefined;
        else if (isRemoving)
          transition = `transform 220ms ${CALM_EASE}, opacity ${REMOVE_FADE_MS}ms ease, filter ${REMOVE_FADE_MS}ms ease`;
        else if (removingIndex !== null)
          transition = `transform ${REMOVE_SHIFT_MS}ms ${CALM_EASE} ${REMOVE_SHIFT_DELAY_MS}ms`;
        else transition = `transform 180ms ${CALM_EASE}`;

        return (
          <div
            key={rowKeys[index]}
            aria-current={index === 0 ? "true" : undefined}
            style={{
              position: "absolute",
              top: `${index * QUEUE_ITEM_HEIGHT}px`,
              left: 0,
              width: "100%",
              height: `${QUEUE_ITEM_HEIGHT}px`,
              transform: hidden
                ? "translateX(-6px) scale(0.98)"
                : shiftY
                  ? `translateY(${shiftY}px)`
                  : undefined,
              filter: hidden ? "blur(4px)" : undefined,
              transition,
              opacity: isThisDragged || hidden ? 0 : 1,
              zIndex: 1,
            }}
            className={`px-0 py-[2px] ${
              index === 0
                ? "rounded-item bg-white/[0.055] ring-1 ring-inset ring-white/[0.06]"
                : ""
            }`}
          >
            {index === 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-[1px] top-1/2 z-[2] h-[22px] w-[3px] -translate-y-1/2 rounded-full bg-emerald-400/90"
              />
            )}
            <SongCardWithMenu
              id={item.id}
              title={item.title}
              artists={item.artists}
              artistId={item.artistId}
              artistList={item.artistList}
              explicit={item.explicit}
              durationMs={item.durationMs}
              coverUrl={
                item.coverUrl ??
                (item as { cover_url?: string }).cover_url ??
                ""
              }
              showReorderHandle
              onRemoveFromQueue={
                index === 0 || removingIndex !== null
                  ? undefined
                  : () => handleRemove(index, item.id)
              }
              trailingAction={
                index === 0 || removingIndex !== null ? undefined : (
                  <button
                    type="button"
                    aria-label={t("common.remove_from_queue")}
                    title={t("common.remove_from_queue")}
                    data-prevent-drag
                    className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-control border-0 bg-transparent text-text-tertiary opacity-0 transition-[opacity,color,background-color] duration-150 hover:bg-fill-hover hover:text-text-primary group-hover:opacity-100 focus-visible:opacity-100"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(index, item.id);
                    }}
                  >
                    <CloseLine size={16} />
                  </button>
                )
              }
              onGrabStart={
                !isDragging && removingIndex === null
                  ? (e) => handleCardGrab(index, item, e)
                  : undefined
              }
              className="p-[8px] rounded-item"
              imageShape="square"
              onPlay={() => {
                if (typeof window !== "undefined" && window.__linerWasDragging)
                  return;
                void playerEngine.playTrack(
                  item,
                  queue,
                  playbackContext,
                  playbackContextCover,
                  startIndex + index,
                  true,
                );
              }}
            />
          </div>
        );
      })}

      {isDragging && draggedItem && (
        <FloatingDragCard
          x={pointerPos.x}
          y={pointerPos.y}
          offsetX={grabOffset.x}
          offsetY={grabOffset.y}
          width={itemWidth}
        >
          <SongCardWithMenu
            id={draggedItem.id}
            title={draggedItem.title}
            artists={draggedItem.artists}
            artistId={draggedItem.artistId}
            artistList={draggedItem.artistList}
            explicit={draggedItem.explicit}
            durationMs={draggedItem.durationMs}
            coverUrl={
              draggedItem.coverUrl ??
              (draggedItem as { cover_url?: string }).cover_url ??
              ""
            }
            className="p-[8px] rounded-[10px] bg-bg-elevated border border-white/10"
            imageShape="square"
          />
        </FloatingDragCard>
      )}
    </div>
  );
});

export interface RightDrawerProps {
  onClose?: () => void;
}

function RightDrawer({ onClose }: RightDrawerProps) {
  const player = usePlayerState();
  const { t } = useTranslation();
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const [queueLimit, setQueueLimit] = useState(50);
  const [isQueueScrolled, setIsQueueScrolled] = useState(false);

  useEffect(() => {
    setQueueLimit(50);
  }, [player.currentIndex]);

  const scrollQueueToCurrent = useCallback(() => {
    const container = queueScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
    setIsQueueScrolled(false);
  }, []);

  const queueScrollCallbackRef = useCallback((node: HTMLDivElement | null) => {
    queueScrollRef.current = node;
    if (node) {
      node.scrollTop = 0;
      setIsQueueScrolled(false);
    }
  }, []);

  const prevQueueTrackIdRef = useRef<string | null>(
    player.currentTrack?.id ?? null,
  );

  useEffect(() => {
    const currentId = player.currentTrack?.id ?? null;
    if (currentId !== null && currentId !== prevQueueTrackIdRef.current) {
      const container = queueScrollRef.current;
      const target = queueScrollRef.current
        ?.firstElementChild as HTMLElement | null;
      if (container && target) {
        target.style.transition =
          "opacity 180ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)";
        target.style.opacity = "0.72";
        target.style.transform = "translateY(4px)";
        container.scrollTo({ top: 0, behavior: "smooth" });
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            target.style.opacity = "";
            target.style.transform = "";
            window.setTimeout(() => {
              target.style.transition = "";
            }, 240);
          }),
        );
      } else {
        scrollQueueToCurrent();
      }
    }
    prevQueueTrackIdRef.current = currentId;
  }, [player.currentTrack?.id, scrollQueueToCurrent]);

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden rounded-[14px] select-none bg-bg-glass backdrop-blur-[48px]">
      <RightDrawerHeader
        trackCount={Math.max(
          0,
          player.queue.length - Math.max(0, player.currentIndex),
        )}
        shuffle={player.shuffle}
        repeat={player.repeat}
        canClear={
          player.currentIndex >= 0 &&
          player.currentIndex < player.queue.length - 1
        }
        onShuffleToggle={() => playerEngine.setShuffle(!player.shuffle)}
        onRepeatCycle={() =>
          playerEngine.setRepeat(
            nextRepeatMode(
              player.repeat,
              isRadioContext(player.playbackContext),
            ),
          )
        }
        onClear={() => playerEngine.clearQueue()}
        onClose={onClose}
      />

      <div className="flex-1 overflow-hidden relative z-10">
        <div
          ref={queueScrollCallbackRef}
          className="absolute inset-0 overflow-y-auto px-[10px] pt-[6px] pb-[16px]"
          style={
            isQueueScrolled
              ? {
                  maskImage:
                    "linear-gradient(to bottom, transparent 0px, black 18px, black 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0px, black 18px, black 100%)",
                  transition:
                    "mask-image 200ms ease, -webkit-mask-image 200ms ease",
                }
              : undefined
          }
          onScroll={(e) => {
            const target = e.currentTarget;
            const next = target.scrollTop > 2;
            setIsQueueScrolled((prev) => (prev === next ? prev : next));
            if (
              target.scrollHeight - target.scrollTop <=
              target.clientHeight * 1.5
            ) {
              setQueueLimit((prev) => Math.min(prev + 50, player.queue.length));
            }
          }}
        >
          {player.queue.length > 0 ? (
            <QueueList
              queue={player.queue}
              queueLimit={queueLimit}
              currentIndex={player.currentIndex}
              playbackContext={player.playbackContext}
              playbackContextCover={player.playbackContextCover}
              scrollContainerRef={queueScrollRef}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-tertiary text-label">
              {t("player.queue_empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(RightDrawer);

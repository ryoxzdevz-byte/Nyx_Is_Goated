import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AddLine,
  CheckLine,
  CloseCircleFill,
  MusicLine,
  Search2Line,
} from "@mingcute/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api, ApiError, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import { useTranslation } from "@/languages";
import { useToast } from "@/shared/ui";
import TextInput from "@/shared/ui/TextInput";
import Dialog from "@/shared/ui/Dialog";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useSearchTracks } from "@/features/search/hooks";
import { playerEngine } from "@/features/player";
import {
  useAddPlaylistTracks,
  useRemovePlaylistTracks,
} from "../../hooks";
import { useModalStore } from "../../store/modalStore";

const ROW_EASE = [0.22, 1, 0.36, 1] as const;

function formatDuration(durationMs?: number): string | undefined {
  if (!durationMs) return undefined;
  const mins = Math.floor(durationMs / 60000);
  const secs = Math.floor((durationMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

export default function AddSongsToPlaylistModal() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();

  const open = useModalStore((state) => state.addSongsOpen);
  const target = useModalStore((state) => state.addSongsTarget);
  const close = useModalStore((state) => state.closeAddSongs);
  const addTrack = useAddPlaylistTracks();
  const removeTrack = useRemovePlaylistTracks();

  const [query, setQuery] = useState("");
  const [recommended, setRecommended] = useState<Track[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<
    Map<string, string | null>
  >(() => new Map());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  const search = useSearchTracks(query, {
    enabled: open && trimmedQuery.length >= 2,
    debounceMs: 180,
  });

  const existingTracks = useMemo(
    () => (target?.existingItems ?? []).map((item) => item.track),
    [target?.existingItems],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRecommended([]);
    const next = new Map<string, string | null>();
    for (const item of target?.existingItems ?? []) {
      next.set(item.track.id, item.itemId);
    }
    for (const trackId of target?.existingTrackIds ?? []) {
      if (!next.has(trackId)) next.set(trackId, null);
    }
    setSelectedItems(next);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, target?.playlistId, target?.existingItems, target?.existingTrackIds]);

  useEffect(() => {
    if (!open || !target) return;
    let active = true;
    setRecommendationsLoading(true);

    const load = async () => {
      let next: Track[] = [];
      if (target.seedTrackId) {
        try {
          const radio = await api.getRadio(target.seedTrackId, {
            history: target.existingTrackIds,
            k: 24,
          });
          next = radio.items.map(toClientTrack);
        } catch {
          next = [];
        }
      }

      if (next.length === 0) {
        try {
          const popular = await api.getPopularTracks("7d", 30);
          next = popular.items.map((item) => toClientTrack(item.track));
        } catch {
          next = [];
        }
      }

      if (!active) return;
      setRecommended(dedupeTracks([...existingTracks, ...next]).slice(0, 30));
      setRecommendationsLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [open, target, existingTracks]);

  const tracks = useMemo(() => {
    const source =
      trimmedQuery.length >= 2 ? search.tracks : recommended;
    return dedupeTracks(source).slice(0, 30);
  }, [recommended, search.tracks, trimmedQuery.length]);

  const loading =
    trimmedQuery.length >= 2 ? search.loading : recommendationsLoading;

  const handleToggle = useCallback(
    async (track: Track) => {
      if (!target || pendingId) return;
      const selected = selectedItems.has(track.id);
      setPendingId(track.id);

      if (selected) {
        const itemId = selectedItems.get(track.id);
        if (!itemId) {
          setPendingId(null);
          return;
        }
        try {
          await removeTrack.mutateAsync({
            playlistId: target.playlistId,
            itemId,
          });
          setSelectedItems((prev) => {
            const next = new Map(prev);
            next.delete(track.id);
            return next;
          });
          toast(t("common.removed_from_playlist"), "checkmark", {
            description: track.title,
          });
        } catch {
          toast(t("common.failed_remove_track"), "error", {
            description: track.title,
          });
        } finally {
          setPendingId(null);
        }
        return;
      }

      try {
        const item = await addTrack.mutateAsync({
          playlistId: target.playlistId,
          trackId: track.id,
        });
        setSelectedItems((prev) => {
          const next = new Map(prev);
          next.set(track.id, item.id);
          return next;
        });
        toast(t("common.added_to_playlist"), "checkmark", {
          description: track.title,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setSelectedItems((prev) => {
            const next = new Map(prev);
            next.set(track.id, null);
            return next;
          });
        } else {
          toast(t("common.failed_add_playlist"), "error", {
            description: track.title,
          });
        }
      } finally {
        setPendingId(null);
      }
    },
    [addTrack, pendingId, removeTrack, selectedItems, t, target, toast],
  );

  const handlePreview = useCallback((track: Track) => {
    void playerEngine.playTrack(
      track,
      [track],
      `${track.title} Radio`,
      track.coverUrl,
    );
  }, []);

  return (
    <Dialog
      open={open && Boolean(target)}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={520}
    >
      <div className="flex flex-col gap-[12px] px-[12px] pb-[12px]">
        <div className="px-[8px] pt-[4px]">
          <h2 className="m-0 text-heading font-[600] tracking-[-0.01em] text-text-primary">
            {t("playlist.add_songs")}
          </h2>
          {target ? (
            <p className="m-0 mt-[3px] truncate text-caption text-text-tertiary">
              {t("playlist.add_songs_to", { playlist: target.playlistTitle })}
            </p>
          ) : null}
          <div className="mt-[12px]">
            <TextInput
              ref={inputRef}
              size="sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("playlist.search_songs")}
              icon={<Search2Line size={16} />}
              rightSlot={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-tertiary hover:text-text-primary"
                    aria-label={t("common.cancel")}
                  >
                    <CloseCircleFill size={15} />
                  </button>
                ) : null
              }
              className="!h-[38px] w-full rounded-control !border-transparent bg-bg-elevated text-body"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-[8px]">
          <span className="text-caption font-[500] text-text-secondary">
            {trimmedQuery.length >= 2
              ? t("playlist.search_results")
              : t("playlist.recommended")}
          </span>
          {tracks.length > 0 ? (
            <span className="text-caption tabular-nums text-text-tertiary">
              {t("common.tracks", { count: tracks.length })}
            </span>
          ) : null}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          <AnimatePresence initial={false} mode="popLayout">
            {fakeLoadingRows(loading, tracks.length, reduceMotion)}
            {tracks.map((track, index) => {
              const selected = selectedItems.has(track.id);
              const pending = pendingId === track.id;
              const duration = formatDuration(track.durationMs);
              return (
                <motion.div
                  key={track.id}
                  layout="position"
                  initial={
                    reduceMotion ? false : { opacity: 0, y: 6, scale: 0.99 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.2,
                          ease: ROW_EASE,
                          delay: Math.min(index, 8) * 0.012,
                        }
                  }
                  className="flex w-full items-center gap-[12px] rounded-control p-[8px] transition-colors hover:bg-bg-elevated"
                >
                  <button
                    type="button"
                    onClick={() => handlePreview(track)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-[12px] border-none bg-transparent p-0 text-left"
                    title={t("common.play")}
                  >
                    <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-elevated">
                      {track.coverUrl ? (
                        <CoverImage
                          src={track.coverUrl}
                          alt={track.title}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : (
                        <MusicLine size={20} className="text-text-tertiary" />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                      <span className="truncate text-body font-[500] text-text-primary">
                        {track.title}
                      </span>
                      <span className="truncate text-caption text-text-tertiary">
                        {track.artists}
                      </span>
                    </div>
                  </button>

                  {duration ? (
                    <span className="shrink-0 text-caption tabular-nums text-text-tertiary">
                      {duration}
                    </span>
                  ) : null}

                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={selected}
                    aria-label={
                      selected
                        ? t("common.remove_from_playlist")
                        : t("common.add_to_playlist")
                    }
                    title={
                      selected
                        ? t("common.remove_from_playlist")
                        : t("common.add_to_playlist")
                    }
                    onClick={() => void handleToggle(track)}
                    className={`flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors disabled:cursor-default ${
                      selected
                        ? "text-emerald-400 hover:text-red-400"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {pending ? (
                      <span className="h-[14px] w-[14px] animate-spin rounded-full border-[2px] border-text-tertiary border-t-text-primary" />
                    ) : selected ? (
                      <motion.span
                        initial={reduceMotion ? false : { scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      >
                        <CheckLine size={18} />
                      </motion.span>
                    ) : (
                      <AddLine size={18} />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!loading && tracks.length === 0 ? (
            <div className="mx-[8px] flex flex-col items-center gap-[8px] rounded-control bg-bg-elevated/60 px-[12px] py-[24px] text-center">
              <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-bg-elevated text-text-tertiary">
                <MusicLine size={18} />
              </span>
              <p className="m-0 text-body text-text-secondary">
                {trimmedQuery.length >= 2
                  ? t("common.try_another_search_clear")
                  : t("playlist.empty_subtitle")}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function fakeLoadingRows(
  loading: boolean,
  trackCount: number,
  reduceMotion: boolean | null,
) {
  if (!loading || trackCount > 0) return null;
  return Array.from({ length: 6 }, (_, index) => (
    <motion.div
      key={`skeleton-${index}`}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-[12px] p-[8px]"
    >
      <div className="skeleton-shimmer h-[44px] w-[44px] shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        <div
          className="skeleton-shimmer h-[10px] rounded-full"
          style={{ width: `${48 + ((index * 13) % 34)}%` }}
        />
        <div
          className="skeleton-shimmer h-[8px] rounded-full"
          style={{ width: `${30 + ((index * 9) % 26)}%` }}
        />
      </div>
    </motion.div>
  ));
}

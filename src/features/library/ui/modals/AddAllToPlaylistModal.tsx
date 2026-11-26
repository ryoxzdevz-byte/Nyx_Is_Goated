import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AddLine,
  CheckLine,
  CloseCircleFill,
  PlaylistFill,
  Search2Line,
} from "@mingcute/react";
import { useToast } from "@/shared/ui";
import TextInput from "@/shared/ui/TextInput";
import Dialog from "@/shared/ui/Dialog";
import { DialogActions, DialogButton } from "@/shared/ui";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import { isLocalTrackId } from "@/shared/media/local/localTrackIds";
import { usePlaylistsList } from "../../hooks";
import { addTracksToPlaylist } from "../../services/import/manager/finalizeImport";
import { useModalStore } from "../../store/modalStore";

export default function AddAllToPlaylistModal() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const open = useModalStore((state) => state.addAllOpen);
  const source = useModalStore((state) => state.addAllSource);
  const close = useModalStore((state) => state.closeAddAll);
  const openCreatePlaylist = useModalStore((state) => state.openCreatePlaylist);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: playlistData } = usePlaylistsList();
  const playlists = useMemo(() => {
    const all = playlistData?.playlists ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return all;
    return all.filter(
      (playlist) =>
        playlist.title.toLowerCase().includes(query) ||
        (playlist.description
          ? playlist.description.toLowerCase().includes(query)
          : false),
    );
  }, [playlistData?.playlists, searchQuery]);

  const tracks = useMemo(() => {
    const seen = new Set<string>();
    const result: NonNullable<typeof source>["tracks"] = [];
    for (const track of source?.tracks ?? []) {
      if (!track?.id || isLocalTrackId(track.id) || seen.has(track.id))
        continue;
      seen.add(track.id);
      result.push(track);
    }
    return result;
  }, [source?.tracks]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearchQuery("");
      setBusy(false);
    }
  }, [open]);

  const togglePlaylist = useCallback((playlistId: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  }, []);

  const handleAddAll = async () => {
    if (!source || selected.size === 0 || busy) {
      if (selected.size === 0 && !busy) {
        toast(t("collection.add_all_no_selection"), "info");
      }
      return;
    }
    setBusy(true);
    let added = 0;
    let failed = 0;
    try {
      for (const playlistId of selected) {
        try {
          added += await addTracksToPlaylist(playlistId, tracks);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        toast(t("common.failed_add_playlist"), "error");
      } else {
        toast(
          t("collection.add_all_success", {
            count: added,
            playlists: selected.size,
          }),
          "checkmark",
          { description: source.title },
        );
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  const allSelected =
    playlists.length > 0 &&
    playlists.every((playlist) => selected.has(playlist.id));

  const handleToggleAll = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allSelected) {
        for (const playlist of playlists) next.delete(playlist.id);
      } else {
        for (const playlist of playlists) next.add(playlist.id);
      }
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next && !busy ? close() : undefined)}
      maxWidth={420}
    >
      <div className="flex flex-col gap-[12px] px-[12px] pb-[12px]">
        <div className="px-[8px] pt-[4px]">
          <h2 className="m-0 text-heading font-[600] tracking-[-0.01em] text-text-primary">
            {t("collection.add_all_to_playlist")}
          </h2>
          {source && (
            <>
              <div className="mt-[10px] flex items-center gap-[10px] rounded-control bg-bg-elevated/60 px-[10px] py-[8px]">
                <div className="relative h-[40px] w-[40px] shrink-0 overflow-hidden rounded-control bg-bg-elevated flex items-center justify-center">
                  {source.coverUrl ? (
                    <CoverImage
                      src={source.coverUrl}
                      alt={source.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-title font-[600] text-text-tertiary">
                      {source.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                  <span className="truncate text-body font-[500] text-text-primary">
                    {source.title}
                  </span>
                  <span className="truncate text-caption text-text-tertiary">
                    {source.artists ||
                      t("collection.add_all_hint", {
                        count: tracks.length,
                      })}
                  </span>
                </div>
              </div>
              <p className="mb-0 mt-[8px] text-caption text-text-tertiary">
                {t("collection.add_all_hint", { count: tracks.length })}
              </p>
            </>
          )}
        </div>

        {playlists.length >= 5 && (
          <div className="px-[8px]">
            <TextInput
              size="sm"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("library.search_playlists")}
              icon={<Search2Line size={16} />}
              rightSlot={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="border-none bg-transparent p-0 text-text-tertiary hover:text-text-primary cursor-pointer flex items-center justify-center"
                  >
                    <CloseCircleFill size={15} />
                  </button>
                ) : null
              }
              className="!h-[36px] w-full rounded-control !border-transparent bg-bg-elevated text-body"
            />
          </div>
        )}

        <div className="flex items-center justify-between px-[8px]">
          <button
            type="button"
            onClick={handleToggleAll}
            disabled={busy || playlists.length === 0}
            className="border-none bg-transparent p-0 text-caption text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50"
          >
            {allSelected
              ? t("collection.clear_selection")
              : t("collection.select_all")}
          </button>
          <span className="text-caption tabular-nums text-text-tertiary">
            {t("collection.add_all_selected", { count: selected.size })}
          </span>
        </div>

        <div className="flex flex-col gap-[2px] max-h-[300px] overflow-y-auto px-[4px]">
          {playlists.length > 0 ? (
            playlists.map((playlist) => {
              const isSelected = selected.has(playlist.id);
              return (
                <button
                  key={playlist.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={isSelected}
                  onClick={() => togglePlaylist(playlist.id)}
                  className="flex items-center gap-[12px] p-[8px] rounded-control transition-colors hover:bg-bg-elevated active:bg-border-alpha-14 text-left w-full border-none bg-transparent cursor-pointer disabled:opacity-50"
                >
                  <div className="relative h-[44px] w-[44px] rounded-lg bg-bg-elevated overflow-hidden shrink-0 flex items-center justify-center">
                    {playlist.coverUrl ? (
                      <CoverImage
                        src={playlist.coverUrl}
                        alt={playlist.title}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <PlaylistFill size={20} className="text-text-tertiary" />
                    )}
                  </div>
                  <div className="flex flex-col gap-[1px] min-w-0 flex-1">
                    <span className="text-body font-[500] text-text-primary truncate">
                      {playlist.title}
                    </span>
                    <span className="text-caption text-text-tertiary tabular-nums">
                      {t("common.tracks", { count: playlist.trackCount })}
                    </span>
                  </div>
                  <span
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? "border-accent bg-accent text-white"
                        : "border-border-alpha-33 text-text-tertiary"
                    }`}
                  >
                    {isSelected ? (
                      <CheckLine size={16} />
                    ) : (
                      <AddLine size={16} />
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="mx-[8px] flex flex-col items-center gap-[8px] rounded-control bg-bg-elevated/60 px-[12px] py-[24px] text-center">
              <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-bg-elevated text-text-tertiary">
                <PlaylistFill size={18} />
              </span>
              <p className="m-0 text-body text-text-secondary">
                {searchQuery
                  ? t("common.try_another_search_clear")
                  : t("common.no_playlists_yet")}
              </p>
            </div>
          )}
        </div>

        <div className="px-[8px] pb-[8px]">
          <DialogActions>
            <DialogButton
              variant="primary"
              loading={busy}
              disabled={selected.size === 0 || tracks.length === 0}
              onClick={() => void handleAddAll()}
            >
              {t("collection.add_all_action")}
            </DialogButton>
            <DialogButton
              type="button"
              disabled={busy}
              onClick={() => {
                close();
                openCreatePlaylist();
              }}
            >
              {t("library.create_playlist")}
            </DialogButton>
          </DialogActions>
        </div>
      </div>
    </Dialog>
  );
}

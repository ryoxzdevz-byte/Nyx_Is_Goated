import { useMemo } from "react";
import { isTrackLikedNow, useLikedTracks } from "./useLikedTracks";

export function useIsTrackLiked(trackId: string | undefined): boolean {
  const { data } = useLikedTracks();
  return useMemo(() => {
    if (!trackId) return false;
    if (isTrackLikedNow(trackId)) return true;
    return Boolean(data?.tracks?.some((t) => t.id === trackId));
  }, [trackId, data]);
}

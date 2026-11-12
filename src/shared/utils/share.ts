// base url of the legacy share-link redirector (kept for connectivity checks)
export const SHARE_BASE_URL = "https://link.tryliner.fun";

export type ShareEntityType = "artist" | "album" | "playlist" | "track";

// build a direct Nyx deeplink so shared entities open in Nyx, not Liner
export function buildShareUrl(type: ShareEntityType, id: string): string {
  return `nyx://${type}?id=${encodeURIComponent(id)}`;
}

export const DEFAULT_PRIMARY_API = "https://api.tryliner.fun";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isSecureBaseUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" ||
      (protocol === "http:" && LOOPBACK_HOSTS.has(hostname))
    );
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl(envUrl: string | undefined): string {
  const clean = envUrl?.trim().replace(/\/+$/, "");
  return clean && isSecureBaseUrl(clean) ? clean : DEFAULT_PRIMARY_API;
}

const injectedBaseUrl =
  typeof window !== "undefined"
    ? (window as Window & { __NYX_API_BASE__?: string }).__NYX_API_BASE__
    : undefined;

const baseUrl = resolveApiBaseUrl(
  injectedBaseUrl || (import.meta.env.VITE_API_URL as string | undefined),
);

export function getApiBaseUrl(): string {
  return baseUrl;
}

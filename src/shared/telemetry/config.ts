/**
 * Client Telemetry & Metrics Configuration for Nyx.
 * Nyx never sends telemetry or crash reports anywhere.
 */

export interface TelemetryConfig {
  /** Master switch for client telemetry and crash reporting */
  enabled: boolean;
  /** Ingestion endpoint for batch UI actions, network stats, and performance events */
  ingestUrl: string;
  /** Ingestion endpoint for uncaught exceptions and crashes */
  errorUrl: string;
  /** Max items before flushing queue immediately */
  batchSize: number;
  /** Periodic flush interval in milliseconds */
  flushIntervalMs: number;
}

const DEFAULT_INGEST_URL = "";
const DEFAULT_ERROR_URL = "";

const STORAGE_KEY = "liner_telemetry_opt_in";

let isEnabled = false;

export const telemetryConfig: TelemetryConfig = {
  get enabled() {
    return isEnabled;
  },
  set enabled(val: boolean) {
    isEnabled = val;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(val));
      }
    } catch {}
  },
  ingestUrl: DEFAULT_INGEST_URL,
  errorUrl: DEFAULT_ERROR_URL,
  batchSize: 10,
  flushIntervalMs: 3000,
};

/**
 * Convenient 1-line runtime switch to toggle client telemetry.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  telemetryConfig.enabled = enabled;
}

export function isTelemetryEnabled(): boolean {
  return telemetryConfig.enabled;
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setConnectivityHooks,
  useConnectivityStore,
} from "./connectivityStore";

vi.mock("../lib/diagnostics", () => ({
  runAllChecks: vi.fn().mockResolvedValue({ checks: [], main: null }),
  DIAG_ENDPOINTS: {
    api: "https://api.tryliner.fun",
    covers: "https://covers.tryliner.fun",
    link: "https://link.tryliner.fun",
  },
}));

describe("connectivityStore trip logic", () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
    vi.useFakeTimers();
  });

  it("trips the wall on 3 distinct failures inside a minute", () => {
    const { recordFailure } = useConnectivityStore.getState();
    const paths = ["/v1/me", "/v1/library/tracks", "/v1/search"];
    paths.forEach((path, index) => {
      recordFailure({ method: "GET", path, latencyMs: 5 });
      expect(useConnectivityStore.getState().tripped).toBe(index === 2);
    });
    const state = useConnectivityStore.getState();
    expect(state.visible).toBe(true);
    expect(state.failures).toHaveLength(3);
  });

  it("does not count repeated failures for the same endpoint", () => {
    const { recordFailure } = useConnectivityStore.getState();
    for (let i = 0; i < 5; i++) {
      recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    }
    expect(useConnectivityStore.getState().failures).toHaveLength(1);
    expect(useConnectivityStore.getState().tripped).toBe(false);
  });

  it("ignores track playback and lyrics failures without tripping", () => {
    const { recordFailure } = useConnectivityStore.getState();
    recordFailure({
      method: "POST",
      path: "/v1/tracks/trk_1/playback",
      latencyMs: 50,
    });
    recordFailure({
      method: "POST",
      path: "/v1/tracks/trk_2/playback",
      latencyMs: 50,
    });
    recordFailure({
      method: "POST",
      path: "/v1/tracks/trk_3/playback",
      latencyMs: 50,
    });
    recordFailure({
      method: "GET",
      path: "/v1/tracks/trk_1/lyrics",
      latencyMs: 50,
    });
    recordFailure({
      method: "GET",
      path: "/v1/playback/sess_123/media",
      latencyMs: 50,
    });

    const state = useConnectivityStore.getState();
    expect(state.tripped).toBe(false);
    expect(state.visible).toBe(false);
    expect(state.failures).toHaveLength(0);
  });

  it("lets old failures age out of the window", () => {
    const store = useConnectivityStore.getState();
    store.recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    store.recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    vi.advanceTimersByTime(61_000);
    useConnectivityStore
      .getState()
      .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    useConnectivityStore
      .getState()
      .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    expect(useConnectivityStore.getState().tripped).toBe(false);
  });

  it("caps the failure log", () => {
    for (let i = 0; i < 30; i++) {
      useConnectivityStore
        .getState()
        .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 1 });
    }
    expect(useConnectivityStore.getState().failures.length).toBeLessThanOrEqual(
      20,
    );
  });
});

describe("connectivityStore hooks", () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
  });

  it("ignores failures while suppressed", () => {
    setConnectivityHooks({ suppress: () => true, onTrip: vi.fn() });
    for (let i = 0; i < 5; i++)
      useConnectivityStore
        .getState()
        .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 1 });
    expect(useConnectivityStore.getState().failures).toHaveLength(0);
    setConnectivityHooks(null);
  });

  it("keeps the wall hidden when the trip handler takes over", async () => {
    const onTrip = vi.fn().mockResolvedValue("handled");
    setConnectivityHooks({ suppress: () => false, onTrip });
    for (const path of ["/v1/me", "/v1/library/tracks", "/v1/search"])
      useConnectivityStore
        .getState()
        .recordFailure({ method: "GET", path, latencyMs: 1 });
    await vi.waitFor(() => expect(onTrip).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    const state = useConnectivityStore.getState();
    expect(state.visible).toBe(false);
    expect(state.tripped).toBe(false);
    setConnectivityHooks(null);
  });

  it("shows the wall when the trip handler asks for it", async () => {
    setConnectivityHooks({
      suppress: () => false,
      onTrip: vi.fn().mockResolvedValue("show"),
    });
    for (const path of ["/v1/me", "/v1/library/tracks", "/v1/search"])
      useConnectivityStore
        .getState()
        .recordFailure({ method: "GET", path, latencyMs: 1 });
    await vi.waitFor(() =>
      expect(useConnectivityStore.getState().visible).toBe(true),
    );
    setConnectivityHooks(null);
  });
});

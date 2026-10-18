import { beforeEach, describe, expect, it } from "vitest";
import { createHomeDataModeStore, HOME_DATA_MODE_KEY } from "@/lib/home-data-mode";
beforeEach(() => sessionStorage.clear());
describe("homepage-only data preference", () => {
  it("defaults to Real, persists Demo across navigation and refresh for the same identity", () => {
    const store = createHomeDataModeStore(() => sessionStorage);
    expect(store.getSnapshot().mode).toBe("real");
    store.identify(null);
    store.select("synthetic");
    expect(store.getSnapshot().mode).toBe("synthetic");
    const refresh = createHomeDataModeStore(() => sessionStorage);
    refresh.identify(null);
    expect(refresh.getSnapshot().mode).toBe("synthetic");
  });
  it("resets on logout, including a later login of the same user", () => {
    const store = createHomeDataModeStore(() => sessionStorage);
    store.identify("alex");
    store.select("synthetic");
    store.signedOut();
    store.identify("alex");
    expect(store.getSnapshot()).toEqual({ owner: "alex", mode: "real" });
  });
  it("resets when the account changes or the saved preference belongs to another identity", () => {
    const store = createHomeDataModeStore(() => sessionStorage);
    store.identify("alex");
    store.select("synthetic");
    store.identify("jordan");
    expect(store.getSnapshot().mode).toBe("real");
    sessionStorage.setItem(
      HOME_DATA_MODE_KEY,
      JSON.stringify({ owner: "alex", mode: "synthetic" }),
    );
    const refresh = createHomeDataModeStore(() => sessionStorage);
    refresh.identify("jordan");
    expect(refresh.getSnapshot().mode).toBe("real");
  });
  it("keeps working when sessionStorage is unavailable and ignores invalid persisted data", () => {
    const store = createHomeDataModeStore(() => {
      throw new Error("blocked");
    });
    store.identify(null);
    store.select("synthetic");
    expect(store.getSnapshot().mode).toBe("synthetic");
    sessionStorage.setItem(HOME_DATA_MODE_KEY, "invalid");
    const bad = createHomeDataModeStore(() => sessionStorage);
    bad.identify(null);
    expect(bad.getSnapshot().mode).toBe("real");
  });
});

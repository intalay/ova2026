export type HomeDataMode = "real" | "synthetic";
export const HOME_DATA_MODE_KEY = "ova-home-data-mode:v1";
export const REAL_HOME_SNAPSHOT = {
  owner: undefined as string | null | undefined,
  mode: "real" as HomeDataMode,
};

/** A tab-scoped presentation preference; never changes identity or Results queries. */
export function createHomeDataModeStore(storage: () => Storage | undefined) {
  let snapshot = REAL_HOME_SNAPSHOT;
  const listeners = new Set<() => void>();
  const publish = (owner: string | null, mode: HomeDataMode) => {
    if (snapshot.owner === owner && snapshot.mode === mode) return;
    snapshot = { owner, mode };
    try {
      storage()?.setItem(HOME_DATA_MODE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Memory fallback. */
    }
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    identify(owner: string | null) {
      if (snapshot.owner === owner) return;
      let mode: HomeDataMode = "real";
      if (snapshot.owner === undefined) {
        try {
          const saved = JSON.parse(storage()?.getItem(HOME_DATA_MODE_KEY) ?? "null");
          if (saved?.owner === owner && saved?.mode === "synthetic") mode = "synthetic";
        } catch {
          /* Ignore unavailable or invalid storage. */
        }
      }
      publish(owner, mode);
    },
    select(mode: HomeDataMode) {
      if (snapshot.owner !== undefined) publish(snapshot.owner, mode);
    },
    signedOut() {
      publish(null, "real");
    },
  };
}

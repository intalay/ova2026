import { useEffect, useSyncExternalStore } from "react";
import { createHomeDataModeStore, REAL_HOME_SNAPSHOT } from "@/lib/home-data-mode";

const store = createHomeDataModeStore(() =>
  typeof window === "undefined" ? undefined : window.sessionStorage,
);
export function useHomeDataMode(identity: { user: { id: string } | null; ready?: boolean }) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => REAL_HOME_SNAPSHOT,
  );
  const owner = identity.user?.id ?? null;
  useEffect(() => {
    if (identity.ready) store.identify(owner);
  }, [identity.ready, owner]);
  return {
    mode: snapshot.owner === owner ? snapshot.mode : ("real" as const),
    setMode: store.select,
    ready: Boolean(identity.ready && snapshot.owner === owner),
  };
}

/** Used by the shared identity boundary before publishing a different account. */
export function resetHomeDataMode() {
  store.signedOut();
}

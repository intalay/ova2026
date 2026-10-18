import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createHomeDataModeStore, REAL_HOME_SNAPSHOT } from "@/lib/home-data-mode";

const store = createHomeDataModeStore(() =>
  typeof window === "undefined" ? undefined : window.sessionStorage,
);
let observingAuth = false;
function observeAuth() {
  if (observingAuth) return;
  observingAuth = true;
  // Remains active across Account navigation so sign-out always clears the preference.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") store.signedOut();
    else if (event === "SIGNED_IN" || event === "INITIAL_SESSION")
      store.identify(session?.user.id ?? null);
  });
}
export function useHomeDataMode(identity: { user: { id: string } | null; ready?: boolean }) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => REAL_HOME_SNAPSHOT,
  );
  const owner = identity.user?.id ?? null;
  useEffect(() => {
    observeAuth();
    if (identity.ready) store.identify(owner);
  }, [identity.ready, owner]);
  return {
    mode: snapshot.owner === owner ? snapshot.mode : ("real" as const),
    setMode: store.select,
    ready: Boolean(identity.ready && snapshot.owner === owner),
  };
}

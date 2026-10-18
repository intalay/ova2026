import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { resetHomeDataMode } from "@/hooks/use-home-data-mode";
import { supabase } from "@/integrations/supabase/client";

type SessionIdentity = { user: User | null; ready: boolean };
const SessionContext = createContext<SessionIdentity & { signOut: () => Promise<void> }>({
  user: null,
  ready: false,
  signOut: async () => {},
});

// Unknown query types are private by default. Competition contains public rows only.
const publicQueries = new Set([
  "venue",
  "results-page",
  "results-filters",
  "team-results-history",
  "cbc-watch-streams",
]);
export function clearPrivateSessionData(qc: QueryClient, resetHomePreview = true) {
  if (resetHomePreview) resetHomeDataMode();
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      !(query.queryKey[0] === "competition" && query.queryKey[1] === "public") &&
      !publicQueries.has(String(query.queryKey[0])),
  };
  void qc.cancelQueries(filters);
  qc.removeQueries(filters);
  qc.getMutationCache().clear();
  // Initial hydration clears private caches, while an unchanged identity keeps its preferences.
  if (!resetHomePreview) return;
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (
        key.startsWith("ova-browse:") ||
        key.startsWith("coach-approved-") ||
        key.startsWith("ova-family-preview:") ||
        key === "ova-role"
      )
        sessionStorage.removeItem(key);
    }
  } catch {
    /* storage is optional */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [identity, setIdentity] = useState<SessionIdentity>({ user: null, ready: false });
  const [boundary, setBoundary] = useState(0);
  const current = useRef<SessionIdentity>(identity);
  const revision = useRef(0);
  const locallySignedOut = useRef(false);
  async function signOut() {
    revision.current += 1;
    locallySignedOut.current = true;
    clearPrivateSessionData(qc);
    setBoundary((value) => value + 1);
    current.current = { user: null, ready: true };
    setIdentity(current.current);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  useEffect(() => {
    let active = true;
    function accept(user: User | null, signedOut = false) {
      if (!active) return;
      const previous = current.current;
      if (!previous.ready || signedOut || previous.user?.id !== user?.id)
        clearPrivateSessionData(qc, previous.ready || signedOut);
      if (previous.user && previous.user.id !== user?.id) setBoundary((value) => value + 1);
      current.current = { user, ready: true };
      setIdentity(current.current);
    }
    const initialRevision = revision.current;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // getUser verifies initial hydration; a stale storage snapshot must not replace it.
      if (event === "INITIAL_SESSION") return;
      revision.current += 1;
      if (event === "SIGNED_IN") locallySignedOut.current = false;
      if (event === "SIGNED_OUT") locallySignedOut.current = true;
      if (locallySignedOut.current && event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      accept(event === "SIGNED_OUT" ? null : (session?.user ?? null), event === "SIGNED_OUT");
    });
    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (active && revision.current === initialRevision)
          accept(error ? null : data.user, !!error);
      })
      .catch(() => {
        if (active && revision.current === initialRevision) accept(null, true);
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [qc]);
  // Account changes discard local drafts, signed attachment URLs and selected objects too.
  return (
    <SessionContext.Provider value={{ ...identity, signOut }}>
      <Fragment key={boundary}>{children}</Fragment>
    </SessionContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionContext);
}

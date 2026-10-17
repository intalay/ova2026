import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSessionUser() {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => { setUser(s?.user ?? null); if (event === "SIGNED_IN" || event === "SIGNED_OUT") { if (event === "SIGNED_OUT") qc.removeQueries({queryKey:["household"]}); void qc.invalidateQueries({queryKey:["competition"]}); } });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return { user, ready };
}

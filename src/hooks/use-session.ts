import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

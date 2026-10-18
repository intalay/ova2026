import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readAllPages } from "./paged-read";

/** Private announcement rows never enter the shared competition cache. */
export const teamAnnouncementsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["team-announcements", userId],
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error("Sign in required");
      const rows = await readAllPages(
        (from, to) =>
          supabase
            .from("announcements")
            .select("*", { count: "exact" })
            .eq("status", "published")
            .not("team_id", "is", null)
            .order("published_at", { ascending: false })
            .order("id")
            .range(from, to)
            .abortSignal(signal),
        "Team announcements",
      );
      signal.throwIfAborted();
      return rows;
    },
  });

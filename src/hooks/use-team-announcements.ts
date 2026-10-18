import { useQuery } from "@tanstack/react-query";
import { teamAnnouncementsQuery } from "@/lib/team-announcements";

export function useTeamAnnouncements(userId: string | undefined) {
  return useQuery(teamAnnouncementsQuery(userId));
}

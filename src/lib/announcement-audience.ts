// Explicit null is the community audience. Never substitute a team for it.
export function canManageAnnouncement(
  userId: string | undefined,
  staff: boolean,
  managedTeams: string[],
  announcement: { author_id: string | null; team_id: string | null },
): boolean {
  return (
    !!userId &&
    (staff ||
      (announcement.author_id === userId &&
        announcement.team_id !== null &&
        managedTeams.includes(announcement.team_id)))
  );
}
export function canPublishToAudience(
  userId: string | undefined,
  staff: boolean,
  managedTeams: string[],
  teamId: string | null | undefined,
): boolean {
  return (
    !!userId &&
    (teamId === null ? staff : teamId !== undefined && (staff || managedTeams.includes(teamId)))
  );
}

import { Card, Section } from "@/components/AppShell";
import type { Household } from "@/lib/queries";

export function rememberFamilyInvitation(
  userId: string,
  playerId: string,
  playerName: string | undefined,
  teamName: string,
) {
  try {
    sessionStorage.setItem(
      `ova-family-preview:${userId}:${playerId}`,
      JSON.stringify({ playerName, teamName }),
    );
  } catch {
    /* optional label only */
  }
}

export function FamilyConnections({
  household,
  teams,
  userId,
}: {
  household: Household | undefined;
  teams: { id: string; name: string }[];
  userId: string;
}) {
  if (!household?.familyLinks.length) return null;
  return (
    <Section title="Family & Friends connections">
      <div className="space-y-3">
        {household.familyLinks.map((link) => {
          const player =
            household.visiblePlayers.find((p) => p.id === link.player_id) ??
            household.linkedPlayers.find((p) => p.id === link.player_id);
          let invitation: { playerName?: string; teamName?: string } = {};
          try {
            invitation = JSON.parse(
              sessionStorage.getItem(`ova-family-preview:${userId}:${link.player_id}`) ?? "{}",
            );
          } catch {
            /* optional */
          }
          const team = teams.find((t) => t.id === player?.team_id);
          return (
            <Card key={link.id}>
              <h3 className="text-xl font-semibold">
                {player?.display_name ??
                  invitation?.playerName ??
                  "Player details available after approval"}
              </h3>
              <p className="break-all text-sm text-muted-foreground">Player ID: {link.player_id}</p>
              <p>
                {team?.name ?? invitation?.teamName ?? "Team to be determined"}
                {player?.team_id ? ` · Team ID: ${player.team_id}` : ""}
              </p>
              {!player && invitation?.teamName && (
                <p className="text-sm text-muted-foreground">
                  Name and team from your invitation preview
                </p>
              )}
              <p className="mt-2 font-semibold">
                {link.status === "approved"
                  ? "Approved"
                  : link.status === "pending"
                    ? "Pending player approval"
                    : link.status === "rejected"
                      ? "Request rejected"
                      : "Status to be determined"}
              </p>
              <p className="text-sm">
                {link.status === "approved"
                  ? "Private access depends on your player's current verification."
                  : link.status === "pending"
                    ? "Your player must approve this request before private team access is available."
                    : "Ask this player for a new invitation to submit another request."}
              </p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

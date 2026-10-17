import type { AppRole } from './modules';

type AccountIdentity = {
 self: { status: string } | null;
 managedTeams: string[];
};

export function approvedFamilyPlayerIds(links: { player_id: string; status: string }[]): Set<string> {
 return new Set(links.filter(link => link.status === 'approved').map(link => link.player_id));
}

// Presentation only: code creation is still authorized by the existing RPCs.
export function accountCodeKind(requested: AppRole, identity: AccountIdentity | undefined): 'TEAM' | 'FAMILY' | null {
 if (!identity) return null;
 const player = identity.self?.status === 'verified';
 const coach = identity.managedTeams.length > 0;
 if (requested === 'coach' && coach) return 'TEAM';
 if (requested === 'player' && player) return 'FAMILY';
 if (player) return 'FAMILY';
 if (coach) return 'TEAM';
 return null;
}
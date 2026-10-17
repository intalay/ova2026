import type { AppRole } from './modules';

type AccountIdentity = {
 self: { status: string } | null;
 managedTeams: string[];
};

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
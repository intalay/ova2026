import { describe, expect, it } from 'vitest';
import { accountCodeKind, approvedFamilyPlayerIds } from '@/lib/account';

describe('verified Account code entry', () => {
 it('redeeming a family invitation does not unlock a pending relationship', () => {
  expect([...approvedFamilyPlayerIds([{ player_id: 'pending-player', status: 'pending' }])]).toEqual([]);
 });
 it('a rejected family request cannot unlock private player information', () => {
  expect([...approvedFamilyPlayerIds([{ player_id: 'rejected-player', status: 'rejected' }])]).toEqual([]);
 });
 it('only player-approved family relationships unlock the linked player', () => {
  expect([...approvedFamilyPlayerIds([{ player_id: 'approved-player', status: 'approved' }, { player_id: 'pending-player', status: 'pending' }])]).toEqual(['approved-player']);
 });
 it('verified players get family codes without choosing their role again', () => {
  expect(accountCodeKind('general_user', { self: { status: 'verified' }, managedTeams: [] })).toBe('FAMILY');
 });
 it('approved managing coaches get team codes without choosing their role again', () => {
  expect(accountCodeKind('general_user', { self: null, managedTeams: ['team-1'] })).toBe('TEAM');
 });
 it('unverified players cannot open the family code generator', () => {
  expect(accountCodeKind('player', { self: { status: 'pending' }, managedTeams: [] })).toBeNull();
 });
 it('a selected coach identity alone cannot open the team generator', () => {
  expect(accountCodeKind('coach', { self: null, managedTeams: [] })).toBeNull();
 });
 it('accounts with both verified identities get only the current identity code type', () => {
  const identity = { self: { status: 'verified' }, managedTeams: ['team-1'] };
  expect(accountCodeKind('player', identity)).toBe('FAMILY');
  expect(accountCodeKind('coach', identity)).toBe('TEAM');
 });
});
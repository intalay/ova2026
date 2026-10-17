import { describe, expect, it } from 'vitest';
import { accountCodeKind } from '@/lib/account';

describe('verified Account code entry', () => {
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
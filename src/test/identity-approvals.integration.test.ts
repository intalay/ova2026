import { describe, it, expect, beforeAll } from 'vitest';
import postgres from 'postgres';

const connection = process.env['SUPABASE_DB_URL'];
describe.skipIf(!connection)('owner identity approvals (rolled back database fixtures)', () => {
 let canAuthenticate = false;
 beforeAll(async () => {
  if (!connection) return;
  const sql = postgres(connection, { max: 1, prepare: false });
  try { canAuthenticate = (await sql`select pg_has_role(current_user,'authenticated','MEMBER') as allowed`)[0]?.['allowed'] === true; }
  finally { await sql.end({ timeout: 3 }); }
 });
 it('coach approval removes player pending; only player approval unlocks family access', async context => {
  // Never widen production function grants just to make the test account privileged.
  if (!canAuthenticate) { context.skip(); return; }
  if (!connection) return;
  const sql = postgres(connection, { max: 1, prepare: false });
  const rollback = new Error('rollback successful test fixtures');
  try {
   await sql.begin(async tx => {
    const users = await tx`select id from public.profiles order by created_at limit 3`;
    const coach = users[0]?.['id']; const playerUser = users[1]?.['id']; const familyUser = users[2]?.['id'];
    if (!coach || !playerUser || !familyUser) throw new Error('Three existing auth accounts are required for this isolated test');
    const team = `approval-test-${crypto.randomUUID()}`;
    await tx`insert into public.teams(id,name,season,data_mode) values(${team},'Synthetic approval test','test','synthetic')`;
    await tx`insert into public.managed_teams(user_id,team_id) values(${coach},${team})`;
    const asUser = async (id: string) => {
     await tx`reset role`;
     await tx`select set_config('request.jwt.claim.sub',${id},true)`;
     await tx`set local role authenticated`;
    };
    await asUser(coach);
    const teamCode = (await tx`select public.create_team_code(${team}) as result`)[0]?.['result']?.code;
    expect(typeof teamCode).toBe('string');
    await asUser(playerUser);
    await tx`select public.redeem_code(${teamCode},'Synthetic player','family')`;
    await tx`select public.update_player_registration('Synthetic player','12')`;
    const player = (await tx`select id,status from public.players where user_id=${playerUser}`)[0];
    expect(player?.['status']).toBe('pending');
    expect((await tx`select public.can_view_team(${playerUser},${team}) as allowed`)[0]?.['allowed']).toBe(false);
    await asUser(coach);
    await tx`select public.verify_player(${player?.['id']},'verified')`;
    expect((await tx`select status from public.players where id=${player?.['id']}`)[0]?.['status']).toBe('verified');
    await asUser(playerUser);
    const familyCode = (await tx`select public.create_family_code(${player?.['id']}) as result`)[0]?.['result']?.code;
    await asUser(familyUser);
    await tx`select public.redeem_code(${familyCode},'Synthetic family member','parent')`;
    const link = (await tx`select id,status from public.family_links where family_user_id=${familyUser} and player_id=${player?.['id']}`)[0];
    // Isolate any pre-existing association without changing it outside this transaction.
    await tx`reset role`;
    await tx`update public.family_links set status='pending' where id=${link?.['id']}`;
    await asUser(familyUser);
    expect((await tx`select public.can_view_player(${familyUser},${player?.['id']}) as allowed`)[0]?.['allowed']).toBe(false);
    expect((await tx`select public.can_view_team(${familyUser},${team}) as allowed`)[0]?.['allowed']).toBe(false);
    await expect(tx.savepoint(async sp => { await sp`select public.review_family_request(${link?.['id']},true)`; })).rejects.toThrow('Only this verified player');
    await asUser(coach);
    await expect(tx.savepoint(async sp => { await sp`select public.review_family_request(${link?.['id']},true)`; })).rejects.toThrow('Only this verified player');
    await asUser(playerUser);
    expect((await tx`select * from public.family_approval_requests()`).some(r => r['id'] === link?.['id'])).toBe(true);
    await tx`select public.review_family_request(${link?.['id']},true)`;
    expect((await tx`select status from public.family_links where id=${link?.['id']}`)[0]?.['status']).toBe('approved');
    expect((await tx`select public.can_view_player(${familyUser},${player?.['id']}) as allowed`)[0]?.['allowed']).toBe(true);
    expect((await tx`select public.can_view_team(${familyUser},${team}) as allowed`)[0]?.['allowed']).toBe(true);
    await expect(tx.savepoint(async sp => { await sp`select public.review_family_request(${link?.['id']},true)`; })).rejects.toThrow('already been reviewed');
    throw rollback;
   });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.end({ timeout: 3 }); }
 }, 30000);
});
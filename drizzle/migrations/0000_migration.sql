
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin','staff','coach','player','family');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('staff','admin'))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'family') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Public competition data
create table public.divisions (id text primary key, name text not null, discipline text not null, season text not null, data_mode text not null check (data_mode in ('real','synthetic')));
create table public.teams (id text primary key, name text not null, organization text, division_id text references public.divisions(id), season text not null, data_mode text not null check (data_mode in ('real','synthetic')));
create table public.events (id text primary key, name text not null, division_id text references public.divisions(id), start_date date, end_date date, source_url text, data_mode text not null check (data_mode in ('real','synthetic')));
create table public.venues (id text primary key, name text not null, address text not null, latitude double precision, longitude double precision, coordinates_verified boolean not null default false, source_url text, image_note text, data_mode text not null check (data_mode in ('real','synthetic')));
create table public.parking (id text primary key, venue_id text not null references public.venues(id) on delete cascade, name text not null, address text, coordinates_verified boolean not null default false, source_url text, notes text, data_mode text not null check (data_mode in ('real','synthetic')));
create table public.matches (
  id text primary key, event_id text not null references public.events(id), division_id text not null references public.divisions(id),
  team_a_id text not null references public.teams(id), team_b_id text references public.teams(id),
  venue_id text references public.venues(id), source_date date, starts_at timestamptz, court text,
  status text not null check (status in ('scheduled','final','cancelled')),
  score_a int, score_b int, sets jsonb, data_mode text not null check (data_mode in ('real','synthetic'))
);
create table public.rankings (id text primary key, event_id text not null references public.events(id), division_id text not null references public.divisions(id), team_id text not null references public.teams(id), rank int not null check (rank > 0), field_size int, final_confirmed boolean not null default false, data_mode text not null check (data_mode in ('real','synthetic')));
create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, body text not null, status text not null default 'published' check (status in ('draft','published','archived')), author_id uuid, data_mode text not null default 'synthetic', published_at timestamptz default now(), created_at timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['divisions','teams','events','venues','parking','matches','rankings'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "staff write" on public.%I for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()))', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "published read" on public.announcements for select to anon, authenticated using (status = 'published' or public.is_staff(auth.uid()));
create policy "staff manage" on public.announcements for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Private people data
create table public.players (
  id text primary key default ('player-' || gen_random_uuid()),
  user_id uuid unique, display_name text not null, team_id text references public.teams(id),
  jersey_number text, status text not null default 'pending' check (status in ('pending','verified','rejected')),
  data_mode text not null default 'real' check (data_mode in ('real','synthetic')),
  created_at timestamptz not null default now()
);
create table public.family_links (
  id uuid primary key default gen_random_uuid(), family_user_id uuid not null, player_id text not null references public.players(id) on delete cascade,
  relationship text not null default 'family' check (relationship in ('parent','guardian','family','friend')),
  created_at timestamptz not null default now(), unique (family_user_id, player_id)
);
create table public.managed_teams (id uuid primary key default gen_random_uuid(), user_id uuid not null, team_id text not null references public.teams(id), unique(user_id, team_id));
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(), purpose text not null check (purpose in ('TEAM','FAMILY')),
  code_hash text not null, issuer_user_id uuid not null, team_id text references public.teams(id), player_id text references public.players(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked','consumed','expired')),
  expires_at timestamptz not null, max_uses int, uses int not null default 0, created_at timestamptz not null default now(),
  check ((purpose='TEAM' and team_id is not null and player_id is null) or (purpose='FAMILY' and player_id is not null and team_id is null and max_uses = 1))
);
create unique index invite_active_hash on public.invite_codes(code_hash) where status='active';
create table public.follows (id uuid primary key default gen_random_uuid(), user_id uuid not null, target_type text not null check (target_type in ('team','division')), target_id text not null, created_at timestamptz not null default now(), unique(user_id,target_type,target_id));

create or replace function public.can_view_player(_user uuid, _player text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from players p where p.id=_player and p.user_id=_user)
      or exists(select 1 from family_links f where f.player_id=_player and f.family_user_id=_user)
      or exists(select 1 from players p join managed_teams m on m.team_id=p.team_id where p.id=_player and m.user_id=_user)
      or public.is_staff(_user)
$$;

grant select on public.players, public.family_links, public.managed_teams to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant all on public.players, public.family_links, public.managed_teams, public.invite_codes, public.follows to service_role;
alter table public.players enable row level security;
alter table public.family_links enable row level security;
alter table public.managed_teams enable row level security;
alter table public.invite_codes enable row level security;
alter table public.follows enable row level security;
create policy "linked read" on public.players for select to authenticated using (public.can_view_player(auth.uid(), id));
create policy "own links" on public.family_links for select to authenticated using (family_user_id = auth.uid() or exists(select 1 from players p where p.id=player_id and p.user_id=auth.uid()) or public.is_staff(auth.uid()));
create policy "own managed" on public.managed_teams for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "own follows" on public.follows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- invite_codes: no direct access; only via security definer functions.

create or replace function public.code_hash(_code text) returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(upper(regexp_replace(_code,'[^A-Za-z0-9]','','g')),'sha256'),'hex')
$$;
create or replace function public.new_code() returns text language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 32) + 1, 1), '')
  from (select extensions.gen_random_bytes(10) b) x, generate_series(0,9) i
$$;

create or replace function public.create_team_code(_team text) returns json
language plpgsql security definer set search_path = public as $$
declare c text; exp timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not (public.is_staff(auth.uid()) or exists(select 1 from managed_teams where user_id=auth.uid() and team_id=_team)) then
    raise exception 'Only staff or an approved coach for this team can create a team code'; end if;
  update invite_codes set status='revoked' where purpose='TEAM' and issuer_user_id=auth.uid() and team_id=_team and status='active';
  c := public.new_code();
  insert into invite_codes(purpose, code_hash, issuer_user_id, team_id, expires_at, max_uses) values ('TEAM', public.code_hash(c), auth.uid(), _team, exp, 40);
  return json_build_object('code', c, 'expires_at', exp, 'purpose', 'TEAM');
end $$;

create or replace function public.create_family_code(_player text) returns json
language plpgsql security definer set search_path = public as $$
declare c text; exp timestamptz := now() + interval '48 hours';
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from players where id=_player and user_id=auth.uid() and status='verified') then
    raise exception 'Team verification is required before creating a family code'; end if;
  c := public.new_code();
  insert into invite_codes(purpose, code_hash, issuer_user_id, player_id, expires_at, max_uses) values ('FAMILY', public.code_hash(c), auth.uid(), _player, exp, 1);
  return json_build_object('code', c, 'expires_at', exp, 'purpose', 'FAMILY');
end $$;

create or replace function public.redeem_code(_code text, _display_name text default null, _relationship text default 'family') returns json
language plpgsql security definer set search_path = public as $$
declare inv invite_codes; pid text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into inv from invite_codes where code_hash = public.code_hash(_code) and status='active' for update;
  if inv.id is null or inv.expires_at <= now() or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
    raise exception 'This code has expired, been revoked, or is no longer available'; end if;
  if inv.purpose = 'TEAM' then
    select id into pid from players where user_id = auth.uid();
    if pid is not null then
      update players set team_id = inv.team_id, status = case when team_id = inv.team_id and status='verified' then 'verified' else 'pending' end where id = pid;
    else
      insert into players(user_id, display_name, team_id, status, data_mode)
      values (auth.uid(), coalesce(nullif(trim(_display_name),''), (select display_name from profiles where id=auth.uid()), 'Player'), inv.team_id, 'pending',
              (select data_mode from teams where id=inv.team_id)) returning id into pid;
    end if;
    update invite_codes set uses = uses + 1 where id = inv.id;
    insert into user_roles(user_id, role) values (auth.uid(), 'player') on conflict do nothing;
    return json_build_object('purpose','TEAM','team_id',inv.team_id,'status','pending');
  else
    if _relationship not in ('parent','guardian','family','friend') then _relationship := 'family'; end if;
    if not exists(select 1 from players where id=inv.player_id and status='verified') then raise exception 'This family code is no longer available'; end if;
    if exists(select 1 from players where id=inv.player_id and user_id=auth.uid()) then raise exception 'You cannot link to yourself'; end if;
    insert into family_links(family_user_id, player_id, relationship) values (auth.uid(), inv.player_id, _relationship) on conflict do nothing;
    update invite_codes set uses = 1, status='consumed' where id = inv.id and uses = 0;
    return json_build_object('purpose','FAMILY','player_id',inv.player_id);
  end if;
end $$;

-- Demo only: link the signed-in user to the fictional demo players. Synthetic players only.
create or replace function public.join_synthetic_demo() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into family_links(family_user_id, player_id, relationship)
    select auth.uid(), id, 'family' from players where data_mode='synthetic' and user_id is null on conflict do nothing;
  insert into follows(user_id, target_type, target_id) values (auth.uid(),'team','demo-north'),(auth.uid(),'team','demo-lakeshore') on conflict do nothing;
  return json_build_object('ok', true);
end $$;

create or replace function public.verify_player(_player text, _status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if _status not in ('verified','rejected') then raise exception 'Invalid status'; end if;
  if not (public.is_staff(auth.uid()) or exists(select 1 from players p join managed_teams m on m.team_id=p.team_id where p.id=_player and m.user_id=auth.uid())) then
    raise exception 'Not allowed'; end if;
  update players set status=_status where id=_player;
  if _status='rejected' then update invite_codes set status='revoked' where purpose='FAMILY' and player_id=_player and status='active'; end if;
end $$;

revoke execute on function public.create_team_code(text), public.create_family_code(text), public.redeem_code(text,text,text), public.join_synthetic_demo(), public.verify_player(text,text) from public, anon;
grant execute on function public.create_team_code(text), public.create_family_code(text), public.redeem_code(text,text,text), public.join_synthetic_demo(), public.verify_player(text,text) to authenticated;
revoke execute on function public.code_hash(text), public.new_code() from public, anon, authenticated;

-- Synthetic demonstration seed (fictional)
insert into public.divisions values ('demo-indoor','17U Indoor','indoor','2026','synthetic'),('demo-beach','20U Beach','beach','2026','synthetic');
insert into public.teams values
 ('demo-north','North Stars','Synthetic demonstration club','demo-indoor','2026','synthetic'),
 ('demo-lakeshore','Lakeshore Waves','Synthetic demonstration club','demo-indoor','2026','synthetic'),
 ('demo-east','Eastside Falcons','Synthetic demonstration club','demo-indoor','2026','synthetic'),
 ('demo-west','West End Thunder','Synthetic demonstration club','demo-indoor','2026','synthetic'),
 ('demo-sand','Sand & Sky','Synthetic demonstration club','demo-beach','2026','synthetic'),
 ('demo-sun','Sunset Spikers','Synthetic demonstration club','demo-beach','2026','synthetic');
insert into public.events(id,name,division_id,start_date,end_date,data_mode) values
 ('demo-fall','Fall Invitational · Demo','demo-indoor','2026-10-17','2026-10-18','synthetic'),
 ('demo-beach-event','Beach Weekend · Demo','demo-beach','2026-10-18','2026-10-18','synthetic'),
 ('demo-august','August Invitational · Demo','demo-indoor','2026-08-16','2026-08-16','synthetic'),
 ('demo-september','September Invitational · Demo','demo-indoor','2026-09-20','2026-09-20','synthetic'),
 ('demo-october','October Invitational · Demo','demo-indoor','2026-10-10','2026-10-10','synthetic'),
 ('demo-november','November Invitational · Demo','demo-indoor','2026-11-14',null,'synthetic');
insert into public.venues values ('demo-venue','Enercare Centre','Exhibition Place campus: 100 Princes'' Blvd, Toronto, ON M6K 3C3',43.6342069,-79.4127931,true,'https://www.explace.on.ca/venue/enercare-centre/','Venue photo unavailable. Map point is the official virtual-tour location, not an entrance or parking space.','synthetic');
insert into public.parking values ('demo-parking-850','demo-venue','Enercare Centre Garage (850)',null,false,'https://www.explace.on.ca/visiting-us/getting-here/','The official page names this garage. Exact entrance coordinates, hours, charges and current availability have not been established.','synthetic');
insert into public.matches(id,event_id,division_id,team_a_id,team_b_id,venue_id,source_date,starts_at,court,status,data_mode) values
 ('demo-match-1','demo-fall','demo-indoor','demo-north','demo-east','demo-venue','2026-10-17','2026-10-17T14:00:00Z','Court 1','scheduled','synthetic'),
 ('demo-match-2','demo-fall','demo-indoor','demo-lakeshore','demo-west','demo-venue','2026-10-17','2026-10-17T15:30:00Z','Court 2','scheduled','synthetic'),
 ('demo-match-3','demo-fall','demo-indoor','demo-north','demo-west','demo-venue','2026-10-18','2026-10-18T13:00:00Z','Court 1','scheduled','synthetic'),
 ('demo-match-4','demo-beach-event','demo-beach','demo-sand','demo-sun','demo-venue','2026-10-18','2026-10-18T16:00:00Z','Beach court','scheduled','synthetic'),
 ('demo-match-tbd','demo-fall','demo-indoor','demo-north',null,null,'2026-10-18',null,null,'scheduled','synthetic'),
 ('demo-match-nov','demo-november','demo-indoor','demo-lakeshore',null,null,'2026-11-14',null,null,'scheduled','synthetic');
insert into public.matches(id,event_id,division_id,team_a_id,team_b_id,source_date,starts_at,status,score_a,score_b,sets,data_mode) values
 ('demo-result-aug-1','demo-august','demo-indoor','demo-north','demo-east','2026-08-16','2026-08-16T14:00:00Z','final',2,1,'[{"a":23,"b":25},{"a":25,"b":20},{"a":15,"b":8}]','synthetic'),
 ('demo-result-aug-2','demo-august','demo-indoor','demo-west','demo-north','2026-08-16','2026-08-16T15:00:00Z','final',2,0,'[{"a":25,"b":20},{"a":25,"b":19}]','synthetic'),
 ('demo-result-sep-1','demo-september','demo-indoor','demo-north','demo-east','2026-09-20','2026-09-20T16:00:00Z','final',2,0,'[{"a":25,"b":20},{"a":25,"b":19}]','synthetic'),
 ('demo-result-sep-2','demo-september','demo-indoor','demo-north','demo-lakeshore','2026-09-20','2026-09-20T17:00:00Z','final',2,1,'[{"a":23,"b":25},{"a":25,"b":20},{"a":15,"b":8}]','synthetic'),
 ('demo-result-oct-1','demo-october','demo-indoor','demo-east','demo-north','2026-10-10','2026-10-10T18:00:00Z','final',1,2,'[{"a":25,"b":23},{"a":20,"b":25},{"a":8,"b":15}]','synthetic'),
 ('demo-result-oct-2','demo-october','demo-indoor','demo-lakeshore','demo-west','2026-10-10','2026-10-10T19:00:00Z','final',2,0,'[{"a":25,"b":20},{"a":25,"b":19}]','synthetic');
insert into public.rankings(id,event_id,division_id,team_id,rank,field_size,final_confirmed,data_mode) values
 ('rank-demo-august','demo-august','demo-indoor','demo-north',3,4,true,'synthetic'),
 ('rank-demo-september','demo-september','demo-indoor','demo-north',2,4,true,'synthetic'),
 ('rank-demo-october','demo-october','demo-indoor','demo-north',1,4,true,'synthetic');
insert into public.players(id,display_name,team_id,status,data_mode) values
 ('demo-player','Jordan (demo)','demo-north','verified','synthetic'),
 ('demo-player-two','Taylor (demo)','demo-lakeshore','verified','synthetic');
insert into public.announcements(title,body,status,data_mode) values ('Welcome to the Fall Invitational','Synthetic demonstration announcement. Check the source and update time before travelling.','published','synthetic');

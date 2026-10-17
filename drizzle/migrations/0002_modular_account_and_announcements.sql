CREATE TABLE public.coach_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id), team_id text not null references public.teams(id), status text not null default 'pending' check (status in ('pending','approved','rejected')), created_at timestamptz not null default now());
GRANT SELECT ON public.coach_requests TO authenticated; GRANT ALL ON public.coach_requests TO service_role;
ALTER TABLE public.coach_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own request or staff read" ON public.coach_requests FOR SELECT TO authenticated USING (user_id=auth.uid() or public.is_staff(auth.uid()));
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS team_id text REFERENCES public.teams(id);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS location_name text;
DROP POLICY IF EXISTS "published read" ON public.announcements;
CREATE POLICY "scoped announcement read" ON public.announcements FOR SELECT TO anon, authenticated USING (public.is_staff(auth.uid()) or (author_id=auth.uid()) or (status='published' and (team_id is null or exists(select 1 from public.players p where p.team_id=announcements.team_id and public.can_view_player(auth.uid(),p.id)) or exists(select 1 from public.managed_teams m where m.team_id=announcements.team_id and m.user_id=auth.uid()))));
CREATE POLICY "coach announcement insert" ON public.announcements FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() and team_id is not null and exists(select 1 from public.managed_teams m where m.user_id=auth.uid() and m.team_id=announcements.team_id));
CREATE POLICY "coach announcement update" ON public.announcements FOR UPDATE TO authenticated USING (author_id=auth.uid() and exists(select 1 from public.managed_teams m where m.user_id=auth.uid() and m.team_id=announcements.team_id)) WITH CHECK (author_id=auth.uid() and exists(select 1 from public.managed_teams m where m.user_id=auth.uid() and m.team_id=announcements.team_id));
CREATE OR REPLACE FUNCTION public.preview_pairing_code(_code text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv invite_codes;
BEGIN
IF auth.uid() is null THEN RAISE EXCEPTION 'Sign in required'; END IF;
SELECT * INTO inv FROM invite_codes WHERE code_hash=public.code_hash(_code) AND status='active';
IF inv.id is null or inv.expires_at<=now() or (inv.max_uses is not null and inv.uses>=inv.max_uses) THEN RAISE EXCEPTION 'Invalid or expired code'; END IF;
IF inv.purpose='TEAM' THEN RETURN json_build_object('purpose','TEAM','team_id',inv.team_id,'team_name',(select name from teams where id=inv.team_id)); END IF;
IF NOT EXISTS(select 1 from players where id=inv.player_id and status='verified') THEN RAISE EXCEPTION 'Family code is not available'; END IF;
RETURN json_build_object('purpose','FAMILY','player_name',(select display_name from players where id=inv.player_id),'team_name',(select t.name from teams t join players p on p.team_id=t.id where p.id=inv.player_id));
END $$;
CREATE OR REPLACE FUNCTION public.update_player_registration(_name text,_jersey text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() is null or length(trim(_name))=0 or length(_name)>100 or length(_jersey)>10 THEN RAISE EXCEPTION 'Enter a valid name and jersey number'; END IF;
UPDATE players SET display_name=trim(_name),jersey_number=trim(_jersey),status='pending',review_note=null WHERE user_id=auth.uid();
IF NOT FOUND THEN RAISE EXCEPTION 'Enter a valid team code first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.request_coach_access(_team text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() is null THEN RAISE EXCEPTION 'Sign in required'; END IF;
INSERT INTO coach_requests(user_id,team_id) VALUES(auth.uid(),_team) ON CONFLICT(user_id) DO UPDATE SET team_id=excluded.team_id,status='pending';
END $$;
CREATE OR REPLACE FUNCTION public.review_coach_request(_request uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE req coach_requests; BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only OVA staff can approve coaches'; END IF;
SELECT * INTO req FROM coach_requests WHERE id=_request and status='pending' FOR UPDATE;
IF req.id is null THEN RAISE EXCEPTION 'Request unavailable'; END IF;
UPDATE coach_requests SET status=case when _approve then 'approved' else 'rejected' end WHERE id=req.id;
IF _approve THEN INSERT INTO managed_teams(user_id,team_id) VALUES(req.user_id,req.team_id) ON CONFLICT DO NOTHING; INSERT INTO user_roles(user_id,role) VALUES(req.user_id,'coach') ON CONFLICT DO NOTHING; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.request_player_changes(_player text,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT (public.is_staff(auth.uid()) or exists(select 1 from players p join managed_teams m on m.team_id=p.team_id where p.id=_player and m.user_id=auth.uid())) THEN RAISE EXCEPTION 'Not allowed'; END IF;
IF length(trim(_note))=0 THEN RAISE EXCEPTION 'Provide a modification request'; END IF;
UPDATE players SET status='pending',review_note=trim(_note) WHERE id=_player;
END $$;
REVOKE ALL ON FUNCTION public.preview_pairing_code(text), public.update_player_registration(text,text), public.request_coach_access(text), public.review_coach_request(uuid,boolean), public.request_player_changes(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_pairing_code(text), public.update_player_registration(text,text), public.request_coach_access(text), public.review_coach_request(uuid,boolean), public.request_player_changes(text,text) TO authenticated;
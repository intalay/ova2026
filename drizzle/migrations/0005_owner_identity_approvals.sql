ALTER TABLE public.family_links ADD COLUMN status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.family_links ADD COLUMN reviewed_at timestamptz;
ALTER TABLE public.family_links ADD COLUMN reviewed_by uuid;
ALTER TABLE public.family_links ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.family_links ADD CONSTRAINT family_links_status_check CHECK (status IN ('pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.can_view_player(_user uuid, _player text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM players p WHERE p.id=_player AND p.user_id=_user)
 OR EXISTS(SELECT 1 FROM family_links f JOIN players p ON p.id=f.player_id WHERE f.player_id=_player AND f.family_user_id=_user AND f.status='approved' AND p.status='verified')
 OR EXISTS(SELECT 1 FROM players p JOIN managed_teams m ON m.team_id=p.team_id WHERE p.id=_player AND m.user_id=_user)
 OR public.is_staff(_user);
$$;
CREATE OR REPLACE FUNCTION public.can_view_team(_user uuid, _team text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT public.is_staff(_user) OR EXISTS(SELECT 1 FROM managed_teams WHERE user_id=_user AND team_id=_team)
 OR EXISTS(SELECT 1 FROM players WHERE user_id=_user AND team_id=_team AND status='verified')
 OR EXISTS(SELECT 1 FROM family_links f JOIN players p ON p.id=f.player_id WHERE f.family_user_id=_user AND f.status='approved' AND p.status='verified' AND p.team_id=_team);
$$;
REVOKE ALL ON FUNCTION public.can_view_team(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_team(uuid,text) TO anon,authenticated,service_role;
ALTER POLICY "scoped announcement read" ON public.announcements USING (public.is_staff(auth.uid()) OR author_id=auth.uid() OR (status='published' AND (team_id IS NULL OR public.can_view_team(auth.uid(),team_id))));
ALTER POLICY "scoped attachment reads" ON storage.objects USING (bucket_id='announcement-media' AND ((storage.foldername(name))[2]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.announcements a WHERE a.status='published' AND a.media_urls @> jsonb_build_array(jsonb_build_object('path',objects.name)) AND (a.team_id IS NULL OR public.can_view_team(auth.uid(),a.team_id)))));

CREATE OR REPLACE FUNCTION public.redeem_code(_code text,_display_name text DEFAULT NULL,_relationship text DEFAULT 'family') RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv invite_codes; pid text; link_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF length(_code)>100 OR length(coalesce(_display_name,''))>100 THEN RAISE EXCEPTION 'Invalid invitation details'; END IF;
 SELECT * INTO inv FROM invite_codes WHERE code_hash=public.code_hash(_code) AND status='active' FOR UPDATE;
 IF inv.id IS NULL OR inv.expires_at<=now() OR (inv.max_uses IS NOT NULL AND inv.uses>=inv.max_uses) THEN RAISE EXCEPTION 'This code has expired, been revoked, or is no longer available'; END IF;
 IF inv.purpose='TEAM' THEN
  SELECT id INTO pid FROM players WHERE user_id=auth.uid();
  IF pid IS NOT NULL THEN
   UPDATE players SET team_id=inv.team_id,status=CASE WHEN team_id=inv.team_id AND status='verified' THEN 'verified' ELSE 'pending' END WHERE id=pid;
  ELSE
   INSERT INTO players(user_id,display_name,team_id,status,data_mode) VALUES(auth.uid(),coalesce(nullif(trim(_display_name),''),(SELECT display_name FROM profiles WHERE id=auth.uid()),'Player'),inv.team_id,'pending',(SELECT data_mode FROM teams WHERE id=inv.team_id)) RETURNING id INTO pid;
  END IF;
  UPDATE invite_codes SET uses=uses+1 WHERE id=inv.id;
  INSERT INTO user_roles(user_id,role) VALUES(auth.uid(),'player') ON CONFLICT DO NOTHING;
  RETURN json_build_object('purpose','TEAM','team_id',inv.team_id,'status',(SELECT status FROM players WHERE id=pid));
 ELSE
  IF _relationship NOT IN ('parent','guardian','family','friend') OR _relationship IS NULL THEN RAISE EXCEPTION 'Choose a valid relationship'; END IF;
  IF nullif(trim(_display_name),'') IS NULL THEN RAISE EXCEPTION 'Enter your name'; END IF;
  IF NOT EXISTS(SELECT 1 FROM players WHERE id=inv.player_id AND status='verified' AND user_id=inv.issuer_user_id) THEN RAISE EXCEPTION 'This family code is no longer available'; END IF;
  IF EXISTS(SELECT 1 FROM players WHERE id=inv.player_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'You cannot link to yourself'; END IF;
  UPDATE profiles SET display_name=trim(_display_name) WHERE id=auth.uid();
  INSERT INTO family_links(family_user_id,player_id,relationship,status) VALUES(auth.uid(),inv.player_id,_relationship,'pending')
   ON CONFLICT (family_user_id,player_id) DO UPDATE SET relationship=CASE WHEN family_links.status='approved' THEN family_links.relationship ELSE EXCLUDED.relationship END,status=CASE WHEN family_links.status='approved' THEN 'approved' ELSE 'pending' END RETURNING id INTO link_id;
  UPDATE invite_codes SET uses=1,status='consumed' WHERE id=inv.id;
  RETURN json_build_object('purpose','FAMILY','player_id',inv.player_id,'status',(SELECT status FROM family_links WHERE id=link_id));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.review_family_request(_link uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF _approve IS NULL THEN RAISE EXCEPTION 'Choose approve or reject'; END IF;
 PERFORM 1 FROM family_links f JOIN players p ON p.id=f.player_id WHERE f.id=_link AND p.user_id=auth.uid() AND p.status='verified' FOR UPDATE OF f;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only this verified player can review this request'; END IF;
 UPDATE family_links SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_at=now(),reviewed_by=auth.uid() WHERE id=_link AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'This request has already been reviewed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.family_approval_requests() RETURNS TABLE(id uuid,display_name text,relationship text,status text,created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT f.id,coalesce(nullif(pr.display_name,''),'Family member or friend'),f.relationship,f.status,f.created_at FROM family_links f JOIN players p ON p.id=f.player_id LEFT JOIN profiles pr ON pr.id=f.family_user_id WHERE p.user_id=auth.uid() AND p.status='verified' ORDER BY f.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.review_family_request(uuid,boolean),public.family_approval_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_family_request(uuid,boolean),public.family_approval_requests() TO authenticated;
COMMENT ON COLUMN public.family_links.status IS 'Existing relationships retained as approved; new code redemptions require explicit approval by the verified player.';
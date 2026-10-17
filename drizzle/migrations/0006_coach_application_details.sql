ALTER TABLE public.coach_requests ADD COLUMN IF NOT EXISTS coach_name text, ADD COLUMN IF NOT EXISTS certification_number text, ADD COLUMN IF NOT EXISTS contact_email text, ADD COLUMN IF NOT EXISTS team_name text;
CREATE OR REPLACE FUNCTION public.submit_coach_application(_team text, _coach_name text, _certification_number text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE selected_team text; account_email text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF _coach_name IS NULL OR length(trim(_coach_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter your coach name (up to 100 characters)'; END IF;
 IF _certification_number IS NULL OR length(trim(_certification_number)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter your certification number (up to 100 characters)'; END IF;
 SELECT name INTO selected_team FROM public.teams WHERE id=_team;
 IF selected_team IS NULL THEN RAISE EXCEPTION 'Choose a registered team'; END IF;
 account_email := nullif(auth.jwt()->>'email','');
 IF account_email IS NULL THEN RAISE EXCEPTION 'An account email is required'; END IF;
 INSERT INTO public.coach_requests(user_id,team_id,coach_name,certification_number,contact_email,team_name) VALUES(auth.uid(),_team,trim(_coach_name),trim(_certification_number),account_email,selected_team)
 ON CONFLICT(user_id) DO UPDATE SET team_id=excluded.team_id,coach_name=excluded.coach_name,certification_number=excluded.certification_number,contact_email=excluded.contact_email,team_name=excluded.team_name,status='pending',created_at=now();
END $$;
REVOKE ALL ON FUNCTION public.submit_coach_application(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_coach_application(text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.request_coach_access(_team text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Submit your coach name and certification number using the coach application form'; END $$;
COMMENT ON FUNCTION public.request_coach_access(text) IS 'DEPRECATED: replaced by submit_coach_application with required identity details';
CREATE OR REPLACE FUNCTION public.review_coach_request(_request uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE req public.coach_requests; BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only OVA staff can approve coaches'; END IF;
 IF _approve IS NULL THEN RAISE EXCEPTION 'Choose approve or reject'; END IF;
 SELECT * INTO req FROM public.coach_requests WHERE id=_request AND status='pending' FOR UPDATE;
 IF req.id IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF;
 IF _approve AND (nullif(trim(req.coach_name),'') IS NULL OR nullif(trim(req.certification_number),'') IS NULL OR nullif(trim(req.contact_email),'') IS NULL OR nullif(trim(req.team_name),'') IS NULL) THEN RAISE EXCEPTION 'Coach must resubmit their name, certification number and team before approval'; END IF;
 UPDATE public.coach_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END WHERE id=req.id;
 IF _approve THEN INSERT INTO public.managed_teams(user_id,team_id) VALUES(req.user_id,req.team_id) ON CONFLICT DO NOTHING; INSERT INTO public.user_roles(user_id,role) VALUES(req.user_id,'coach') ON CONFLICT DO NOTHING; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_coach_request(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_coach_request(uuid,boolean) TO authenticated;
ALTER TABLE public.announcements ADD COLUMN pinned_at timestamptz;
CREATE INDEX announcements_pin_order ON public.announcements(team_id, pinned_at DESC) WHERE status='published' AND pinned_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.enforce_announcement_pins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status <> 'published' THEN NEW.pinned_at := NULL; END IF;
 IF NEW.pinned_at IS NOT NULL THEN
  IF auth.uid() IS NULL OR NOT (public.is_staff(auth.uid()) OR (NEW.author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.managed_teams WHERE user_id=auth.uid() AND team_id=NEW.team_id))) THEN RAISE EXCEPTION 'Only the managing coach or OVA staff can pin announcements'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('announcement-pins:'||coalesce(NEW.team_id,'OVA-community'),0));
  IF (SELECT count(*) FROM public.announcements WHERE team_id IS NOT DISTINCT FROM NEW.team_id AND status='published' AND pinned_at IS NOT NULL AND id<>NEW.id) >= 3 THEN RAISE EXCEPTION 'You can pin up to 3 announcements. Unpin one first.'; END IF;
  IF TG_OP='INSERT' THEN NEW.pinned_at:=clock_timestamp();
  ELSIF NEW.pinned_at IS DISTINCT FROM OLD.pinned_at THEN NEW.pinned_at:=clock_timestamp(); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_announcement_pins BEFORE INSERT OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.enforce_announcement_pins();
CREATE OR REPLACE FUNCTION public.set_announcement_pin(_announcement uuid,_pinned boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.announcements;
BEGIN
 SELECT * INTO a FROM public.announcements WHERE id=_announcement;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (public.is_staff(auth.uid()) OR (a.author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.managed_teams WHERE user_id=auth.uid() AND team_id=a.team_id))) THEN RAISE EXCEPTION 'Not allowed to manage this announcement'; END IF;
 IF a.status<>'published' THEN RAISE EXCEPTION 'Only published announcements can be pinned'; END IF;
 UPDATE public.announcements SET pinned_at=CASE WHEN _pinned THEN coalesce(pinned_at,clock_timestamp()) ELSE NULL END WHERE id=_announcement;
END $$;
REVOKE ALL ON FUNCTION public.set_announcement_pin(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_announcement_pin(uuid,boolean) TO authenticated;
ALTER POLICY "scoped announcement read" ON public.announcements USING (public.is_staff(auth.uid()) OR author_id=auth.uid() OR (status='published' AND (pinned_at IS NOT NULL OR published_at > now()-interval '24 hours') AND (team_id IS NULL OR public.can_view_team(auth.uid(),team_id))));
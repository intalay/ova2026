CREATE TABLE public.staff_allowlist (email text PRIMARY KEY);
GRANT ALL ON public.staff_allowlist TO service_role;
ALTER TABLE public.staff_allowlist ENABLE ROW LEVEL SECURITY;
INSERT INTO public.staff_allowlist(email) SELECT '395945526@qq.com';

CREATE OR REPLACE FUNCTION public.grant_staff_for_allowlisted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.staff_allowlist a WHERE a.email = lower(NEW.email)) THEN
    INSERT INTO public.user_roles(user_id, role)
    SELECT NEW.id, 'staff' WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'staff');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created_grant_staff AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_staff_for_allowlisted();
CREATE TRIGGER on_auth_user_confirmed_grant_staff AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_staff_for_allowlisted();

INSERT INTO public.user_roles(user_id, role)
SELECT u.id, 'staff' FROM auth.users u
WHERE u.email_confirmed_at IS NOT NULL AND lower(u.email) IN (SELECT email FROM public.staff_allowlist)
AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'staff');
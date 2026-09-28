CREATE OR REPLACE FUNCTION public.guard_profile_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- current_user is the function owner inside SECURITY DEFINER, so check the request's JWT role instead.
  IF COALESCE(auth.role(), '') IN ('authenticated','anon') THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Company cannot be changed';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Email cannot be changed here';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change account status';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
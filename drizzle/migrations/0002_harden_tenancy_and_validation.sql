-- Close privilege-escalation paths: users must not self-assign a company or role.
DROP POLICY IF EXISTS "bootstrap own role" ON public.user_roles;
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND company_id IS NULL);
DROP POLICY IF EXISTS "authenticated create company" ON public.companies;

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
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
END $$;
DROP TRIGGER IF EXISTS t_profiles_guard ON public.profiles;
CREATE TRIGGER t_profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- Business company can never move; assigned rep must be in same company; email format.
CREATE OR REPLACE FUNCTION public.guard_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Business company cannot be changed';
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Assigned employee must belong to the same company';
  END IF;
  IF NEW.contact_email IS NOT NULL AND NEW.contact_email <> '' AND NEW.contact_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;
  IF length(trim(NEW.name)) = 0 OR length(trim(NEW.address)) = 0 THEN
    RAISE EXCEPTION 'Name and address are required';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_businesses_guard ON public.businesses;
CREATE TRIGGER t_businesses_guard BEFORE INSERT OR UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.guard_business();

-- Coupon records: positive qty, no future dates, business in same company, returns <= distributed.
CREATE OR REPLACE FUNCTION public.guard_coupon_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date; total_out bigint; total_back bigint;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 OR NEW.quantity > 1000000 THEN
    RAISE EXCEPTION 'Quantity must be a positive number';
  END IF;
  d := CASE WHEN TG_TABLE_NAME = 'coupon_distributions' THEN (to_jsonb(NEW)->>'distributed_on')::date
            ELSE (to_jsonb(NEW)->>'returned_on')::date END;
  IF d > CURRENT_DATE + 1 OR d < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'Invalid date';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = NEW.business_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Business does not belong to your company';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Company cannot be changed';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.business_id::text));
  SELECT COALESCE(SUM(quantity),0) INTO total_out FROM public.coupon_distributions
    WHERE business_id = NEW.business_id AND (TG_TABLE_NAME <> 'coupon_distributions' OR id <> NEW.id);
  SELECT COALESCE(SUM(quantity),0) INTO total_back FROM public.coupon_returns
    WHERE business_id = NEW.business_id AND (TG_TABLE_NAME <> 'coupon_returns' OR id <> NEW.id);
  IF TG_TABLE_NAME = 'coupon_distributions' THEN total_out := total_out + NEW.quantity;
  ELSE total_back := total_back + NEW.quantity; END IF;
  IF total_back > total_out THEN
    RAISE EXCEPTION 'Returned coupons (%) cannot exceed coupons distributed (%)', total_back, total_out;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_dist_guard ON public.coupon_distributions;
CREATE TRIGGER t_dist_guard BEFORE INSERT OR UPDATE ON public.coupon_distributions FOR EACH ROW EXECUTE FUNCTION public.guard_coupon_record();
DROP TRIGGER IF EXISTS t_ret_guard ON public.coupon_returns;
CREATE TRIGGER t_ret_guard BEFORE INSERT OR UPDATE ON public.coupon_returns FOR EACH ROW EXECUTE FUNCTION public.guard_coupon_record();

-- Admins must not assign roles to users outside their company.
DROP POLICY IF EXISTS "admins manage company roles" ON public.user_roles;
CREATE POLICY "admins manage company roles" ON public.user_roles FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.my_company_id() AND public.is_admin()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.company_id = public.my_company_id()));
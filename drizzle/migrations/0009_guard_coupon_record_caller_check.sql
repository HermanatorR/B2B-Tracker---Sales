CREATE OR REPLACE FUNCTION public.guard_coupon_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d date; total_out bigint; total_back bigint;
BEGIN
  -- Check the caller first so the totals below are never revealed to another company,
  -- another employee, or a disabled account (RLS WITH CHECK only runs after BEFORE triggers).
  IF auth.uid() IS NOT NULL THEN
    IF NEW.company_id IS DISTINCT FROM public.my_company_id()
       OR (NEW.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
      RAISE EXCEPTION 'You don''t have permission to do that';
    END IF;
  END IF;
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
END $function$;
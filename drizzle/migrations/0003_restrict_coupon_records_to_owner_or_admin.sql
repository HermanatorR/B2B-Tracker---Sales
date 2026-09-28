DROP POLICY IF EXISTS "members read distributions" ON public.coupon_distributions;
DROP POLICY IF EXISTS "members read returns" ON public.coupon_returns;

CREATE POLICY "own or admin read distributions" ON public.coupon_distributions
  FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY "own or admin read returns" ON public.coupon_returns
  FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));

-- Shared, aggregate business stats (no employee identity) for every member of the company.
CREATE OR REPLACE FUNCTION public.company_business_stats()
RETURNS TABLE (
  business_id uuid, total_distributed integer, total_returned integer,
  first_distribution date, last_distribution date, last_return date,
  distribution_count integer, return_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id,
    COALESCE(d.total, 0)::int, COALESCE(r.total, 0)::int,
    d.first_on, d.last_on, r.last_on,
    COALESCE(d.cnt, 0)::int, COALESCE(r.cnt, 0)::int
  FROM public.businesses b
  LEFT JOIN (SELECT business_id, SUM(quantity) total, MIN(distributed_on) first_on, MAX(distributed_on) last_on, COUNT(*) cnt
             FROM public.coupon_distributions GROUP BY business_id) d ON d.business_id = b.id
  LEFT JOIN (SELECT business_id, SUM(quantity) total, MAX(returned_on) last_on, COUNT(*) cnt
             FROM public.coupon_returns GROUP BY business_id) r ON r.business_id = b.id
  WHERE auth.uid() IS NOT NULL AND b.company_id = public.my_company_id();
$$;
REVOKE ALL ON FUNCTION public.company_business_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_business_stats() TO authenticated;

-- Shared history for one business. Employee identity is only revealed for own rows or to admins.
CREATE OR REPLACE FUNCTION public.business_history(_business_id uuid)
RETURNS TABLE (id uuid, kind text, quantity integer, happened_on date, note text,
  created_at timestamptz, user_id uuid, recorded_by text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH biz AS (
    SELECT b.id FROM public.businesses b
    WHERE b.id = _business_id AND auth.uid() IS NOT NULL AND b.company_id = public.my_company_id()
  ), rows AS (
    SELECT d.id, 'distribution'::text kind, d.quantity, d.distributed_on happened_on, d.note, d.created_at, d.user_id
      FROM public.coupon_distributions d JOIN biz ON biz.id = d.business_id
    UNION ALL
    SELECT r.id, 'return'::text, r.quantity, r.returned_on, r.note, r.created_at, r.user_id
      FROM public.coupon_returns r JOIN biz ON biz.id = r.business_id
  )
  SELECT rows.id, rows.kind, rows.quantity, rows.happened_on, rows.note, rows.created_at,
    CASE WHEN rows.user_id = auth.uid() OR public.is_admin() THEN rows.user_id END,
    CASE WHEN rows.user_id = auth.uid() OR public.is_admin() THEN p.full_name END
  FROM rows LEFT JOIN public.profiles p ON p.id = rows.user_id
  ORDER BY rows.happened_on DESC, rows.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.business_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_history(uuid) TO authenticated;

COMMENT ON VIEW public.business_stats IS 'DEPRECATED: replaced by company_business_stats()';
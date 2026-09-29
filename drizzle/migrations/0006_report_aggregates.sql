-- Runs as the caller, so existing RLS still decides which rows are visible
-- (admins: whole company; reps: only their own records).
CREATE OR REPLACE FUNCTION public.report_daily_totals(_from date, _to date)
RETURNS TABLE(kind text, day date, business_id uuid, user_id uuid, quantity bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT 'distribution', d.distributed_on, d.business_id, d.user_id, SUM(d.quantity)
    FROM public.coupon_distributions d
    WHERE d.distributed_on BETWEEN _from AND _to
    GROUP BY d.distributed_on, d.business_id, d.user_id
  UNION ALL
  SELECT 'return', r.returned_on, r.business_id, r.user_id, SUM(r.quantity)
    FROM public.coupon_returns r
    WHERE r.returned_on BETWEEN _from AND _to
    GROUP BY r.returned_on, r.business_id, r.user_id;
$$;

CREATE OR REPLACE FUNCTION public.employee_last_activity()
RETURNS TABLE(user_id uuid, last_activity timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT a.user_id, MAX(a.created_at) FROM public.activity_logs a GROUP BY a.user_id;
$$;

REVOKE ALL ON FUNCTION public.report_daily_totals(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.employee_last_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_daily_totals(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_last_activity() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_dist_company_date ON public.coupon_distributions (company_id, distributed_on);
CREATE INDEX IF NOT EXISTS idx_ret_company_date ON public.coupon_returns (company_id, returned_on);
CREATE INDEX IF NOT EXISTS idx_activity_company_user_time ON public.activity_logs (company_id, user_id, created_at DESC);
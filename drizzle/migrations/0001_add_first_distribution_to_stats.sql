DROP VIEW IF EXISTS public.business_stats;
CREATE VIEW public.business_stats WITH (security_invoker = on) AS
SELECT
  b.id AS business_id,
  b.company_id,
  COALESCE(d.total_distributed, 0)::INTEGER AS total_distributed,
  COALESCE(r.total_returned, 0)::INTEGER AS total_returned,
  d.first_distribution,
  d.last_distribution,
  r.last_return,
  COALESCE(d.distribution_count, 0)::INTEGER AS distribution_count,
  COALESCE(r.return_count, 0)::INTEGER AS return_count
FROM public.businesses b
LEFT JOIN (
  SELECT business_id, SUM(quantity) AS total_distributed, MIN(distributed_on) AS first_distribution,
         MAX(distributed_on) AS last_distribution, COUNT(*) AS distribution_count
  FROM public.coupon_distributions GROUP BY business_id
) d ON d.business_id = b.id
LEFT JOIN (
  SELECT business_id, SUM(quantity) AS total_returned, MAX(returned_on) AS last_return, COUNT(*) AS return_count
  FROM public.coupon_returns GROUP BY business_id
) r ON r.business_id = b.id;
GRANT SELECT ON public.business_stats TO authenticated;
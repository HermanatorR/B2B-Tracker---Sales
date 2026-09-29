CREATE TABLE public.coupon_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  prepared_by uuid NOT NULL REFERENCES public.profiles(id),
  quantity_prepared integer NOT NULL CHECK (quantity_prepared > 0 AND quantity_prepared <= 1000000),
  quantity_distributed integer CHECK (quantity_distributed IS NULL OR quantity_distributed > 0),
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','distributed','cancelled')),
  distribution_id uuid UNIQUE REFERENCES public.coupon_distributions(id) ON DELETE SET NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  distributed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'distributed' OR (distributed_at IS NOT NULL AND quantity_distributed IS NOT NULL)),
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
);
CREATE INDEX coupon_envelopes_company_status_idx ON public.coupon_envelopes(company_id, status);
CREATE INDEX coupon_envelopes_prepared_by_idx ON public.coupon_envelopes(prepared_by, prepared_at DESC);

GRANT SELECT, INSERT ON public.coupon_envelopes TO authenticated;
GRANT ALL ON public.coupon_envelopes TO service_role;
ALTER TABLE public.coupon_envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or admin read envelopes" ON public.coupon_envelopes FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND (prepared_by = auth.uid() OR public.is_admin()));
CREATE POLICY "members prepare own envelopes" ON public.coupon_envelopes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND prepared_by = auth.uid() AND status = 'prepared'
    AND distribution_id IS NULL AND distributed_at IS NULL AND cancelled_at IS NULL AND quantity_distributed IS NULL
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.company_id = public.my_company_id()));

CREATE TRIGGER coupon_envelopes_touch BEFORE UPDATE ON public.coupon_envelopes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Distribute: locks the envelope row so double clicks / refreshes can never create two distributions.
CREATE OR REPLACE FUNCTION public.distribute_envelope(_envelope_id uuid, _quantity integer, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.coupon_envelopes; cid uuid := public.my_company_id(); dist_id uuid;
BEGIN
  IF cid IS NULL THEN RAISE EXCEPTION 'You don''t have permission to do that'; END IF;
  SELECT * INTO e FROM public.coupon_envelopes WHERE id = _envelope_id FOR UPDATE;
  IF NOT FOUND OR e.company_id <> cid OR (e.prepared_by <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'You don''t have permission to do that';
  END IF;
  IF e.status = 'distributed' THEN RETURN e.distribution_id; END IF;
  IF e.status <> 'prepared' THEN RAISE EXCEPTION 'This envelope was cancelled'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000000 THEN RAISE EXCEPTION 'Quantity must be a positive number'; END IF;
  INSERT INTO public.coupon_distributions(company_id, business_id, user_id, quantity, distributed_on, note)
    VALUES (e.company_id, e.business_id, auth.uid(), _quantity, CURRENT_DATE, NULLIF(trim(_note), ''))
    RETURNING id INTO dist_id;
  UPDATE public.coupon_envelopes SET status = 'distributed', quantity_distributed = _quantity,
    distributed_at = now(), distribution_id = dist_id WHERE id = e.id;
  RETURN dist_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_envelope(_envelope_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.coupon_envelopes; cid uuid := public.my_company_id();
BEGIN
  IF cid IS NULL THEN RAISE EXCEPTION 'You don''t have permission to do that'; END IF;
  SELECT * INTO e FROM public.coupon_envelopes WHERE id = _envelope_id FOR UPDATE;
  IF NOT FOUND OR e.company_id <> cid OR (e.prepared_by <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'You don''t have permission to do that';
  END IF;
  IF e.status = 'cancelled' THEN RETURN; END IF;
  IF e.status <> 'prepared' THEN RAISE EXCEPTION 'This envelope was already distributed'; END IF;
  UPDATE public.coupon_envelopes SET status = 'cancelled', cancelled_at = now() WHERE id = e.id;
END $$;

CREATE OR REPLACE FUNCTION public.update_envelope_quantity(_envelope_id uuid, _quantity integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.coupon_envelopes; cid uuid := public.my_company_id();
BEGIN
  IF cid IS NULL THEN RAISE EXCEPTION 'You don''t have permission to do that'; END IF;
  SELECT * INTO e FROM public.coupon_envelopes WHERE id = _envelope_id FOR UPDATE;
  IF NOT FOUND OR e.company_id <> cid OR e.prepared_by <> auth.uid() THEN
    RAISE EXCEPTION 'You don''t have permission to do that';
  END IF;
  IF e.status <> 'prepared' THEN RAISE EXCEPTION 'Only prepared envelopes can be changed'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000000 THEN RAISE EXCEPTION 'Quantity must be a positive number'; END IF;
  UPDATE public.coupon_envelopes SET quantity_prepared = _quantity WHERE id = e.id;
END $$;

REVOKE ALL ON FUNCTION public.distribute_envelope(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_envelope(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_envelope_quantity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribute_envelope(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_envelope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_envelope_quantity(uuid, integer) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.coupon_envelopes;
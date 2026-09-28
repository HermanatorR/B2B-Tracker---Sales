-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_rep');

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- ============ COMPANY SETTINGS ============
CREATE TABLE public.company_settings (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  high_turnover_days INTEGER NOT NULL DEFAULT 10,
  medium_turnover_days INTEGER NOT NULL DEFAULT 21,
  visit_soon_percent INTEGER NOT NULL DEFAULT 70,
  overdue_percent INTEGER NOT NULL DEFAULT 90,
  stale_visit_days INTEGER NOT NULL DEFAULT 45,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- ============ BUSINESSES ============
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_name TEXT,
  contact_title TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_businesses_company ON public.businesses(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============ DISTRIBUTIONS ============
CREATE TABLE public.coupon_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  distributed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dist_business ON public.coupon_distributions(business_id);
CREATE INDEX idx_dist_company ON public.coupon_distributions(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_distributions TO authenticated;
GRANT ALL ON public.coupon_distributions TO service_role;
ALTER TABLE public.coupon_distributions ENABLE ROW LEVEL SECURITY;

-- ============ RETURNS ============
CREATE TABLE public.coupon_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  returned_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ret_business ON public.coupon_returns(business_id);
CREATE INDEX idx_ret_company ON public.coupon_returns(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_returns TO authenticated;
GRANT ALL ON public.coupon_returns TO service_role;
ALTER TABLE public.coupon_returns ENABLE ROW LEVEL SECURITY;

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_name TEXT,
  action TEXT NOT NULL,
  quantity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_company ON public.activity_logs(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY "members read own company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.my_company_id());
CREATE POLICY "admins update own company" ON public.companies
  FOR UPDATE TO authenticated USING (id = public.my_company_id() AND public.is_admin());
CREATE POLICY "authenticated create company" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "members read company profiles" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR company_id = public.my_company_id());
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "admins update company profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND public.is_admin());

CREATE POLICY "members read company roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR company_id = public.my_company_id());
CREATE POLICY "bootstrap own role" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())
  );
CREATE POLICY "admins manage company roles" ON public.user_roles
  FOR ALL TO authenticated USING (company_id = public.my_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.my_company_id() AND public.is_admin());

CREATE POLICY "members read settings" ON public.company_settings
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "admins insert settings" ON public.company_settings
  FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "admins update settings" ON public.company_settings
  FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND public.is_admin());

CREATE POLICY "members read businesses" ON public.businesses
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "members create businesses" ON public.businesses
  FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "members update businesses" ON public.businesses
  FOR UPDATE TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "admins delete businesses" ON public.businesses
  FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND public.is_admin());

CREATE POLICY "members read distributions" ON public.coupon_distributions
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "members create distributions" ON public.coupon_distributions
  FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND user_id = auth.uid());
CREATE POLICY "own or admin update distributions" ON public.coupon_distributions
  FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY "own or admin delete distributions" ON public.coupon_distributions
  FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));

CREATE POLICY "members read returns" ON public.coupon_returns
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "members create returns" ON public.coupon_returns
  FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND user_id = auth.uid());
CREATE POLICY "own or admin update returns" ON public.coupon_returns
  FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY "own or admin delete returns" ON public.coupon_returns
  FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));

CREATE POLICY "own or admin read activity" ON public.activity_logs
  FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY "members create activity" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND user_id = auth.uid());

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER t_companies_touch BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_businesses_touch BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_settings_touch BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ACTIVITY LOGGING TRIGGERS ============
CREATE OR REPLACE FUNCTION public.log_distribution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bname TEXT;
BEGIN
  SELECT name INTO bname FROM public.businesses WHERE id = NEW.business_id;
  INSERT INTO public.activity_logs (company_id, user_id, business_id, business_name, action, quantity)
  VALUES (NEW.company_id, NEW.user_id, NEW.business_id, bname, 'distribution', NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER t_log_distribution AFTER INSERT ON public.coupon_distributions FOR EACH ROW EXECUTE FUNCTION public.log_distribution();

CREATE OR REPLACE FUNCTION public.log_return()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bname TEXT;
BEGIN
  SELECT name INTO bname FROM public.businesses WHERE id = NEW.business_id;
  INSERT INTO public.activity_logs (company_id, user_id, business_id, business_name, action, quantity)
  VALUES (NEW.company_id, NEW.user_id, NEW.business_id, bname, 'return', NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER t_log_return AFTER INSERT ON public.coupon_returns FOR EACH ROW EXECUTE FUNCTION public.log_return();

CREATE OR REPLACE FUNCTION public.log_business_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (company_id, user_id, business_id, business_name, action)
  VALUES (NEW.company_id, COALESCE(NEW.created_by, auth.uid()), NEW.id, NEW.name, 'business_added');
  RETURN NEW;
END;
$$;
CREATE TRIGGER t_log_business AFTER INSERT ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.log_business_added();

-- ============ STATS VIEW ============
CREATE VIEW public.business_stats WITH (security_invoker = on) AS
SELECT
  b.id AS business_id,
  b.company_id,
  COALESCE(d.total_distributed, 0)::INTEGER AS total_distributed,
  COALESCE(r.total_returned, 0)::INTEGER AS total_returned,
  d.last_distribution,
  r.last_return,
  d.distribution_count,
  r.return_count,
  GREATEST(COALESCE(d.last_distribution, '1900-01-01'::DATE), COALESCE(r.last_return, '1900-01-01'::DATE)) AS last_visit
FROM public.businesses b
LEFT JOIN (
  SELECT business_id, SUM(quantity) AS total_distributed, MAX(distributed_on) AS last_distribution, COUNT(*) AS distribution_count
  FROM public.coupon_distributions GROUP BY business_id
) d ON d.business_id = b.id
LEFT JOIN (
  SELECT business_id, SUM(quantity) AS total_returned, MAX(returned_on) AS last_return, COUNT(*) AS return_count
  FROM public.coupon_returns GROUP BY business_id
) r ON r.business_id = b.id;
GRANT SELECT ON public.business_stats TO authenticated;

-- ============ BOOTSTRAP COMPANY RPC ============
CREATE OR REPLACE FUNCTION public.bootstrap_company(_company_name TEXT, _full_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_company UUID; uid UUID := auth.uid(); uemail TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  INSERT INTO public.companies (name, email) VALUES (_company_name, uemail) RETURNING id INTO new_company;
  INSERT INTO public.company_settings (company_id) VALUES (new_company);
  INSERT INTO public.profiles (id, company_id, full_name, email)
  VALUES (uid, new_company, COALESCE(NULLIF(_full_name, ''), uemail), COALESCE(uemail, ''))
  ON CONFLICT (id) DO UPDATE SET company_id = new_company, full_name = COALESCE(NULLIF(_full_name, ''), public.profiles.full_name);
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (uid, new_company, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN new_company;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_company(TEXT, TEXT) TO authenticated;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coupon_distributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coupon_returns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
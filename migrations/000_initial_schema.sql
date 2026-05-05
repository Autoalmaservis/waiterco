-- ============================================================
-- eWaiter – Migration 000: Initial schema (core tables)
-- Run FIRST in Supabase SQL editor before migration 001
-- ============================================================

-- ──────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('super_admin', 'restaurant_admin', 'manager', 'staff', 'customer');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_type') THEN
    CREATE TYPE public.venue_type AS ENUM ('restaurant', 'bar', 'hotel', 'cafe');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'apple_pay', 'google_pay');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE public.session_status AS ENUM ('active', 'closed', 'abandoned');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'pro', 'enterprise');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'expired', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waiter_call_reason') THEN
    CREATE TYPE public.waiter_call_reason AS ENUM ('help', 'water', 'bill', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waiter_call_status') THEN
    CREATE TYPE public.waiter_call_status AS ENUM ('pending', 'acknowledged', 'resolved');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
    CREATE TYPE public.staff_role AS ENUM ('manager', 'waiter', 'cook', 'barman');
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 1. profiles
--    Extends Supabase auth.users
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      text,
  phone          text,
  avatar_url     text,
  role           public.user_role NOT NULL DEFAULT 'customer',
  language       text NOT NULL DEFAULT 'sk',
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ──────────────────────────────────────────────
-- 2. organizations
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name           text NOT NULL,
  logo_url       text,
  billing_email  text,
  ico            text,           -- IČO (Slovak business ID)
  dic            text,           -- DIČ (tax ID)
  ic_dph         text,           -- IČ DPH (VAT ID)
  street         text,
  city           text,
  postal_code    text,
  country        text DEFAULT 'SK',
  phone          text,
  website        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS organizations_owner_id_idx ON public.organizations(owner_id);

-- ──────────────────────────────────────────────
-- 3. subscriptions
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan                    public.subscription_plan NOT NULL DEFAULT 'free',
  status                  public.subscription_status NOT NULL DEFAULT 'trial',
  started_at              timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz,
  monthly_price           numeric(10,2),
  stripe_subscription_id  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 4. venues
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venues (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  type             public.venue_type NOT NULL DEFAULT 'restaurant',
  description      text,
  logo_url         text,
  cover_image_url  text,
  address          text,
  city             text,
  country          text NOT NULL DEFAULT 'SK',
  phone            text,
  email            text,
  website          text,
  currency         text NOT NULL DEFAULT 'EUR',
  timezone         text NOT NULL DEFAULT 'Europe/Bratislava',
  primary_color    text,
  is_active        boolean NOT NULL DEFAULT true,
  is_open          boolean NOT NULL DEFAULT false,
  closed_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS venues_org_id_idx ON public.venues(organization_id);
CREATE INDEX IF NOT EXISTS venues_slug_idx ON public.venues(slug);

-- ──────────────────────────────────────────────
-- 5. venue_zones
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

ALTER TABLE public.venue_zones ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 6. tables
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  zone_id     uuid REFERENCES public.venue_zones(id) ON DELETE SET NULL,
  name        text NOT NULL,
  capacity    smallint,
  qr_token    text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tables_venue_id_idx ON public.tables(venue_id);
CREATE INDEX IF NOT EXISTS tables_qr_token_idx ON public.tables(qr_token);

-- ──────────────────────────────────────────────
-- 7. venue_staff
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_staff (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.staff_role NOT NULL DEFAULT 'waiter',
  is_active  boolean NOT NULL DEFAULT true,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, user_id)
);

ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS venue_staff_user_id_idx ON public.venue_staff(user_id);

-- ──────────────────────────────────────────────
-- 8. menu_categories
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  image_url      text,
  sort_order     integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  available_from time,
  available_to   time
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS menu_categories_venue_id_idx ON public.menu_categories(venue_id);

-- ──────────────────────────────────────────────
-- 9. menu_items
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  category_id         uuid NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  image_url           text,
  base_price          numeric(10,2) NOT NULL DEFAULT 0,
  preparation_time    smallint,         -- minutes
  calories            smallint,
  allergens           text[] NOT NULL DEFAULT '{}',
  tags                text[] NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  is_available        boolean NOT NULL DEFAULT true,
  unavailable_reason  text,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS menu_items_venue_id_idx ON public.menu_items(venue_id);
CREATE INDEX IF NOT EXISTS menu_items_category_id_idx ON public.menu_items(category_id);

-- ──────────────────────────────────────────────
-- 10. table_sessions
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  venue_id        uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  share_token     text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status          public.session_status NOT NULL DEFAULT 'active',
  customer_count  smallint,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz
);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS table_sessions_table_id_idx ON public.table_sessions(table_id);
CREATE INDEX IF NOT EXISTS table_sessions_venue_id_idx ON public.table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS table_sessions_status_idx ON public.table_sessions(status);

-- ──────────────────────────────────────────────
-- 11. orders
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  table_id      uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  venue_id      uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  customer_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_number  text NOT NULL,
  round_number  smallint NOT NULL DEFAULT 1,
  status        public.order_status NOT NULL DEFAULT 'pending',
  total_amount  numeric(10,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  ready_at      timestamptz,
  delivered_at  timestamptz
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS orders_venue_id_idx ON public.orders(venue_id);
CREATE INDEX IF NOT EXISTS orders_session_id_idx ON public.orders(session_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at);

-- ──────────────────────────────────────────────
-- 12. payments
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  venue_id                  uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  amount                    numeric(10,2) NOT NULL DEFAULT 0,
  tip_amount                numeric(10,2) NOT NULL DEFAULT 0,
  total_amount              numeric(10,2) NOT NULL DEFAULT 0,
  payment_method            public.payment_method NOT NULL DEFAULT 'card',
  status                    public.payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id  text,
  receipt_email             text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  completed_at              timestamptz
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payments_venue_id_idx ON public.payments(venue_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at);

-- ──────────────────────────────────────────────
-- 13. waiter_calls
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waiter_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  table_id         uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  venue_id         uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  reason           public.waiter_call_reason NOT NULL DEFAULT 'help',
  custom_message   text,
  status           public.waiter_call_status NOT NULL DEFAULT 'pending',
  created_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_at  timestamptz,
  resolved_at      timestamptz
);

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS waiter_calls_venue_id_idx ON public.waiter_calls(venue_id);
CREATE INDEX IF NOT EXISTS waiter_calls_status_idx ON public.waiter_calls(status);

-- ──────────────────────────────────────────────
-- 14. reviews
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      uuid REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  overall_rating  smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  food_rating     smallint CHECK (food_rating BETWEEN 1 AND 5),
  service_rating  smallint CHECK (service_rating BETWEEN 1 AND 5),
  comment         text,
  is_visible      boolean NOT NULL DEFAULT true,
  venue_response  text,
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS reviews_venue_id_idx ON public.reviews(venue_id);

-- ──────────────────────────────────────────────
-- 15. notifications
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);

-- ──────────────────────────────────────────────
-- 16. feature_flags
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  venue_id    uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  is_enabled  boolean NOT NULL DEFAULT false,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, venue_id)
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 17. audit_logs
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role     text,
  action         text NOT NULL,
  resource_type  text,
  resource_id    text,
  old_data       jsonb,
  new_data       jsonb,
  ip_address     inet,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);

-- ──────────────────────────────────────────────
-- 18. support_tickets
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject          text NOT NULL,
  status           text NOT NULL DEFAULT 'open',
  priority         text NOT NULL DEFAULT 'normal',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS support_tickets_org_id_idx ON public.support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);

-- ──────────────────────────────────────────────
-- 19. support_messages
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message    text NOT NULL,
  is_staff   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx ON public.support_messages(ticket_id);

-- ──────────────────────────────────────────────
-- 20. special_offers
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.special_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  discount_type   text,    -- 'percent' | 'fixed'
  discount_value  numeric(10,2),
  item_ids        uuid[],
  valid_from      timestamptz,
  valid_to        timestamptz,
  days_of_week    smallint[],
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 21. customer_favorites
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id    uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES public.menu_items(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, venue_id, item_id)
);

ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 22. menu_translations
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_translations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type  text NOT NULL,  -- 'category' | 'item'
  resource_id    uuid NOT NULL,
  language       text NOT NULL,
  name           text,
  description    text,
  UNIQUE (resource_type, resource_id, language)
);

ALTER TABLE public.menu_translations ENABLE ROW LEVEL SECURITY;

-- ───────────────��────────────────────────────���─
-- RLS POLICIES
-- All tables have RLS enabled. Below are permissive
-- policies for service_role (used by server actions)
-- and restrictive policies for anon/authenticated.
-- ──────────────────────────────────────────────

-- service_role bypass (used by createAdminClient)
-- Supabase service_role already bypasses RLS by default.

-- Profiles: users can read own profile; super_admin can read all
CREATE POLICY IF NOT EXISTS "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "profiles: super_admin read all"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));

CREATE POLICY IF NOT EXISTS "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organizations: owner and super_admin can read
CREATE POLICY IF NOT EXISTS "organizations: owner read"
  ON public.organizations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS "organizations: super_admin all"
  ON public.organizations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));

-- Venues: org owner + staff read, super_admin all
CREATE POLICY IF NOT EXISTS "venues: org admin read"
  ON public.venues FOR SELECT
  USING (
    organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    OR id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY IF NOT EXISTS "venues: public read active"
  ON public.venues FOR SELECT
  USING (is_active = true);

-- Menus: public read for active items
CREATE POLICY IF NOT EXISTS "menu_categories: public read"
  ON public.menu_categories FOR SELECT
  USING (is_active = true AND venue_id IN (SELECT id FROM public.venues WHERE is_active = true));

CREATE POLICY IF NOT EXISTS "menu_items: public read"
  ON public.menu_items FOR SELECT
  USING (is_active = true AND venue_id IN (SELECT id FROM public.venues WHERE is_active = true));

-- Tables: public read active tables (needed for QR lookup)
CREATE POLICY IF NOT EXISTS "tables: public read active"
  ON public.tables FOR SELECT
  USING (is_active = true);

-- Table sessions: public insert (new session on order)
CREATE POLICY IF NOT EXISTS "table_sessions: public insert"
  ON public.table_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "table_sessions: public read"
  ON public.table_sessions FOR SELECT
  USING (true);

-- Orders: public insert (customer places order)
CREATE POLICY IF NOT EXISTS "orders: public insert"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "orders: venue staff read"
  ON public.orders FOR SELECT
  USING (
    venue_id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid() AND is_active = true)
    OR venue_id IN (SELECT v.id FROM public.venues v JOIN public.organizations o ON v.organization_id = o.id WHERE o.owner_id = auth.uid())
  );

-- Waiter calls: public insert, staff read
CREATE POLICY IF NOT EXISTS "waiter_calls: public insert"
  ON public.waiter_calls FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "waiter_calls: staff read"
  ON public.waiter_calls FOR SELECT
  USING (
    venue_id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid() AND is_active = true)
    OR venue_id IN (SELECT v.id FROM public.venues v JOIN public.organizations o ON v.organization_id = o.id WHERE o.owner_id = auth.uid())
  );

-- Reviews: public insert
CREATE POLICY IF NOT EXISTS "reviews: public insert"
  ON public.reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "reviews: public read visible"
  ON public.reviews FOR SELECT
  USING (is_visible = true);

-- Audit logs, feature flags, support: super_admin only
CREATE POLICY IF NOT EXISTS "audit_logs: super_admin read"
  ON public.audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY IF NOT EXISTS "feature_flags: super_admin all"
  ON public.feature_flags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

CREATE POLICY IF NOT EXISTS "support_tickets: org member read"
  ON public.support_tickets FOR SELECT
  USING (
    organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY IF NOT EXISTS "support_messages: ticket member read"
  ON public.support_messages FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.support_tickets WHERE
        organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Subscriptions: org owner + super_admin
CREATE POLICY IF NOT EXISTS "subscriptions: org owner read"
  ON public.subscriptions FOR SELECT
  USING (
    organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Notifications: own read
CREATE POLICY IF NOT EXISTS "notifications: own read"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- End of migration 000
-- ============================================================

-- ============================================================
-- eWaiter – Migration 001: Missing tables
-- Run in Supabase SQL editor or via psql
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. opening_hours
--    Venue opening hours per day of week (0=Monday … 6=Sunday)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at      time NOT NULL,
  closes_at     time NOT NULL,
  is_closed     boolean NOT NULL DEFAULT false,   -- explicitly closed (holiday etc.)
  UNIQUE (venue_id, day_of_week)
);

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 2. item_variant_groups
--    e.g. "Veľkosť: Malá / Stredná / Veľká"
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_variant_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name         text NOT NULL,
  is_required  boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE public.item_variant_groups ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 3. item_variants
--    Individual variant options (e.g. "Malá +0 €", "Veľká +1.50 €")
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_variants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES public.item_variant_groups(id) ON DELETE CASCADE,
  name         text NOT NULL,
  price_delta  numeric(10,2) NOT NULL DEFAULT 0,   -- added to base_price
  is_default   boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE public.item_variants ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 4. item_modifier_groups
--    e.g. "Doplnky: Extra syr, Slanina"
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_modifier_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name         text NOT NULL,
  min_select   smallint NOT NULL DEFAULT 0,
  max_select   smallint,                            -- NULL = unlimited
  sort_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE public.item_modifier_groups ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 5. item_modifiers
--    Individual modifier options (e.g. "Extra syr +0.80 €")
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_modifiers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES public.item_modifier_groups(id) ON DELETE CASCADE,
  name         text NOT NULL,
  price        numeric(10,2) NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE public.item_modifiers ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 6. order_items  ← CRITICAL for KDS
--    Individual line-items inside an order
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_item_status') THEN
    CREATE TYPE public.order_item_status AS ENUM (
      'pending', 'preparing', 'ready', 'delivered', 'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  variant_id    uuid REFERENCES public.item_variants(id) ON DELETE SET NULL,
  name          text NOT NULL,                      -- snapshot at order time
  quantity      smallint NOT NULL DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL,
  total_price   numeric(10,2) NOT NULL,
  status        public.order_item_status NOT NULL DEFAULT 'pending',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);

-- ──────────────────────────────────────────────
-- 7. order_item_modifiers
--    Modifiers applied to a specific order_item
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_item_modifiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_id     uuid REFERENCES public.item_modifiers(id) ON DELETE SET NULL,
  name            text NOT NULL,   -- snapshot
  price           numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 8. loyalty_programs
--    Per-venue loyalty program definition
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_type') THEN
    CREATE TYPE public.loyalty_type AS ENUM ('stamps', 'points');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            public.loyalty_type NOT NULL DEFAULT 'stamps',
  stamps_required smallint,         -- for stamps programs
  points_per_eur  numeric(6,2),     -- for points programs
  reward_description text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id)
);

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 9. loyalty_cards
--    Customer loyalty cards per venue
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  venue_id    uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stamps      smallint NOT NULL DEFAULT 0,
  points      numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, customer_id)
);

ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS loyalty_cards_customer_id_idx ON public.loyalty_cards(customer_id);

-- ──────────────────────────────────────────────
-- 10. item_reviews
--     Reviews for specific menu items
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id   uuid REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  is_visible   boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item_reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS item_reviews_item_id_idx ON public.item_reviews(item_id);

-- ──────────────────────────────────────────────
-- 11. payment_splits
--     Split payment records linked to a payment
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_splits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  customer_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount         numeric(10,2) NOT NULL,
  tip_amount     numeric(10,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'card',
  status         public.payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payment_splits_payment_id_idx ON public.payment_splits(payment_id);
CREATE INDEX IF NOT EXISTS payment_splits_session_id_idx ON public.payment_splits(session_id);

-- ============================================================
-- End of migration 001
-- ============================================================

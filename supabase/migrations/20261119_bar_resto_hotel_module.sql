-- ============================================================================
-- WESD SYSTEMS — Bar, Resto & Hôtel Module Expansion
-- ============================================================================

-- 1. Ensure Categories for Resto & Hôtel exist
INSERT INTO public.bar_categories (name, default_units_per_case, icon)
SELECT * FROM (VALUES
  ('Plats & Fritay', 1, 'utensils'),
  ('Grillades & Poissons', 1, 'flame'),
  ('Snacks & Extras', 1, 'sandwich'),
  ('Chambres & Hôtel', 1, 'bed')
) AS v(name, default_units_per_case, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bar_categories WHERE name = v.name
);

-- 2. Hotel Rooms Table
CREATE TABLE IF NOT EXISTS public.bar_hotel_rooms (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id           UUID NOT NULL,
  room_number         VARCHAR(50) NOT NULL,
  room_type           VARCHAR(100) NOT NULL DEFAULT 'Chambre Standard',
  floor               VARCHAR(50) DEFAULT '1er étage',
  price_per_night     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_per_hour      NUMERIC(10, 2) DEFAULT 0,
  status              VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE
  current_guest_name  VARCHAR(255),
  current_guest_phone VARCHAR(50),
  check_in_date       TIMESTAMPTZ,
  check_out_date      TIMESTAMPTZ,
  amenities           TEXT[] DEFAULT '{}'::TEXT[],
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Hotel Bookings Table
CREATE TABLE IF NOT EXISTS public.bar_hotel_bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL,
  room_id         UUID REFERENCES public.bar_hotel_rooms(id) ON DELETE CASCADE,
  room_number     VARCHAR(50) NOT NULL,
  guest_name      VARCHAR(255) NOT NULL,
  guest_phone     VARCHAR(50),
  guest_id_number VARCHAR(100),
  booking_type    VARCHAR(50) NOT NULL DEFAULT 'NIGHT', -- 'NIGHT' or 'DAY_PASS'
  check_in        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out       TIMESTAMPTZ,
  total_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method  VARCHAR(50) NOT NULL DEFAULT 'ESPECES',
  payment_status  VARCHAR(50) NOT NULL DEFAULT 'PAID',
  status          VARCHAR(50) NOT NULL DEFAULT 'CHECKED_IN',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.bar_hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_hotel_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bar_hotel_rooms_all" ON public.bar_hotel_rooms;
CREATE POLICY "bar_hotel_rooms_all" ON public.bar_hotel_rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_hotel_bookings_all" ON public.bar_hotel_bookings;
CREATE POLICY "bar_hotel_bookings_all" ON public.bar_hotel_bookings FOR ALL USING (true) WITH CHECK (true);

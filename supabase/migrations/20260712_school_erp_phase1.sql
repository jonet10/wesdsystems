-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS — School ERP Phase 1 (Base de données et Configuration)
-- Date: 2026-07-12
--
-- 1. Tables de notifications et WhatsApp
-- 2. Paramètres d'alerte de l'école
-- 3. Mise à jour de school_teachers pour la connexion (teacher_code, user_id)
-- 4. Verrouillage des évaluations (school_exams)
-- 5. Présences (school_attendance) modification
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Paramètres WhatsApp ───
CREATE TABLE IF NOT EXISTS public.school_whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL,
    provider VARCHAR(50) DEFAULT 'openwa', -- 'openwa', 'ultramsg', 'twilio', 'meta'
    api_key TEXT,
    api_url TEXT,
    phone_number VARCHAR(50),
    webhook_url TEXT,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id)
);
ALTER TABLE public.school_whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- ─── 2. Paramètres de Notifications (Seuils et Délais) ───
CREATE TABLE IF NOT EXISTS public.school_notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL,
    enable_whatsapp BOOLEAN DEFAULT false,
    enable_email BOOLEAN DEFAULT false,
    absence_alert_delay INT DEFAULT 60, -- minutes après l'heure d'arrivée
    late_alert_delay INT DEFAULT 30,    -- minutes de retard toléré
    official_start_time TIME DEFAULT '08:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id)
);
ALTER TABLE public.school_notification_settings ENABLE ROW LEVEL SECURITY;

-- ─── 3. Mise à jour des Enseignants pour le Portail ───
ALTER TABLE public.school_teachers 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_code VARCHAR(50) UNIQUE;

-- Si active n'existe pas, l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_teachers' AND column_name = 'active') THEN
    ALTER TABLE public.school_teachers ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ─── 4. Verrouillage des Examens ───
-- On suppose que les examens sont dans school_exams (ou similaire).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_exams') THEN
    ALTER TABLE public.school_exams 
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
  END IF;
END $$;

-- ─── 5. Gestion des Présences (Attendance) ───
-- Ajout des champs pour le suivi exact (heure d'arrivée, remarques)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_attendance') THEN
    ALTER TABLE public.school_attendance 
      ADD COLUMN IF NOT EXISTS arrival_time TIME,
      ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS remarks TEXT;
  END IF;
END $$;


-- ─── 6. RLS POLICIES ───
-- Access for school_whatsapp_settings
DROP POLICY IF EXISTS select_whatsapp_settings ON public.school_whatsapp_settings;
CREATE POLICY select_whatsapp_settings ON public.school_whatsapp_settings FOR SELECT USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS all_whatsapp_settings ON public.school_whatsapp_settings;
CREATE POLICY all_whatsapp_settings ON public.school_whatsapp_settings FOR ALL USING (
    business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'salon_admin')
    )
);

-- Access for school_notification_settings
DROP POLICY IF EXISTS select_notification_settings ON public.school_notification_settings;
CREATE POLICY select_notification_settings ON public.school_notification_settings FOR SELECT USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS all_notification_settings ON public.school_notification_settings;
CREATE POLICY all_notification_settings ON public.school_notification_settings FOR ALL USING (
    business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'salon_admin')
    )
);

-- Note: Policies for teachers and attendance should be updated to allow teachers to insert attendance and view their own data, but we'll manage this via application logic or fine-grained RLS in Phase 2.

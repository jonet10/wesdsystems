-- ============================================================================
-- Migration: Add school_staff_members and RPCs
-- Date: 20260828
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'cashier', -- 'cashier', 'accountant', 'manager', 'admin'
    pin_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_school_staff_business_id ON public.school_staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_school_staff_pin_code ON public.school_staff_members(pin_code);

-- RLS
ALTER TABLE public.school_staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view staff for their business"
    ON public.school_staff_members FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert staff for their business"
    ON public.school_staff_members FOR INSERT
    WITH CHECK (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid() AND (role_normalized = 'school_admin' OR role_normalized = 'super_admin' OR role_normalized = 'salon_admin'))
    );

CREATE POLICY "Admins can update staff for their business"
    ON public.school_staff_members FOR UPDATE
    USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid() AND (role_normalized = 'school_admin' OR role_normalized = 'super_admin' OR role_normalized = 'salon_admin'))
    );

CREATE POLICY "Admins can delete staff for their business"
    ON public.school_staff_members FOR DELETE
    USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid() AND (role_normalized = 'school_admin' OR role_normalized = 'super_admin' OR role_normalized = 'salon_admin'))
    );

-- Trigger
CREATE TRIGGER update_school_staff_members_updated_at
    BEFORE UPDATE ON public.school_staff_members
    FOR EACH ROW
    EXECUTE FUNCTION update_school_updated_at();

-- RPCs
CREATE OR REPLACE FUNCTION public.school_list_staff(p_business_id UUID)
RETURNS SETOF public.school_staff_members
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.school_staff_members
    WHERE business_id = p_business_id
    ORDER BY name ASC;
$$;
GRANT EXECUTE ON FUNCTION public.school_list_staff(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_school_staff(
    p_business_id UUID,
    p_name TEXT,
    p_role TEXT,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_pin_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.school_staff_members (
        business_id, name, role, email, phone, pin_code
    ) VALUES (
        p_business_id, p_name, p_role, p_email, p_phone, p_pin_code
    ) RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_school_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_school_staff(
    p_id UUID,
    p_business_id UUID,
    p_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_pin_code TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.school_staff_members
    SET
        name = COALESCE(p_name, name),
        role = COALESCE(p_role, role),
        email = COALESCE(p_email, email),
        phone = COALESCE(p_phone, phone),
        pin_code = COALESCE(p_pin_code, pin_code),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_id AND (p_business_id IS NULL OR business_id = p_business_id);
    
    RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_school_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_school_staff(p_id UUID, p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.school_staff_members
    WHERE id = p_id AND (p_business_id IS NULL OR business_id = p_business_id);
    
    RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_school_staff(UUID, UUID) TO authenticated;

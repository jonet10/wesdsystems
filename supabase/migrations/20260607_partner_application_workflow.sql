-- ============================================================================
-- Partner Application Workflow + Super Admin Notifications
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_status_check;

ALTER TABLE public.partners
  ADD CONSTRAINT partners_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'active'));

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_role TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_role TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_role_read_created
  ON public.notifications (recipient_role, read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.partner_application_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  step TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_application_audit_logs_partner_created
  ON public.partner_application_audit_logs (partner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.business_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_recipient_role TEXT,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    recipient_role,
    type,
    title,
    message,
    metadata
  )
  VALUES (
    p_user_id,
    p_recipient_role,
    COALESCE(NULLIF(p_type, ''), 'info'),
    p_title,
    p_message,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_partner_application(
  p_partner_id UUID,
  p_user_id UUID,
  p_step TEXT,
  p_outcome TEXT DEFAULT 'success',
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partner_application_audit_logs (
    partner_id,
    user_id,
    step,
    outcome,
    details
  )
  VALUES (
    p_partner_id,
    p_user_id,
    p_step,
    COALESCE(NULLIF(p_outcome, ''), 'success'),
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_partner_application(
  p_partner_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_partner_tier_id UUID DEFAULT NULL
)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner public.partners%ROWTYPE;
  v_code TEXT;
  v_title TEXT;
  v_message TEXT;
  v_admin_message TEXT;
BEGIN
  SELECT * INTO v_partner
  FROM public.partners
  WHERE id = p_partner_id
  FOR UPDATE;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING MESSAGE = 'Demande partenaire introuvable.';
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'suspended', 'pending') THEN
    RAISE EXCEPTION 'INVALID_PARTNER_STATUS' USING MESSAGE = 'Statut partenaire invalide.';
  END IF;

  IF p_status = 'approved' THEN
    v_code := public.generate_partner_code(COALESCE(v_partner.full_name, v_partner.display_name));
    UPDATE public.partners
    SET
      status = 'approved',
      referral_code = v_code,
      referral_url = 'https://wesdsystems.store/register?ref=' || v_code,
      partner_tier_id = COALESCE(p_partner_tier_id, partner_tier_id),
      rejection_reason = NULL,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      approved_at = now(),
      approved_by = auth.uid(),
      code_generated_at = now(),
      updated_at = now()
    WHERE id = p_partner_id
    RETURNING * INTO v_partner;

    v_title := 'Votre demande de partenariat a été approuvée';
    v_message := format(
      'Bonjour %s,%s%sVotre code partenaire: %s%sLien de parrainage: %s',
      COALESCE(v_partner.display_name, 'Partenaire'),
      E'\n\n',
      'Votre demande a été approuvée.\n\n',
      COALESCE(v_partner.referral_code, v_code),
      E'\n',
      COALESCE(v_partner.referral_url, 'https://wesdsystems.store/register?ref=' || v_code)
    );
  ELSIF p_status = 'rejected' THEN
    UPDATE public.partners
    SET
      status = 'rejected',
      rejection_reason = NULLIF(btrim(COALESCE(p_rejection_reason, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      approved_at = NULL,
      approved_by = NULL,
      updated_at = now()
    WHERE id = p_partner_id
    RETURNING * INTO v_partner;

    v_title := 'Votre demande de partenariat a été refusée';
    v_message := CASE
      WHEN v_partner.rejection_reason IS NULL THEN
        'Votre demande n''a pas été approuvée.'
      ELSE
        'Votre demande n''a pas été approuvée.' || E'\n\nRaison: ' || v_partner.rejection_reason
    END;
  ELSIF p_status = 'suspended' THEN
    UPDATE public.partners
    SET
      status = 'suspended',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
    WHERE id = p_partner_id
    RETURNING * INTO v_partner;

    v_title := 'Votre compte partenaire a été suspendu';
    v_message := 'Votre demande de partenariat a été suspendue par le Super Admin.';
  ELSE
    UPDATE public.partners
    SET
      status = 'pending',
      reviewed_at = NULL,
      reviewed_by = NULL,
      updated_at = now()
    WHERE id = p_partner_id
    RETURNING * INTO v_partner;

    v_title := 'Votre demande de partenariat est en attente';
    v_message := 'Votre demande a bien été reçue et reste en attente de validation.';
  END IF;

  PERFORM public.log_partner_application(
    v_partner.id,
    v_partner.user_id,
    'review_' || p_status,
    'success',
    jsonb_build_object(
      'status', p_status,
      'partner_tier_id', p_partner_tier_id,
      'reviewed_by', auth.uid(),
      'rejection_reason', p_rejection_reason
    )
  );

  IF v_partner.user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_partner.user_id,
      NULL,
      'partner_application',
      v_title,
      v_message,
      jsonb_build_object(
        'partner_id', v_partner.id,
        'status', p_status,
        'referral_code', v_partner.referral_code,
        'referral_url', v_partner.referral_url
      )
    );
  END IF;

  RETURN v_partner;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_partner_application(
  p_partner_id UUID,
  p_partner_tier_id UUID DEFAULT NULL
)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.review_partner_application(p_partner_id, 'approved', NULL, p_partner_tier_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_partner_application(
  p_partner_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.review_partner_application(p_partner_id, 'rejected', p_rejection_reason, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_partner_application(
  p_partner_id UUID
)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.review_partner_application(p_partner_id, 'suspended', NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_partner_application_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_message TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_admin_message := format(
      '%s\n%s, %s\nStatut:\nEn attente\nDate:\n%s',
      COALESCE(NEW.display_name, NEW.full_name, 'Demande partenaire'),
      COALESCE(NEW.city, 'Ville inconnue'),
      COALESCE(NEW.department, 'Département inconnu'),
      to_char(COALESCE(NEW.created_at, now()), 'YYYY-MM-DD')
    );

    PERFORM public.send_notification(
      NULL,
      'super_admin',
      'partner_application',
      'Nouvelle demande de partenariat',
      v_admin_message,
      jsonb_build_object(
        'partner_id', NEW.id,
        'name', COALESCE(NEW.display_name, NEW.full_name),
        'city', NEW.city,
        'department', NEW.department,
        'status', NEW.status,
        'created_at', NEW.created_at
      )
    );

    PERFORM public.log_partner_application(
      NEW.id,
      NEW.user_id,
      'submitted',
      'success',
      jsonb_build_object('status', NEW.status, 'city', NEW.city, 'department', NEW.department)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_partner_application(
      NEW.id,
      NEW.user_id,
      'status_changed',
      'success',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'rejection_reason', NEW.rejection_reason
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_application_notifications ON public.partners;
CREATE TRIGGER trg_partner_application_notifications
  AFTER INSERT OR UPDATE OF status ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_partner_application_notifications();

CREATE OR REPLACE FUNCTION public.handle_partner_review_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_message TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_admin_message := format(
      'Montant: %s\nMéthode: %s\nStatut: %s\nDate: %s',
      COALESCE(NEW.requested_amount::TEXT, '0'),
      COALESCE(NEW.payout_method, 'unknown'),
      COALESCE(NEW.status, 'pending'),
      to_char(COALESCE(NEW.requested_at, now()), 'YYYY-MM-DD')
    );

    PERFORM public.send_notification(
      NULL,
      'super_admin',
      'payout_request',
      'Nouvelle demande de payout',
      v_admin_message,
      jsonb_build_object(
        'payout_id', NEW.id,
        'partner_id', NEW.partner_id,
        'status', NEW.status,
        'requested_amount', NEW.requested_amount
      )
    );
  ELSIF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'active' OR NEW.status = 'trialing' THEN
      PERFORM public.send_notification(
        NULL,
        'super_admin',
        'subscription_request',
        'Nouvelle demande de souscription',
        format(
          'Business: %s\nStatut: %s\nDate: %s',
          NEW.business_id,
          NEW.status,
          to_char(now(), 'YYYY-MM-DD')
        ),
        jsonb_build_object(
          'business_id', NEW.business_id,
          'subscription_id', NEW.id,
          'status', NEW.status
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_payout_notifications ON public.partner_payout_requests;
CREATE TRIGGER trg_partner_payout_notifications
  AFTER INSERT ON public.partner_payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_partner_review_notifications();

DROP TRIGGER IF EXISTS trg_business_subscription_notifications ON public.business_subscriptions;
CREATE TRIGGER trg_business_subscription_notifications
  AFTER INSERT OR UPDATE OF status ON public.business_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_partner_review_notifications();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications readable" ON public.notifications;
CREATE POLICY "notifications readable" ON public.notifications
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR recipient_role = public.current_user_role()
      OR recipient_role = 'all'
    )
  );

DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own" ON public.notifications
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR recipient_role = public.current_user_role()
      OR recipient_role = 'all'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR recipient_role = public.current_user_role()
      OR recipient_role = 'all'
    )
  );

ALTER TABLE public.partner_application_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner application audit readable" ON public.partner_application_audit_logs;
CREATE POLICY "partner application audit readable" ON public.partner_application_audit_logs
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR public.current_user_role() = 'super_admin'
    )
  );

GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_partner_application(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_partner_application(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_partner_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_partner_application(UUID) TO authenticated;

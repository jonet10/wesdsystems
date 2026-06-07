-- Fix handle_partner_review_notifications() to correctly differentiate
-- between partner_payout_requests and business_subscriptions triggers.
--
-- The previous version used IF TG_OP = 'INSERT' which caught ALL inserts,
-- including business_subscriptions, routing them to the wrong notification type
-- (payout_request instead of subscription_request).
--
-- Now uses TG_TABLE_NAME to route to the correct notification logic.

CREATE OR REPLACE FUNCTION public.handle_partner_review_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_message TEXT;
BEGIN
  -- Handle partner_payout_requests INSERT
  IF TG_TABLE_NAME = 'partner_payout_requests' AND TG_OP = 'INSERT' THEN
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

    RETURN NEW;
  END IF;

  -- Handle business_subscriptions INSERT or status UPDATE
  IF TG_TABLE_NAME = 'business_subscriptions' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
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
  END IF;

  RETURN NEW;
END;
$$;

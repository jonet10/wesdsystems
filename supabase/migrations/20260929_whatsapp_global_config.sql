-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS — WhatsApp Global Platform Configuration
-- Date: 2026-09-29
--
-- Seed default keys for global WhatsApp credentials in app_config
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_config (key, value, description) VALUES
  ('whatsapp_global_enabled', 'true', 'Activation globale des notifications WhatsApp de la plateforme (true/false)'),
  ('whatsapp_global_provider', 'openwa', 'Fournisseur de service WhatsApp global par défaut (openwa, twilio, ultramsg, meta)'),
  ('whatsapp_global_api_url', 'https://api.example.com', 'URL de l API globale de la passerelle WhatsApp'),
  ('whatsapp_global_api_key', '', 'Clé d API ou jeton d accès global de la passerelle WhatsApp'),
  ('whatsapp_global_session_name', 'default', 'Nom de session ou expéditeur Twilio global de la passerelle WhatsApp')
ON CONFLICT (key) DO NOTHING;

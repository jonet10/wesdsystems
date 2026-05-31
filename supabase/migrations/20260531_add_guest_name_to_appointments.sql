-- Migration: add guest_name to salon_appointments
-- guest_name is mutually exclusive with customer_id:
--   - customer_id  → registered client (FK to salon_customers)
--   - guest_name   → walk-in / occasional client with no profile
--   - both null    → anonymous sale

ALTER TABLE salon_appointments
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Optional: add a check constraint enforcing mutual exclusivity
ALTER TABLE salon_appointments
  DROP CONSTRAINT IF EXISTS appt_client_xor;

ALTER TABLE salon_appointments
  ADD CONSTRAINT appt_client_xor
  CHECK (
    NOT (customer_id IS NOT NULL AND guest_name IS NOT NULL)
  );

COMMENT ON COLUMN salon_appointments.guest_name IS
  'Nom libre d''un client occasionnel sans fiche dans salon_customers. '
  'Mutuellement exclusif avec customer_id.';

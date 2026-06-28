-- Corriger la contrainte de clé étrangère pour commission_rules
ALTER TABLE public.commission_rules
DROP CONSTRAINT IF EXISTS commission_rules_employee_id_fkey;

ALTER TABLE public.commission_rules
ADD CONSTRAINT commission_rules_employee_id_fkey
FOREIGN KEY (employee_id) REFERENCES public.salon_employees(id) ON DELETE CASCADE;

-- Corriger la contrainte de clé étrangère pour commission_transactions
ALTER TABLE public.commission_transactions
DROP CONSTRAINT IF EXISTS commission_transactions_employee_id_fkey;

ALTER TABLE public.commission_transactions
ADD CONSTRAINT commission_transactions_employee_id_fkey
FOREIGN KEY (employee_id) REFERENCES public.salon_employees(id) ON DELETE CASCADE;

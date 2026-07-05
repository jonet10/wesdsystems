-- Function to sync salon_id for salon_pending_tab_items
CREATE OR REPLACE FUNCTION public.sync_salon_pending_tab_item_salon_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $body
  DECLARE
    v_salon_id UUID;
  BEGIN
    SELECT t.salon_id
      INTO v_salon_id
      FROM public.salon_pending_tabs t
      WHERE t.id = NEW.tab_id;
      
    IF v_salon_id IS NOT NULL THEN
      NEW.salon_id := v_salon_id;
    END IF;
    RETURN NEW;
  END;
  $body;

-- Update the trigger
DROP TRIGGER IF EXISTS trg_salon_pending_tab_items_sync_salon_id ON public.salon_pending_tab_items;

CREATE TRIGGER trg_salon_pending_tab_items_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_pending_tab_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_pending_tab_item_salon_id();

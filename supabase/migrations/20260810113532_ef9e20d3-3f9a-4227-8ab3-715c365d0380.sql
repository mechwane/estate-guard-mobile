-- 1. guest_invites: make resident lifecycle tampering an explicit error
CREATE OR REPLACE FUNCTION public.tg_guest_invites_freeze_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    NEW.estate_id   := OLD.estate_id;
    NEW.resident_id := OLD.resident_id;
    NEW.code        := OLD.code;
  END IF;

  IF OLD.resident_id = auth.uid()
     AND NOT public.has_role(auth.uid(),'estate_admin')
     AND NOT public.has_role(auth.uid(),'guard')
     AND NOT public.is_super_admin() THEN
    IF NEW.status         IS DISTINCT FROM OLD.status
       OR NEW.validated_by   IS DISTINCT FROM OLD.validated_by
       OR NEW.checked_in_at  IS DISTINCT FROM OLD.checked_in_at
       OR NEW.checked_out_at IS DISTINCT FROM OLD.checked_out_at
       OR NEW.exited_by      IS DISTINCT FROM OLD.exited_by
       OR NEW.expires_at     IS DISTINCT FROM OLD.expires_at
       OR NEW.vehicle_number IS DISTINCT FROM OLD.vehicle_number THEN
      RAISE EXCEPTION 'Gate validation fields can only be changed by security staff';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

-- 2. registrations: only organiser/super admin may set check-in state
CREATE OR REPLACE FUNCTION public.tg_registrations_freeze_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_is_organizer boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = OLD.event_id AND e.organizer_id = auth.uid()
  ) INTO v_is_organizer;

  IF public.is_super_admin() OR v_is_organizer THEN
    RETURN NEW;
  END IF;

  IF NEW.status          IS DISTINCT FROM OLD.status
     OR NEW.checked_in_at   IS DISTINCT FROM OLD.checked_in_at
     OR NEW.validation_code IS DISTINCT FROM OLD.validation_code
     OR NEW.event_id        IS DISTINCT FROM OLD.event_id
     OR NEW.ticket_id       IS DISTINCT FROM OLD.ticket_id
     OR NEW.user_id         IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Only the event organiser can check attendees in';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS tg_registrations_freeze_checkin ON public.registrations;
CREATE TRIGGER tg_registrations_freeze_checkin
BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.tg_registrations_freeze_checkin();

-- 3. vtu_transactions: no client-side updates at all
DROP POLICY IF EXISTS "vtu own update" ON public.vtu_transactions;

-- 4. notifications: remove self-insert branch
DROP POLICY IF EXISTS "admins insert notifications" ON public.notifications;
CREATE POLICY "admins insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    public.has_role(auth.uid(), 'estate_admin'::public.app_role)
    AND estate_id = public.current_estate_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = notifications.user_id
        AND p.estate_id = public.current_estate_id()
    )
  )
);
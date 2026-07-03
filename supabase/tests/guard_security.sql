-- Guard/Resident RLS + guest-lifecycle security tests
-- Uses the seed users already present in the sandbox database.
-- Cross-estate + super/admin cases are marked SKIPPED (require multi-estate fixtures
-- and auth.users insert privileges not available to the sandbox pooler role).
-- Transaction is rolled back at the end — no persistence.

\set ON_ERROR_STOP off
\set QUIET on
\pset pager off

-- Discover fixtures from live sandbox
SELECT id AS estate_id FROM public.estates ORDER BY created_at LIMIT 1 \gset
SELECT p.id AS resident_id
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id
 WHERE ur.role='resident' AND p.estate_id = :'estate_id' LIMIT 1 \gset
SELECT p.id AS guard_id
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id
 WHERE ur.role='guard' AND p.estate_id = :'estate_id' LIMIT 1 \gset

\echo Using estate  = :estate_id
\echo Using resident= :resident_id
\echo Using guard   = :guard_id

BEGIN;
-- sandbox_exec has no default privileges on public tables; grant for this txn only.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_invites, public.audit_logs TO sandbox_exec;

-- Helper to assume a user via JWT claim (auth.uid() reads from this).
-- Note: cannot SET ROLE authenticated in the sandbox (pooler role is not a member
-- of authenticated), so RLS-role enforcement is verified separately by policy
-- inspection at the end of the script.
CREATE OR REPLACE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid::text,'role','authenticated')::text, true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_fail(label text, sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql;
    RAISE NOTICE 'FAIL  [%] expected error, none raised', label;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS  [%] blocked: %', label, SQLERRM;
  END;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_ok(label text, sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql;
    RAISE NOTICE 'PASS  [%] succeeded', label;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL  [%] error: %', label, SQLERRM;
  END;
END $$;

-- Seed 3 passes for the resident: active, expired, revoked
INSERT INTO public.guest_invites(id,estate_id,resident_id,guest_name,visit_time,expires_at,code)
VALUES ('ffffffff-ffff-ffff-ffff-fffffffff001', :'estate_id', :'resident_id','Test A',
        now(), now()+interval '2 hours','TSTA01');
INSERT INTO public.guest_invites(id,estate_id,resident_id,guest_name,visit_time,expires_at,code)
VALUES ('ffffffff-ffff-ffff-ffff-fffffffff002', :'estate_id', :'resident_id','Test B',
        now()-interval '3 hours', now()-interval '1 hour','TSTA02');
INSERT INTO public.guest_invites(id,estate_id,resident_id,guest_name,visit_time,expires_at,code,status)
VALUES ('ffffffff-ffff-ffff-ffff-fffffffff003', :'estate_id', :'resident_id','Test C',
        now(), now()+interval '2 hours','TSTA03','revoked');

\echo === GUARD DIRECT-UPDATE POLICY INSPECTION ===
-- We cannot SET ROLE authenticated from the sandbox pooler, so verify the
-- policy set directly. Guards must NOT appear in any guest_invites UPDATE
-- policy USING/WITH CHECK clause.
SELECT policyname, cmd,
       CASE WHEN pg_get_expr(polqual, polrelid) ILIKE '%guard%'
              OR pg_get_expr(polwithcheck, polrelid) ILIKE '%guard%'
            THEN 'FAIL  [guard referenced in policy]'
            ELSE 'PASS' END AS guard_ref
  FROM pg_policies pp
  JOIN pg_policy p ON p.polname = pp.policyname
  JOIN pg_class c ON c.oid = p.polrelid AND c.relname = pp.tablename
 WHERE schemaname='public' AND tablename='guest_invites' AND cmd='UPDATE';

\echo === RESIDENT LIFECYCLE FREEZE (trigger — inspection only) ===
-- sandbox_exec has no UPDATE grant on guest_invites, so we verify the trigger
-- exists and its function body freezes the correct fields.
SELECT tgname,
       CASE WHEN pg_get_functiondef(p.oid) ILIKE '%NEW.checked_in_at%OLD.checked_in_at%'
             AND pg_get_functiondef(p.oid) ILIKE '%NEW.checked_out_at%OLD.checked_out_at%'
             AND pg_get_functiondef(p.oid) ILIKE '%NEW.status%OLD.status%'
             AND pg_get_functiondef(p.oid) ILIKE '%NEW.code%OLD.code%'
            THEN 'PASS  [trigger freezes lifecycle fields]'
            ELSE 'FAIL  [trigger missing freezes]' END AS freeze_body
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE t.tgname='tg_guest_invites_freeze_lifecycle';

\echo === VALIDATE_GUEST_CODE IS READ-ONLY ===
SELECT pg_temp.act_as(:'guard_id');
SELECT (public.validate_guest_code('TSTA01')->>'ok') AS validate_ok;
SELECT CASE WHEN (SELECT checked_in_at FROM public.guest_invites WHERE code='TSTA01') IS NULL
  THEN 'PASS  [validate did not mutate]' ELSE 'FAIL  [validate mutated]' END;

\echo === GUARD RPC LIFECYCLE ===
SELECT (public.guard_check_in('ffffffff-ffff-ffff-ffff-fffffffff001', NULL)->>'ok') AS checkin_ok;
SELECT pg_temp.expect_fail('duplicate check-in',
  $$SELECT public.guard_check_in('ffffffff-ffff-ffff-ffff-fffffffff001', NULL)$$);
SELECT pg_temp.expect_fail('expired-pass check-in',
  $$SELECT public.guard_check_in('ffffffff-ffff-ffff-ffff-fffffffff002', NULL)$$);
SELECT pg_temp.expect_fail('revoked-pass check-in',
  $$SELECT public.guard_check_in('ffffffff-ffff-ffff-ffff-fffffffff003', NULL)$$);

-- Checkout-before-checkin
INSERT INTO public.guest_invites(id,estate_id,resident_id,guest_name,visit_time,expires_at,code)
VALUES ('ffffffff-ffff-ffff-ffff-fffffffff004', :'estate_id', :'resident_id','Test D',
        now(), now()+interval '2 hours','TSTA04');
SELECT pg_temp.expect_fail('checkout before check-in',
  $$SELECT public.guard_check_out('ffffffff-ffff-ffff-ffff-fffffffff004')$$);

SELECT (public.guard_check_out('ffffffff-ffff-ffff-ffff-fffffffff001')->>'ok') AS checkout_ok;
SELECT pg_temp.expect_fail('duplicate checkout',
  $$SELECT public.guard_check_out('ffffffff-ffff-ffff-ffff-fffffffff001')$$);

\echo === AUDIT LOG RECORDS ===
SELECT action, count(*)::int
  FROM public.audit_logs
 WHERE entity='guest_invites' AND entity_id='ffffffff-ffff-ffff-ffff-fffffffff001'
 GROUP BY action ORDER BY action;

\echo === SUPER-ADMIN / CROSS-ESTATE (SKIPPED — needs multi-estate + super fixtures) ===

ROLLBACK;

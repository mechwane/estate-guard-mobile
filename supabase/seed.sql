-- Estate Guard — optional non-sensitive seed data.
--
-- Run this ONLY if you want the default platform-plan catalogue
-- populated. It contains no user data, no passwords, no fake residents,
-- and no payment records.
--
-- Safe to skip.

INSERT INTO public.platform_plans (name, monthly_ngn, features)
VALUES
  ('Starter',   0,      '["Up to 50 residents","Guest passes","Basic notifications"]'::jsonb),
  ('Growth',    25000,  '["Up to 250 residents","Access devices","Community & polls","Bills & payments"]'::jsonb),
  ('Scale',     75000,  '["Unlimited residents","Biometric access","Full analytics","Priority support"]'::jsonb)
ON CONFLICT DO NOTHING;

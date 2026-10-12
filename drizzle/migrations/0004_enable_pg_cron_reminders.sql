CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('daily-bill-reminders', '0 7 * * *', $$ SELECT public.send_bill_reminders(NULL); $$);
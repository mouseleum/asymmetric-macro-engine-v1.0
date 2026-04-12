-- Run this in your Supabase SQL Editor to schedule the Edge Function

-- 1. Enable the pg_cron extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the job to run every 5 minutes
-- Replace <YOUR_PROJECT_REF> with your actual Supabase project reference (e.g., 'abcdefghijklmno')
-- Replace <YOUR_ANON_KEY> with your actual Supabase anon key or service role key
SELECT cron.schedule(
  'macro-auto-scan', -- name of the cron job
  '*/5 * * * *',     -- every 5 minutes
  $$
  SELECT net.http_post(
      url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/auto-scan',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb
  );
  $$
);

-- Note: If you want to change the interval to every 15 minutes, use '*/15 * * * *'
-- If you want to stop the job, run:
-- SELECT cron.unschedule('macro-auto-scan');

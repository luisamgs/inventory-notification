-- Call the daily-email function every hour; it decides itself when to send (09:00 Berlin, Mon-Fri).
select cron.schedule(
  'daily-email-hourly',
  '0 * * * *',
  $$select net.http_post(
      url := 'https://dczclgckgbccmaarykru.supabase.co/functions/v1/daily-email',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )$$
);

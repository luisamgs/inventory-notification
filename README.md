# Buchkantine Stock

Phone-first stock counting for the Buchkantine kitchen: plain HTML/CSS/JS on GitHub Pages, data in Supabase.

- `index.html`, `style.css`, `app.js`, `config.js`: the app (no build step).
- `supabase/migrations/`: schema and item lists. Merging to `main` applies them to Supabase (GitHub Action).
- `supabase/functions/daily-email/`: weekday 09:00 (Berlin) low-stock email, triggered hourly by `pg_cron`.

## One-time setup (Luisa)

1. **Supabase**: create a project (free tier, region Frankfurt). Note the database password.
2. **Supabase → Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
   Important: otherwise anyone could create an account and see the data.
3. **Supabase → Authentication → Users → Add user**: create the one shared team login
   (e.g. `team@buchkantine.de` + a strong password, "Auto confirm user" ticked). Share the password with the team only.
4. **Gmail**: a dedicated Gmail account with 2-step verification on → Google Account → Security → App passwords → create one.
5. **Supabase → Account → Access Tokens**: create a token for GitHub.
6. **GitHub repo → Settings → Secrets and variables → Actions**, add:
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` (the project ref, e.g. `abcd1234…`),
   `GMAIL_USER` (the Gmail address), `GMAIL_APP_PASSWORD`.
7. **GitHub repo → Settings → Pages**: deploy from branch `main`, folder `/ (root)`.

## Everyday use

- Count: search or filter, type the number or tap −/+ (0.5 steps). It saves by itself.
- Minimums and units: tap "min X" or the unit next to the count, or use ⚙️ Settings.
- Who counted: the first name asked once per phone (change it in Settings).

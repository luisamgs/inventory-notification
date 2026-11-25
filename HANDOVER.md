# Buchkantine inventory app: handover

**For the next agent:** read this file first, then `BK_inventory_app_brief.md` (original brief). Where they differ, **this file wins**, because it records decisions Luisa made after the brief. Luisa has a limited token budget: keep answers short and build in small steps. Do not redo step 1.

## Status

| Step | State |
|---|---|
| 1. Schema + seed migrations | **Done** (files in `supabase/migrations/`). Written but **never run or tested**; the previous environment had no network. Check the SQL before relying on it. |
| 2. Login (shared Supabase Auth account) + first name per device | To do |
| 3. Ingredients and Production tabs (search, filters, count entry, low highlight, count log) | To do |
| 4. Minimums (tap "min X" in list + Settings page) | To do |
| 5. Daily email (Supabase Edge Function + `pg_cron`) | To do |
| 6. Deploy (GitHub Action `supabase db push` on merge to `main`, GitHub Pages) | To do |

Approved plan: plain HTML/CSS/JS, no build step, GitHub Pages + Supabase. The email runs from Supabase (`pg_cron` triggers hourly; the function sends only at 09:00 Europe/Berlin Mon-Fri, so daylight saving is handled). This avoids GitHub's 60-day cron shutdown and doubles as the keep-alive. Secrets (service key, Gmail app password) go in GitHub/Supabase secrets, never in the repo.

## Decisions made in chat (override the brief)

1. **Production has 4 sections, not 2**, exactly as on the printed form. `items.type` is one of `waffles`, `flammkuchen`, `breakfast`, `lunch_dinner`. The Production tab therefore has 4 filter buttons. Proposed emojis (Luisa may change): 🧇 Waffles, 🥘 Flammkuchen, 🍳 Breakfast, 🍽️ Lunch/Dinner.
2. Production page 2 items (Caesar Dressing, Quiche, Lentil Curry, Goulash, Pumpkin Soup, Rice, Vinaigrette, Rosemary Oil, Bärlauch Oil) stay under **Lunch/Dinner**. Confirmed.
3. Provider spelling is **Vicenzo** (not "Vincenzo").
4. **Kitchen & cleaning** has its own provider and category, both named "Kitchen & cleaning". Proposed emoji 🧽.
5. **Spelling corrected** in item names (e.g. Ceasar→Caesar, Pumkin→Pumpkin, Mayonaise→Mayonnaise). Still unresolved: **"Sojamelh"** (Sojamehl or Sojamilch?) and **"Krunchy Hafer"** (brand spelling or Crunchy?). Ask Luisa, then fix in the seed.
6. **Units** (Box, Trays, Jars...) are shown next to the count (e.g. "2.5 Blocks") and the team can **edit them in the app** (tap the unit label, like "min 2"). 38 units are seeded; **97 items have no unit yet** (unit/item pairing on later form pages could not be recovered). Luisa can send them, or the team fills them in.
7. Providers/categories as seeded: provider **Terra** with categories Dairy, Vegan, Vegetables, Dry pantry, Waffles, Granola & bread; providers **Vicenzo** and **Meat** have no category; **Kitchen & cleaning** as above. Brief's category emojis still apply (🥛 Dairy, 🌱 Vegan, 🥕 Vegetables, 🌾 Dry pantry, 🧇 Waffles, 🥣 Granola & bread; providers 🧀 Vicenzo, 🥩 Meat, 🥬 Terra).
8. All **minimums start at 0**, so nothing is "low" and the email says "all good" until minimums are set.
9. Totals in the seed: **135 items = 106 ingredients + 29 production** (4 Waffles, 5 Flammkuchen, 7 Breakfast, 13 Lunch/Dinner).

## Data model (already in the migrations)

- `items`: `id`, `list` (`ingredient`|`production`), `provider`, `category`, `type`, `form_section`, `name`, `unit`, `min_qty`, `current_qty` (numeric(8,1), halves allowed), `last_counted_by`, `last_counted_at`, `sort_order`.
- `count_log`: `id`, `item_id`, `item_name`, `old_qty`, `new_qty`, `counted_by`, `counted_at`.
- RLS: `authenticated` only can select/update `items`, select/insert `count_log`.
- RPC `set_count(p_item uuid, p_qty numeric, p_by text)`: updates the count and writes the log row atomically. Use it for every count change. Min and unit edits are plain `update`s on `items`.
- Low = `current_qty < min_qty`.

## Requirements still to build (summary; full detail in the brief)

- English-only UI, phone-first, white/minimal, one accent colour, rounded cards, large tap targets, Yazio-like "search → tap → log" flow.
- Two tabs: **Ingredients** (provider and category filters, independent) and **Production** (type filter). Fixed search bar, instant filtering, search combines with filters.
- Row: name, number box (0.5 steps), −/+ buttons, unit label, "min X" label, "last counted: Tue 03/11 08:12am · Anna", tick/"saved" on save. Low items highlighted.
- Settings page: all items with minimums (and units).
- Shared team login via Supabase Auth; first name asked once per device, kept in the browser, sent as `p_by`.
- Daily email Mon-Fri 09:00 Berlin to `luisa.gabatel@buchkantine.de` via Gmail SMTP app password: ingredients below minimum grouped by provider (shopping list), production in a separate "prep needed" section, current vs minimum; short "all good" email if nothing is low. Plus a keep-alive query every few days.
- Repo: GitHub `luisagms`, **public**. Local folder `BK/`. A JS-only password check is not enough (anon key is public): rely on Auth + RLS.

## Luisa has to do herself (write her a short checklist when you reach step 5/6)

Create the Supabase project; create the one shared team user; add the Gmail app password (dedicated Gmail account with 2-step verification); add GitHub Actions secrets; enable GitHub Pages.

## Notes

- The two source forms (`bastande.pages`, `Production_Bastande.pages`) were Apple Pages files read directly; the seed SQL is now the source of truth, so you do not need them again.
- v2 (out of scope): linking production to ingredients, recipes, per-user accounts, automatic ordering.

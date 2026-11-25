# Buchkantine kitchen inventory app: project brief

> Handover brief for the agent building this. The owner has already answered the scoping questions, and the answers are built into the sections below.
>
> **Before you implement anything:** read this, write a short implementation plan and get it approved. The owner has a limited token budget, so keep the plan brief and build in small steps.

## 1. Owner and accounts

|                               |                                           |
| ----------------------------- | ----------------------------------------- |
| Owner                         | Luisa (Buchkantine)                       |
| GitHub account                | `luisagms`, using a **public** repository |
| Daily summary email recipient | `luisa.gabatel@buchkantine.de`            |
| Local project folder          | `BK/`                                     |

## 2. Goal

Build a simple, mobile-friendly website the kitchen team can use to **count stock quickly**. Today they use printable forms and spreadsheets, which are slow and awkward on a phone because you have to zoom in to edit a cell. The new site should let them update a count with one tap or a quick number entry.

The UI is in **English only**.

## 3. Source data (in `BK/`)

- **`Forms/`** holds the printable stock forms. Only two of them are in scope, and **both go into the app**:
  - **Bastand**: raw ingredients bought from providers.
  - **Produktion Bastand**: the mise en place, meaning prepared items such as Caesar dressing, roasted tomatoes and pickled beetroot.
  - These two forms give the master list of items, including their providers and categories. Take the exact names and spellings from the forms.
- **`Recipes and calculations/`** is not used in v1, and v1 doesn't need to prepare for it.

## 4. Functional requirements

### 4.1 Two lists: Ingredients and Production

The app has two separate sections, for example as two tabs:

| Section | Source | Structure | Filters |
|---|---|---|---|
| **Ingredients** | Bastand | provider → category | provider, category |
| **Production** | Produktion Bastand | type: 🍳 Breakfast, 🍽️ Lunch & dinner | type |

- Production items can run low too. The kitchen needs a minimum amount of each prep ready at all times, for example Caesar dressing.
- **In v1, each production item is a single stock item.** Pickled beetroot is just "pickled beetroot", not a recipe made of beetroot, vinegar and sugar. There is no link between production items and ingredients yet (see section 8).

### 4.2 Inventory entry

- **How it gets used:** a team member stands at the pantry shelf or wardrobe with a phone, finds a specific item, counts what is there and logs that number. So the main action is **setting the current quantity**, not adding a delivery.
- Counts are in **items/units, not weight**, and **halves are allowed**. For example, 2.5 blocks of butter or 3 tubs of gorgonzola, not 1.5 kg.
- Each item row has an **editable number box** for typing the count directly (it accepts 0.5 steps) and **− / + buttons** for small corrections.
- Changes save immediately, with a small confirmation such as a tick or a short "saved" message. There is no separate save step.
- Each item shows when it was last counted and by whom, for example **"last counted: Tue 03/11 08:12am · Anna"**.

### 4.3 Finding items: search and filters

- A **search bar** stays fixed at the top. Typing filters the list instantly.
- **Ingredients:** providers and categories are clickable buttons with emoji icons, for example 🧀 Vincenzo, 🥩 Meat, 🥬 Terra, and 🥛 Dairy, 🌱 Vegan, 🥕 Vegetables, 🌾 Dry pantry, 🧇 Waffles, 🥣 Granola & bread. The owner can pick the final emojis.
- **Production:** type buttons, 🍳 Breakfast and 🍽️ Lunch & dinner.
- **Filters are independent.** You can filter by category without picking a provider, by provider alone, or use neither. Search combines with any filter.

### 4.4 Minimum thresholds

- Every item has a **minimum quantity**, both ingredients and production items. For example, gorgonzola min = 2 and Caesar dressing min = 1.
- An item is **low** when `current count < minimum`. The UI highlights low items.
- Thresholds are edited **in the app**:
  - in a **Settings** page that lists all items with their minimums;
  - also from the normal list view, but kept **discreet**, for example by tapping the small "min 2" label, because only the manager should change thresholds.

### 4.5 Daily low-stock email

- Send **one summary email Monday to Friday at 09:00 Berlin time** to `luisa.gabatel@buchkantine.de`.
- Content: every item currently below its minimum, showing **current count vs. minimum**.
  - Ingredients are grouped by provider so the email works as a shopping list.
  - Production items go in a separate "prep needed" section.
- Keep sending it every weekday until the counts are fixed.
- If nothing is low, send a short **"all good"** email instead.

### 4.6 Access control and who counted

- The site lives in a public repository and is publicly hosted, so it needs a **password gate** to keep out everyone except the team.
- There is **one shared team login** for now.
- To record who counted, ask for a first name once per device, remember it in the browser, and attach it to every update.
- Keep a **count log** of every update: item, old quantity → new quantity, name and timestamp.

## 5. Design direction

- **Inspiration: the Yazio app** (a food/calorie tracker). Take its quick "search → tap → log" flow, not its look in detail.
- **Minimal, modern, white UI:** a white background, lots of whitespace, one accent colour, rounded cards and a clean sans-serif font.
- **Built for phones first:** large tap targets that work with one hand, with no zooming and no spreadsheet-style grids.
- **Keep v1 basic.** A working, simple flow matters more than polish.

## 6. Suggested architecture

| Concern                   | Suggestion |
| ------------------------- | ---------- |
| Frontend                  | Static site (plain HTML/JS or a light framework) on **GitHub Pages** |
| Database                  | **Supabase** (free tier) with:<br>• `items`: list (ingredient / production), provider, category, type, name, min threshold, current quantity (allows halves), last updated by/at<br>• `count_log`: one row per update |
| Password gate             | Use **Supabase Auth with one shared team login** and Row Level Security that lets only authenticated users read and write. A JS-only password check is not enough: the repo is public and the Supabase anon key is visible in the frontend, so anyone could read or write the tables directly. |
| Schema changes via GitHub | Keep the schema and seed data (both item lists) as SQL migrations in the repo (`supabase/migrations/`). A GitHub Action runs `supabase db push` on merge to `main`. The owner can then ask Claude to make a change, Claude opens a PR, and merging it updates Supabase without anyone opening the Supabase dashboard. |
| Daily email               | A scheduled job (GitHub Actions cron or a Supabase Edge Function with `pg_cron`) runs Monday to Friday, queries low items and sends the email through **Gmail SMTP with an app password**. |
| Keep-alive                | Supabase pauses free projects after **7 days without activity**. The weekday email job already queries the database, but add a separate keep-alive query every few days as cheap insurance, for example over long holidays. |

Secrets such as the Supabase service key and the Gmail app password go in **GitHub Actions secrets** (or Supabase secrets), never in the repo.

## 7. Known gotchas

- **GitHub disables scheduled workflows in public repos after 60 days without repository activity.** If the daily email and the keep-alive both rely on GitHub cron, they can stop silently. Mitigate it, for example with a workflow that makes a small automated commit, an external cron trigger like cron-job.org, or by running the email from Supabase `pg_cron`.
- **Gmail sending:** use a dedicated Gmail account with 2-step verification turned on and an app password. Don't use the account's main password.
- **Timezone:** schedule for 09:00 Europe/Berlin. GitHub cron runs in UTC and ignores daylight saving time, so either run hourly and check the Berlin time in code, or use two cron entries for summer and winter time.

## 8. Out of scope for v1 (planned for v2)

- **Linking production to ingredients:** if Caesar dressing is below its minimum, check whether there are enough of its ingredients to make it, and add any missing ones to the order.
- Recipes and calculations
- Separate user accounts per team member
- Automatic ordering from providers

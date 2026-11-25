// Called hourly by pg_cron. Sends the low-stock summary from 09:00 Europe/Berlin (retries until 11:59 on failure), Mon-Fri, once per day.
// The hourly DB query also keeps the free Supabase project from pausing.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import nodemailer from "npm:nodemailer@6.9.16";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const TO = Deno.env.get("MAIL_TO") ?? "luisa.gabatel@buchkantine.de";
const TYPES: Record<string, string> = {
  waffles: "🧇 Waffles", flammkuchen: "🥘 Flammkuchen", breakfast: "🍳 Breakfast", lunch_dinner: "🍽️ Lunch/Dinner",
};

type Item = { list: string; provider: string | null; type: string | null; name: string;
  unit: string | null; min_qty: number; current_qty: number };

function berlinNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday };
}

const fmt = (n: number) => String(Number(n));
const line = (i: Item) => `${i.name}: ${fmt(i.current_qty)} / min ${fmt(i.min_qty)}${i.unit ? ` ${i.unit}` : ""}`;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

function groupBy(items: Item[], key: (i: Item) => string) {
  const m = new Map<string, Item[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return m;
}

function buildEmail(low: Item[], day: string) {
  const ingredients = groupBy(low.filter((i) => i.list === "ingredient"), (i) => i.provider ?? "Other");
  const prep = groupBy(low.filter((i) => i.list === "production"), (i) => TYPES[i.type ?? ""] ?? "Other");
  if (!low.length) {
    return { subject: `Buchkantine stock ${day}: all good ✅`, text: "Nothing is below its minimum today.",
      html: "<p>Nothing is below its minimum today. ✅</p>" };
  }
  let text = "", html = "";
  const section = (title: string, groups: Map<string, Item[]>) => {
    if (!groups.size) return;
    text += `${title}\n`; html += `<h2>${title}</h2>`;
    for (const [g, items] of groups) {
      text += `\n${g}\n${items.map((i) => `- ${line(i)}`).join("\n")}\n`;
      html += `<h3>${esc(g)}</h3><ul>${items.map((i) => `<li>${esc(line(i))}</li>`).join("")}</ul>`;
    }
    text += "\n";
  };
  section("Shopping list (ingredients)", ingredients);
  section("Prep needed (production)", prep);
  return { subject: `Buchkantine stock ${day}: ${low.length} item${low.length > 1 ? "s" : ""} low`, text, html };
}

Deno.serve(async () => {
  const { data, error } = await db.from("items")
    .select("list, provider, type, name, unit, min_qty, current_qty").order("sort_order");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const items = data as Item[];
  const now = berlinNow();
  const alwaysSend = Deno.env.get("ALWAYS_SEND") === "1"; // testing only
  const isSendTime = now.hour >= 9 && now.hour < 12 && !["Sat", "Sun"].includes(now.weekday);
  if (!alwaysSend && !isSendTime) return Response.json({ sent: false, reason: "not send time", ...now });

  if (!alwaysSend) {
    const { data: claimed, error: claimError } = await db.rpc("claim_daily_email", { p_day: now.day });
    if (claimError) return Response.json({ error: claimError.message }, { status: 500 });
    if (!claimed) return Response.json({ sent: false, reason: "already sent today" });
  }

  const low = items.filter((i) => Number(i.current_qty) < Number(i.min_qty));
  const mail = buildEmail(low, now.day);
  const port = Number(Deno.env.get("SMTP_PORT") ?? 465);
  try {
    await nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com", port, secure: port === 465,
      auth: Deno.env.get("GMAIL_USER")
        ? { user: Deno.env.get("GMAIL_USER")!, pass: Deno.env.get("GMAIL_APP_PASSWORD")! } : undefined,
    }).sendMail({ from: `Buchkantine Inventory <${Deno.env.get("GMAIL_USER") ?? "inventory@localhost"}>`,
      to: TO, ...mail });
  } catch (e) {
    if (!alwaysSend) await db.from("email_state").update({ last_sent_on: null }).eq("id", 1); // retry next hour
    console.error(e);
    return Response.json({ sent: false, error: String(e) }, { status: 500 });
  }
  return Response.json({ sent: true, low: low.length });
});

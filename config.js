// Public values only (safe in a public repo): data is protected by Supabase Auth + RLS.
window.BK_CONFIG = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      TEAM_EMAIL: "team@buchkantine.local",
    }
  : {
      SUPABASE_URL: "https://dczclgckgbccmaarykru.supabase.co",
      SUPABASE_KEY: "sb_publishable_YRu5gyS9hf1TMhGfN3zDtw_dewefxHS",
      TEAM_EMAIL: "luisa.gabatel@buchkantine.de",
    };

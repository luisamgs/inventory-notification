// Public values only (safe in a public repo): data is protected by Supabase Auth + RLS.
window.BK_CONFIG = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      TEAM_EMAIL: "team@buchkantine.local",
    }
  : {
      SUPABASE_URL: "https://PROJECT_REF.supabase.co",
      SUPABASE_KEY: "PUBLISHABLE_KEY",
      TEAM_EMAIL: "TEAM_EMAIL",
    };

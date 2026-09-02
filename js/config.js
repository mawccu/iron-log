// Supabase project keys. The anon key is safe to ship in a static site because
// every table is protected by row-level security (see setup.sql).
// Leave both empty to run in local-only mode (data stays in this browser).
export const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};

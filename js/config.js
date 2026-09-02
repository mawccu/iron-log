// Supabase project keys. The publishable key is safe to ship in a static site:
// every table is protected by row-level security (see setup.sql), so a signed-in
// user can only ever read or write their own rows.
// Project: "gym" (ejjikuppoupqworvjoeq). Leave both empty to run local-only.
export const CONFIG = {
  SUPABASE_URL: "https://ejjikuppoupqworvjoeq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_lMOxoC4StAqdCPg59ZnLKg_uPX5p8WK",
};

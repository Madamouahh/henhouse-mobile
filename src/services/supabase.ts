import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wjmduyodvuyggvwvuphn.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_TCc3wAjqVnouetVheT4I8w_5LtN7yip";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
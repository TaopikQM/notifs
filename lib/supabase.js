// import { createClient } from "@supabase/supabase-js";

// export const supabase = createClient(
//   https://tldxduzaosaifpxibcxx.supabase.co,
//   sb_publishable_pzlikSJDba1PyeZiw8B0sQ_ccWcbNml
// ); process.env.NEXT_PUBLIC_SUPABASE_URL,
  // process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,




import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  
);
export const supabase1 = createClient(
   process.env.NEXT_PUBLIC_SUPABASE_URL1,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY1
  
);

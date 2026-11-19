import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eysnbqfmkhlfsefkaaku.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5c25icWZta2hsZnNlZmthYWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwODM4MDEsImV4cCI6MjExMDY1OTgwMX0.fYDWpsY0St5JRDLiVKbn-ZvsLgEsOTnbzk-KcFr8iKo";

export const supabase = createClient(supabaseUrl, supabaseKey);

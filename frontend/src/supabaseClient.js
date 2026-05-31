import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bblrxnhyycendzajldgl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibHJ4bmh5eWNlbmR6YWpsZGdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzY4OTgsImV4cCI6MjA5NTYxMjg5OH0.gz9tw6nC4k38DNaCq1Lo6akLoN2ZKJqPdFRLeh8ZTHQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    redirectTo: "https://statviz-two.vercel.app",
  }
});
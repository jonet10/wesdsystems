
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://nurwzdbjzkhsrlxehobq.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnd6ZGJqemtoc3JseGVob2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMxMDMsImV4cCI6MjA5NDYyOTEwM30.kRwgj2fTRo6m5I0y6V3rd_qM3zkU7D2wrSU2SaWfgLc");
const { data, error } = await supabase.from("profiles").select("*").eq("id", "77f6c81f-8cb0-4dbb-a5c6-a925af1bd5a4").single();
console.log(data);

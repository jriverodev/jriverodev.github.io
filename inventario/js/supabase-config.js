// inventario/js/supabase-config.js

const supabaseUrl = "https://memavgxdebiaoanzhysx.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbWF2Z3hkZWJpYW9hbnpoeXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5Njk4ODgsImV4cCI6MjA3NzU0NTg4OH0._2dfAY4z7ZsWdbXPMIIoqNIIkMoO6kRvZBa6Mg_DWnA";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

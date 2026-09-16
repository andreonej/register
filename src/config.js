const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  "Content-Type": "application/json",
};

export const supabaseApiUrl = supabaseUrl ? `${supabaseUrl}/rest/v1` : "";

const rawGeminiKey = import.meta.env.VITE_API_GEMINI || "";
export const geminiApiKey = rawGeminiKey.trim();
export const isGeminiConfigured = Boolean(geminiApiKey);


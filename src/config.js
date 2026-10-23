const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  "Content-Type": "application/json",
};

export const supabaseApiUrl = supabaseUrl ? `${supabaseUrl}/rest/v1` : "";
export const supabaseStorageUrl = supabaseUrl ? `${supabaseUrl}/storage/v1` : "";

// La inferencia de Gemini se procesa de forma segura a través del proxy de Netlify Functions.
// La API Key ya no se incluye en el bundle cliente.
export const isGeminiConfigured = import.meta.env.VITE_DISABLE_AI !== "true";

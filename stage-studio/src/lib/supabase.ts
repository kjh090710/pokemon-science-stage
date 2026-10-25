import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configured = Boolean(url && key);
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error('Supabase 연결 정보가 없습니다. 환경 설정을 확인해 주세요.');
  if (!client) client = createClient(url, key, {
    auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return client;
}

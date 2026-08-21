import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * service_role の Supabase クライアント（フル BFF）。
 *
 * このアプリはブラウザから Supabase を直接叩かない。すべての読み書きは Server 側の
 * この admin クライアント経由で行う。RLS は全テーブルで有効（ポリシー無し＝拒否）だが、
 * service_role は RLS をバイパスするため、認可はアプリ層（管理キー検証・入力検証・
 * submit_ballot / close_poll RPC）で担う。
 */
let client: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

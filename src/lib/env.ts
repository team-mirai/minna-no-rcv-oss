import "server-only";

/** 必須環境変数を取り出す（未設定なら明示的に落とす）。 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`環境変数 ${name} が設定されていません`);
  return v;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  appSecret: () => required("APP_SECRET"),
  turnstileSecret: () => process.env.TURNSTILE_SECRET_KEY ?? null,
};

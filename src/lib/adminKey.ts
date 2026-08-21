import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * 管理キー（調整さん式のアカウントレス管理）。
 *
 * poll 作成時に一度だけ生キーを発行し、管理 URL（/p/<slug>/manage?key=...）として
 * 作成者に渡す。DB には HMAC ハッシュ（admin_key_hash）だけを保存し、生キーは保存しない。
 * 「キーを知っている人＝管理者」という、URL 所持ベースの緩い認可。
 */
export function generateAdminKey(): string {
  return randomBytes(18).toString("base64url");
}

export function hashAdminKey(key: string): string {
  return createHmac("sha256", env.appSecret() + ":admin").update(key).digest("hex");
}

/** 定数時間比較でキーを検証する。 */
export function verifyAdminKey(key: string | null | undefined, storedHash: string): boolean {
  if (!key) return false;
  const a = Buffer.from(hashAdminKey(key));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

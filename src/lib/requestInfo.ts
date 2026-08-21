import "server-only";
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * 呼び出し元のリクエスト情報（IP / UA）。
 *
 * IP は平文で保存せず、必ず HMAC(APP_SECRET) のハッシュにしてから DB へ渡す
 * （submit_log.ip_hash / poll.created_ip_hash）。用途はレート制限と、荒らし発生時の
 * 事後フィルタだけ。
 */
export type ClientInfo = { ipHash: string | null; userAgent: string | null };

/**
 * クライアント IP を取り出す。
 *
 * `x-forwarded-for` はクライアントが自分で付けられるヘッダなので、単体では信用できない
 * （レート制限のキーに使うと自称 IP を変えるだけで回避される）。Vercel は自身の Edge で
 * `x-vercel-forwarded-for` / `x-real-ip` を必ず上書きするため、そちらを優先する。
 * ローカル開発など、いずれも無い環境では null（＝レート制限は素通り）。
 */
function clientIp(h: Headers): string | null {
  const trusted = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip");
  if (trusted) return trusted.split(",")[0].trim() || null;
  // Vercel 以外へ載せ替えた場合のフォールバック。信頼できるプロキシの背後でのみ意味を持つ。
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() || null : null;
}

export async function clientInfo(): Promise<ClientInfo> {
  try {
    const h = await headers();
    const ip = clientIp(h);
    return {
      ipHash: ip
        ? createHmac("sha256", env.appSecret()).update(`ip:${ip}`).digest("hex")
        : null,
      userAgent: h.get("user-agent"),
    };
  } catch {
    return { ipHash: null, userAgent: null };
  }
}

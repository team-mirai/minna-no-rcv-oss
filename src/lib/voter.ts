import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

/**
 * 誰でも層の投票キー（1 ブラウザ 1 票）。サーバ発行の不透明な乱数を Cookie に持つ。
 * 値そのものに意味はなく、ballot の unique キー（poll_id, voter_key）に使うだけ。
 * これは L0 の信頼モデル（調整さんと同水準・ブラウザ単位の緩い一意性）で、正式な選挙・
 * 議決には使えない（docs/design.md §7）。
 *
 * 受理は「Cookie を提示したリクエストだけ」に限る（issueVoterKey → 再送の 2 段構え）。
 * その場で発行した鍵で受理してしまうと、Cookie を保持しない素の HTTP クライアントが
 * 1 リクエスト＝1 票を無限に積めてしまうため。決定的な対策ではなく（Cookie jar を持てば
 * 回避できる）、レート制限（src/server/rateLimit.ts）と合わせて初めて意味を持つ足切り。
 */
const COOKIE = "mrcv_voter";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 日

/** 既存の voter_key を返す（無ければ null）。Server Component からも読める。 */
export async function readVoterKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

/**
 * voter_key を発行して Cookie に載せる。値は返さない——このリクエストでは票を受理せず、
 * クライアントに再送させるため（Cookie を保持しない相手はここで止まる）。
 * Cookie の書き込みは Server Action / Route Handler でのみ可能なので、投票受理の
 * Server Action からのみ呼ぶこと。
 */
export async function issueVoterKey(): Promise<void> {
  const jar = await cookies();
  if (jar.get(COOKIE)) return;
  jar.set(COOKIE, randomBytes(18).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

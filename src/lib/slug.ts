import { randomBytes } from "node:crypto";

/**
 * 参加 URL 用の短い公開スラッグ。紛らわしい文字（0/o/1/l/i）を除いた base32 風の
 * 英数字。衝突は天文学的に低いが、呼び出し側は unique 制約違反時に採り直す。
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateSlug(len = 8): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

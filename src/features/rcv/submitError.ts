import type { SubmitResult } from "@/server/polls";

/** 送信が例外で終わった（通信失敗など）ことを表す、SubmitResult に無い結果コード */
export type SubmitFailure = Exclude<SubmitResult, "ok"> | "network_error";

/**
 * 投票送信の失敗を、利用者に見せる文言へ変換する。
 * どの文言も「なぜ失敗したか」と「次に何をすればよいか」を含める（WCAG 3.3.1 / 3.3.3）。
 * 文言は VoteClient の role="alert" 領域に入り、スクリーンリーダーにも読み上げられる。
 */
export function getSubmitErrorMessage(result: SubmitFailure): string {
  switch (result) {
    case "poll_closed":
      return "この投票は締め切られたため、送信できませんでした。結果は結果ページでご確認ください。";
    case "captcha_required":
      return "この投票は人間確認が必要な設定ですが、確認機能が未対応のため送信できません。投票の作成者にお問い合わせください。";
    case "poll_not_found":
      return "投票が見つからないため、送信できませんでした。URLをご確認ください。";
    case "cookie_issued":
      return "Cookieを保存できないため投票を受け付けられませんでした。プライベートブラウズやCookieのブロック設定をご確認のうえ、もう一度お試しください。";
    case "rate_limited":
      return "送信が集中しているため、受け付けられませんでした。少し時間をおいてから、もう一度お試しください。";
    case "invalid_rankings":
      return "順位の内容を確認できなかったため、送信できませんでした。ページを再読み込みしてから、もう一度お試しください。";
    case "network_error":
      return "通信エラーのため送信できませんでした。接続を確認して、もう一度お試しください。";
  }
}

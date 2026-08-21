"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { createPollAction } from "@/app/actions";
import { formatCloseAt, MIN_CLOSE_AT_MINUTES } from "@/lib/closeAt";
import { ArrowRight, Plus, Warning, X } from "@phosphor-icons/react";

const inputClass =
  "w-full rounded-[10px] border border-tm-gray-200 bg-white px-3.5 py-2.5 text-[15px] " +
  "placeholder:text-tm-gray-400 focus:border-tm-teal focus:outline-2 focus:outline-tm-teal";

const chipClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-tm-teal-hover " +
  "bg-white px-3.5 py-2 text-[13px] font-bold text-tm-teal-deep transition-colors " +
  "hover:border-tm-teal hover:bg-tm-teal hover:text-white";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** 締切のよくある指定。押すと datetime-local に入るので、そのまま微調整もできる。 */
const CLOSE_AT_PRESETS = [
  { label: "1時間後", ms: HOUR_MS },
  { label: "24時間後", ms: 24 * HOUR_MS },
  { label: "1週間後", ms: 7 * 24 * HOUR_MS },
] as const;

/** 時刻 → datetime-local の値（YYYY-MM-DDTHH:mm・ブラウザのローカル時刻）。 */
function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** datetime-local の値（ローカル時刻）→ ISO 8601（UTC）。読めなければ null。 */
function toIso(localValue: string): string | null {
  const t = new Date(localValue).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export default function CreatePollForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [showLiveCount, setShowLiveCount] = useState(true);
  // 締切（任意）。空文字＝締切なし。datetime-local はブラウザのローカル時刻で持つ。
  const [closeAtLocal, setCloseAtLocal] = useState("");
  // input の min。描画時に now を読むとサーバ描画とずれるので、マウント後に入れる。
  const [minCloseAtLocal, setMinCloseAtLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const optionRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setMinCloseAtLocal(toLocalInputValue(Date.now() + MIN_CLOSE_AT_MINUTES * MINUTE_MS));
  }, []);

  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }
  function addOption(focus = false) {
    setOptions((prev) => (prev.length >= 40 ? prev : [...prev, ""]));
    if (focus) {
      // 追加された行の input へフォーカス（次フレームで DOM 反映後）
      requestAnimationFrame(() => {
        optionRefs.current[optionRefs.current.length - 1]?.focus();
      });
    }
  }
  function removeOption(i: number) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  /**
   * IME の変換確定 Enter を判別する。
   *
   * 日本語入力では「変換を確定する Enter」と「次の欄へ進む Enter」が同じキーになる。
   * 確定の Enter を拾ってしまうと、変換の途中でフォーカスが次の行へ飛ぶ。
   *
   * 厄介なのはブラウザ間で発火順が違うこと:
   * - Chrome / Firefox … 確定の keydown は composing 中に来る（isComposing=true。
   *   keyCode 229 は同じ状態を指す旧来の合図で、古い WebView 向けの保険）。
   * - Safari(WebKit) … compositionend が keydown より先に来るため、確定の Enter が
   *   isComposing=false・keyCode 13 で届き、上の判定を素通りしてしまう。
   *   そこで「変換が確定した直後の Enter は確定用とみなす」時間窓で補う。
   *   人が意図して Enter を続けて 2 回押す間隔はこれよりずっと長い。
   */
  const composing = useRef(false);
  const composedAt = useRef(0);
  const COMPOSE_GRACE_MS = 80;

  function isImeEnter(e: KeyboardEvent<HTMLInputElement>): boolean {
    if (composing.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      return true;
    }
    return performance.now() - composedAt.current < COMPOSE_GRACE_MS;
  }

  /** Enter で次の選択肢へ（最終行なら行を足して移る）。フォーム送信はしない。 */
  function onOptionKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== "Enter") return;
    if (isImeEnter(e)) return; // 変換確定の Enter は素通しして IME に任せる
    e.preventDefault();
    if (i === options.length - 1) addOption(true);
    else optionRefs.current[i + 1]?.focus();
  }

  function submit() {
    setError(null);
    const cleaned = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!title.trim()) return setError("お題（タイトル）を入れてください");
    if (cleaned.length < 2) return setError("選択肢は 2 つ以上入れてください");
    const closeAt = closeAtLocal ? toIso(closeAtLocal) : null;
    if (closeAtLocal && !closeAt) return setError("締切の日時を確認してください");
    startTransition(async () => {
      try {
        // 成功時は redirect（例外として送出）。戻り値が来るのはサーバ側で弾かれたとき
        // （レート制限・入力上限・締切の指定ミス）だけなので、そのメッセージをそのまま出す。
        const res = await createPollAction({
          title: title.trim(),
          description: description.trim() || undefined,
          options: cleaned,
          showLiveCount,
          closeAt,
        });
        if (res?.error) setError(res.error);
      } catch (e) {
        // redirect() は例外として投げられるので、ここに来るのは本当のエラーだけ。
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        setError("作成に失敗しました。時間をおいて再度お試しください");
      }
    });
  }

  const filledCount = options.filter((o) => o.trim().length > 0).length;
  const closeAtIso = closeAtLocal ? toIso(closeAtLocal) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* お題 */}
      <div className="flex flex-col gap-1.5 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <label htmlFor="title" className="text-[13.5px] font-bold text-tm-teal-deep">
          お題 <span className="text-tm-red">*</span>
        </label>
        <input
          id="title"
          type="text"
          className={inputClass}
          placeholder="例：打ち上げのお店、どこにする？"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
        />
        <label htmlFor="desc" className="mt-2 text-[13.5px] font-bold text-tm-teal-deep">
          説明（任意）
        </label>
        <textarea
          id="desc"
          className={`${inputClass} min-h-[72px] resize-y`}
          placeholder="補足があれば。参加者ページに表示されます。"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
      </div>

      {/* 選択肢 */}
      <div className="flex flex-col gap-2 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <div className="flex items-baseline justify-between">
          <label className="text-[13.5px] font-bold text-tm-teal-deep">
            選択肢 <span className="text-tm-red">*</span>
          </label>
          <span className="text-[12px] text-tm-fg-muted">
            {filledCount}/40 ・ 2つ以上
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <div className="flex items-center gap-2" key={i}>
              <span className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-tm-teal-100 font-[family-name:var(--tm-font-latin)] text-[12.5px] font-bold text-tm-teal-deep">
                {i + 1}
              </span>
              <input
                type="text"
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                className={inputClass}
                placeholder={`選択肢 ${i + 1}`}
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={() => {
                  composing.current = false;
                  composedAt.current = performance.now();
                }}
                onKeyDown={(e) => onOptionKeyDown(e, i)}
                maxLength={120}
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                aria-label="この選択肢を削除"
                className="grid h-9 w-9 flex-none place-items-center rounded-[8px] text-tm-gray-400 hover:bg-red-50 hover:text-tm-red disabled:opacity-30"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addOption(true)}
          className={`mt-1 self-start ${chipClass}`}
        >
          <Plus size={13} />
          選択肢を追加
        </button>
      </div>

      {/* 締切（任意） */}
      <div className="flex flex-col gap-2 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <label htmlFor="closeAt" className="text-[13.5px] font-bold text-tm-teal-deep">
          締切（任意）
        </label>
        <input
          id="closeAt"
          type="datetime-local"
          className={inputClass}
          value={closeAtLocal}
          min={minCloseAtLocal || undefined}
          onChange={(e) => setCloseAtLocal(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {CLOSE_AT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setCloseAtLocal(toLocalInputValue(Date.now() + p.ms))}
              className={chipClass}
            >
              {p.label}
            </button>
          ))}
          {closeAtLocal && (
            <button
              type="button"
              onClick={() => setCloseAtLocal("")}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-tm-gray-250 bg-white px-3.5 py-2 text-[13px] font-bold text-tm-gray-600 transition-colors hover:bg-tm-gray-50"
            >
              <X size={13} />
              締切なしに戻す
            </button>
          )}
        </div>
        <span className="text-[12.5px] leading-[1.7] text-tm-fg-muted">
          {closeAtIso
            ? `${formatCloseAt(closeAtIso)} に自動で締め切ります。この日時は参加ページにも表示されます。`
            : "締切を入れると、その時刻になったら自動で受付を終了します。入れない場合は、管理ページから締め切るまで投票を受け付けます。"}
        </span>
      </div>

      {/* 公開設定 */}
      <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <input
          type="checkbox"
          checked={showLiveCount}
          onChange={(e) => setShowLiveCount(e.target.checked)}
          className="mt-1 h-4.5 w-4.5 accent-[var(--tm-teal)]"
        />
        <span className="flex flex-col gap-0.5">
          <b className="text-[14px]">受付中に途中経過を見せる</b>
          <span className="text-[12.5px] leading-[1.7] text-tm-fg-muted">
            オンだと参加者は“1位票のいま”を見られます。オフにすると結果は締切後にだけ表示され、発表の驚きを保てます。
          </span>
        </span>
      </label>

      {error && (
        <p className="m-0 rounded-[10px] bg-red-50 px-3 py-2 text-center text-[13px] text-tm-red ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full bg-tm-teal px-4 py-3.5 text-[16px] font-bold tracking-[0.04em] text-white transition-[background-color,transform] duration-150 ease-out hover:bg-tm-teal-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "作成中…" : "この内容でつくる"}
        {!pending && <ArrowRight size={18} />}
      </button>
      <div className="flex items-start gap-2.5 rounded-[12px] bg-amber-50 px-3.5 py-3 text-[12.5px] leading-[1.75] text-amber-950 ring-1 ring-inset ring-amber-200">
        <Warning size={17} weight="fill" className="mt-0.5 flex-none text-amber-700" />
        <span className="text-pretty">
          二重投票やなりすましを技術的に防ぐ仕組みはありません。法的な効果を有する選挙・議決には利用できません。
        </span>
      </div>
      <p className="m-0 text-center text-[12.5px] leading-[1.7] text-tm-fg-muted">
        作成すると、配布用の参加URLと、あなただけが持つ管理URL（締切に使う）が発行されます。
      </p>
    </div>
  );
}

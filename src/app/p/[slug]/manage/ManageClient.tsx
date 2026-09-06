"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { closePollAction, publishResultsAction } from "@/app/actions";
import type { PollStatus } from "@/server/polls";
import { formatCloseAt } from "@/lib/closeAt";
import { Modal } from "@/components/Modal";
import {
  ArrowClockwise,
  ChartBar,
  Check,
  Clock,
  Copy,
  HandTap,
  Link as LinkIcon,
  LockKey,
  Megaphone,
  MonitorPlay,
  QrCode,
  StopCircle,
  Users,
  Warning,
} from "@phosphor-icons/react";

const JP_DISPLAY: React.CSSProperties = {
  fontFamily: "var(--tm-font-jp-display)",
  fontWeight: 900,
};

function CopyBox({
  label,
  value,
  tone,
  note,
}: {
  label: React.ReactNode;
  value: string;
  tone: "share" | "admin";
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <b className="flex items-center gap-1.5 text-[13.5px] text-tm-teal-deep">{label}</b>
      <div
        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 ${
          tone === "share" ? "border-tm-teal-200 bg-tm-teal-100/60" : "border-tm-gray-200 bg-tm-gray-50"
        }`}
      >
        <code className="min-w-0 flex-1 break-all font-[family-name:var(--tm-font-mono)] text-[12.5px] leading-[1.6]">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard 不可の環境は手動コピー */
            }
          }}
          className="inline-flex flex-none items-center gap-1 rounded-full border border-tm-teal-hover bg-white px-3 py-1.5 text-[12.5px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
        >
          {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
          {copied ? "済" : "コピー"}
        </button>
      </div>
      {note && <span className="text-[12px] leading-[1.7] text-tm-fg-muted">{note}</span>}
    </div>
  );
}

export default function ManageClient({
  slug,
  adminKey,
  title,
  status,
  closeAt,
  resultsOpenAt,
  resultsOpen,
  ballotCount,
  shareUrl,
  adminUrl,
  justCreated,
  authError,
}: {
  slug: string;
  adminKey: string;
  title: string;
  status: PollStatus;
  /** 予約された締切（ISO 8601）。null なら締切なし＝手動で締め切るまで受け付ける。 */
  closeAt: string | null;
  /** 予約された結果公開（ISO 8601）。null なら締切と同時に公開。 */
  resultsOpenAt: string | null;
  /** いま結果を見せてよいか（締切済み かつ 結果公開の時刻を過ぎている）。 */
  resultsOpen: boolean;
  ballotCount: number;
  shareUrl: string;
  adminUrl: string;
  justCreated: boolean;
  authError: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // 参加URLのQR（会場でスクリーンに映す・印刷する用）。クライアント側で生成する。
  useEffect(() => {
    QRCode.toDataURL(shareUrl, { width: 480, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [shareUrl]);

  // 受付中は投票数を 15 秒ごとに自動更新する（締切時刻を過ぎた締切済みへの切り替わりも
  // この更新で届く）。締切済みでも結果公開を待っている間は、公開時刻での切り替わりを
  // 拾うために更新を続ける。
  useEffect(() => {
    if (status !== "open" && resultsOpen) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [status, resultsOpen, router]);

  function close() {
    setConfirmOpen(false);
    startTransition(async () => {
      await closePollAction(slug, adminKey);
    });
  }

  function publish() {
    setPublishOpen(false);
    startTransition(async () => {
      await publishResultsAction(slug, adminKey);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
      {justCreated && (
        <div className="flex items-start gap-2.5 rounded-[14px] bg-tm-teal-100 px-4 py-3.5 [animation:tm-rise_.4s_ease]">
          <Check size={18} weight="bold" className="mt-0.5 flex-none text-tm-teal-deep" />
          <span className="text-[13.5px] leading-[1.75] text-tm-teal-deep">
            投票を作成しました！下の<b>参加URL</b>を参加者に配ってください。
            <b>このページ（管理URL）はブックマークしておいてください</b>。締め切るときに使うもので、あとから再表示することはできません。
          </span>
        </div>
      )}
      {authError && (
        <div className="flex items-start gap-2.5 rounded-[14px] bg-red-50 px-4 py-3.5 ring-1 ring-inset ring-red-200">
          <Warning size={18} className="mt-0.5 flex-none text-tm-red" />
          <span className="text-[13.5px] text-tm-red">管理キーが正しくありません。</span>
        </div>
      )}

      {/* ── ステータスカード ──── */}
      <div className="flex flex-col gap-3 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <b className="min-w-0 flex-1 text-[19px] leading-[1.45] tracking-[0.02em]" style={JP_DISPLAY}>
            {title}
          </b>
          {status === "open" ? (
            <span className="inline-flex flex-none items-center gap-[5px] rounded-full bg-tm-teal-100 px-3 py-1 text-[13px] font-semibold text-tm-teal-deep">
              <HandTap size={14} />
              受付中
            </span>
          ) : (
            <span className="inline-flex flex-none items-center gap-[5px] rounded-full bg-tm-gray-100 px-3 py-1 text-[13px] font-semibold text-tm-gray-600">
              締切済
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-[12px] bg-tm-gray-50 px-4 py-3">
          <Users size={20} className="text-tm-teal-hover" />
          <span className="font-[family-name:var(--tm-font-latin)] text-[26px] font-bold leading-none">
            {ballotCount.toLocaleString()}
          </span>
          <span className="text-[13px] text-tm-fg-muted">人が投票</span>
          {status === "open" && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-tm-fg-faint">
              <ArrowClockwise size={12} />
              15秒ごとに更新
            </span>
          )}
        </div>
        {closeAt && (
          <div className="flex items-center gap-1.5 text-[12.5px] leading-[1.7] text-tm-fg-muted">
            <Clock size={14} className="flex-none text-tm-teal-hover" />
            {status === "open"
              ? `${formatCloseAt(closeAt)} に自動で締め切ります`
              : `締切 ${formatCloseAt(closeAt)}`}
          </div>
        )}
        {resultsOpenAt && (
          <div className="flex items-center gap-1.5 text-[12.5px] leading-[1.7] text-tm-fg-muted">
            <Megaphone size={14} className="flex-none text-tm-teal-hover" />
            {resultsOpen
              ? `結果公開 ${formatCloseAt(resultsOpenAt)}（公開中）`
              : `${formatCloseAt(resultsOpenAt)} に結果を公開します（それまでは誰にも見えません）`}
          </div>
        )}
      </div>

      {/* ── URL ──── */}
      <div className="flex flex-col gap-4 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <CopyBox
          tone="share"
          label={
            <>
              <LinkIcon size={15} />
              参加URL（配布用）
            </>
          }
          value={shareUrl}
          note="チャットに貼る・QRで配る、どちらでもOK。誰でも投票できます。"
        />
        {qr && (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-tm-teal-hover bg-white px-3.5 py-2 text-[13px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
          >
            <QrCode size={15} />
            参加QRを大きく表示
          </button>
        )}
        <CopyBox
          tone="admin"
          label={
            <>
              <LockKey size={15} />
              管理URL（自分だけが保管）
            </>
          }
          value={adminUrl}
          note="このURLを知っている人が締切などの管理操作をできます。共有しないでください。"
        />
      </div>

      {/* ── 操作 ──── */}
      <div className="flex flex-col gap-2.5 rounded-[16px] border border-tm-border-soft bg-white p-4">
        <b className="text-[14px] tracking-[0.04em]">操作</b>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/p/${slug}/results`}
            className="inline-flex items-center gap-1.5 rounded-full border border-tm-teal-hover bg-white px-4 py-2.5 text-[13.5px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
          >
            <ChartBar size={16} />
            結果を見る
          </a>
          {resultsOpen && (
            <a
              href={`/p/${slug}/present`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-tm-teal-hover bg-white px-4 py-2.5 text-[13.5px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
            >
              <MonitorPlay size={16} />
              プレゼンモードで発表
            </a>
          )}
          {status === "closed" && !resultsOpen && (
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-tm-teal px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-tm-teal-hover disabled:opacity-50"
            >
              <Megaphone size={16} weight="fill" />
              {pending ? "公開中…" : "いま結果を公開する"}
            </button>
          )}
          {status === "open" && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-tm-red px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#c62f3b] disabled:opacity-50"
            >
              <StopCircle size={16} weight="fill" />
              {pending ? "締め切り中…" : "投票を締め切る"}
            </button>
          )}
        </div>
        {status === "open" && (
          <span className="text-[12.5px] leading-[1.75] text-tm-fg-muted">
            締め切ると受付中の票が確定します。
            {resultsOpenAt
              ? `結果ページ・プレゼンモードが見られるようになるのは ${formatCloseAt(resultsOpenAt)} からで、締め切ってもそれまでは誰にも見えません。`
              : "そのまま結果ページが開票の経過つきで表示されます。"}
            締切と同時刻の票が入り込まないよう、締切はDBの行ロックで受理と直列化されます。
          </span>
        )}
        {status === "closed" && !resultsOpen && (
          <span className="text-[12.5px] leading-[1.75] text-tm-fg-muted">
            投票は締め切り済みで、結果は公開待ちです。参加URLを知っている人が結果ページを開いても、
            公開時刻までは結果が出ません（あなたも同じ画面が出ます）。配信などに合わせて前倒しするなら
            「いま結果を公開する」を押してください。
          </span>
        )}
      </div>

      {/* ── 締切の確認モーダル ──── */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} ariaLabel="締切の確認" variant="center">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50">
            <StopCircle size={26} weight="fill" className="text-tm-red" />
          </span>
          <b className="text-[17px]">投票を締め切りますか？</b>
          <span className="text-[13.5px] leading-[1.75] text-tm-fg-muted">
            締め切ると再開できません。現在 {ballotCount.toLocaleString()}人の票で結果が確定し、
            {resultsOpenAt
              ? `結果発表ページ・プレゼンモードは ${formatCloseAt(resultsOpenAt)} から見られるようになります。`
              : "結果発表ページ・プレゼンモードが有効になります。"}
          </span>
          <div className="flex w-full flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-full bg-tm-red py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#c62f3b]"
            >
              締め切って結果を確定する
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-full border border-tm-gray-250 bg-white py-3 text-[14px] font-bold text-tm-gray-600 transition-colors hover:bg-tm-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 結果公開の確認モーダル ──── */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        ariaLabel="結果公開の確認"
        variant="center"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-tm-teal-100">
            <Megaphone size={26} weight="fill" className="text-tm-teal-deep" />
          </span>
          <b className="text-[17px]">いま結果を公開しますか？</b>
          <span className="text-[13.5px] leading-[1.75] text-tm-fg-muted">
            {resultsOpenAt
              ? `予約している ${formatCloseAt(resultsOpenAt)} を待たずに公開します。`
              : "結果ページとプレゼンモードを公開します。"}
            公開すると、参加URLを知っている人が結果を見られる状態になります（非公開には戻せません）。
          </span>
          <div className="flex w-full flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={publish}
              className="rounded-full bg-tm-teal py-3 text-[15px] font-bold text-white transition-colors hover:bg-tm-teal-hover"
            >
              いま公開する
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(false)}
              className="rounded-full border border-tm-gray-250 bg-white py-3 text-[14px] font-bold text-tm-gray-600 transition-colors hover:bg-tm-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </Modal>

      {/* ── QRモーダル ──── */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} ariaLabel="参加QRコード" variant="center">
        <div className="flex flex-col items-center gap-3 text-center">
          <b className="text-[16px]" style={JP_DISPLAY}>
            {title}
          </b>
          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element -- data URL のQR画像 */
            <img src={qr} alt={`参加URLのQRコード: ${shareUrl}`} className="w-full max-w-[320px] rounded-[12px]" />
          )}
          <span className="text-[13px] text-tm-fg-muted">スマホのカメラで読み取ると投票ページが開きます</span>
          <button
            type="button"
            onClick={() => setQrOpen(false)}
            className="self-stretch rounded-full bg-tm-teal py-3 text-[15px] font-bold text-white transition-colors hover:bg-tm-teal-hover"
          >
            閉じる
          </button>
        </div>
      </Modal>
    </main>
  );
}

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPollRowForAdmin, getBallotCount, ensureClosedIfDue } from "@/server/polls";
import { verifyAdminKey } from "@/lib/adminKey";
import { isResultsOpen } from "@/lib/closeAt";
import ManageClient from "./ManageClient";

export const dynamic = "force-dynamic";

// 管理 URL（?key=…）は絶対に検索インデックスへ載せない。
export const metadata = { title: "管理ページ", robots: { index: false, follow: false } };

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string; created?: string; err?: string }>;
}) {
  const { slug } = await params;
  const { key, created, err } = await searchParams;

  const row = await getPollRowForAdmin(slug);
  if (!row) notFound();

  if (!verifyAdminKey(key, row.admin_key_hash)) {
    return (
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
        <b
          className="font-[family-name:var(--tm-font-jp-display)] text-[22px] tracking-[0.04em]"
          style={{ fontWeight: 900 }}
        >
          管理ページ
        </b>
        <div className="rounded-[14px] bg-red-50 px-4 py-3.5 text-[13.5px] leading-[1.75] text-tm-red ring-1 ring-inset ring-red-200">
          管理キーが正しくありません。作成時に発行された管理URL（?key=… 付き）から開いてください。
        </div>
        <a
          href={`/p/${slug}`}
          className="flex items-center justify-center gap-2 rounded-full border border-tm-teal-hover bg-white px-4 py-3 text-[14.5px] font-bold text-tm-teal-deep transition-colors hover:border-tm-teal hover:bg-tm-teal hover:text-white"
        >
          投票ページへ
        </a>
      </main>
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const shareUrl = `${base}/p/${slug}`;
  const adminUrl = `${base}/p/${slug}/manage?key=${key}`;
  const ballotCount = await getBallotCount(row.id);
  // close_at を過ぎていれば、この表示の時点で締切を確定させる（管理ページが「受付中」の
  // まま見え続けないように）。受理側は close_at 到達で既に拒否している。
  const status = await ensureClosedIfDue(row);

  return (
    <ManageClient
      slug={slug}
      adminKey={key!}
      title={row.title}
      status={status}
      closeAt={row.close_at}
      resultsOpenAt={row.results_open_at}
      resultsOpen={isResultsOpen(status, row.results_open_at)}
      ballotCount={ballotCount}
      shareUrl={shareUrl}
      adminUrl={adminUrl}
      justCreated={created === "1"}
      authError={err === "auth"}
    />
  );
}

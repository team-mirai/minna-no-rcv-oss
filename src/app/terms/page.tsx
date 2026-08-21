import Link from "next/link";

export const metadata = {
  title: "利用規約・プライバシー",
  description:
    "みんなのRCV の利用規約とプライバシーポリシー。取得する情報、保存期間、禁止事項について。",
};

const SUPPORT_MAILTO =
  "mailto:contact@team-mir.ai?subject=%5B%E3%81%BF%E3%82%93%E3%81%AA%E3%81%AERCV%5D%20%E9%80%9A%E5%A0%B1%E3%83%BB%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B";

/** 見出し付きセクション（このページ専用の簡易レイアウト） */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-2">
      <h2 className="m-0 text-[16.5px] font-bold tracking-[0.03em] text-tm-teal-deep">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-[14px] leading-[1.9]">{children}</div>
    </section>
  );
}

/** 箇条書き（このページ専用） */
function List({ children }: { children: React.ReactNode }) {
  return <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-[18px] py-6 pb-16">
      <div className="flex flex-col gap-1">
        <b
          className="font-[family-name:var(--tm-font-jp-display)] text-[22px] tracking-[0.04em]"
          style={{ fontWeight: 900 }}
        >
          利用規約・プライバシー
        </b>
        <span className="text-[13px] text-tm-fg-muted">
          制定：2026年7月19日 ／ 最終改定：2026年7月25日
        </span>
      </div>

      {/* ── 最初に読んでほしい注意を、規約本文より前に置く ──── */}
      <div className="flex flex-col gap-2 rounded-[14px] bg-red-50 px-4 py-3.5 text-[13.5px] leading-[1.85] text-tm-red ring-1 ring-inset ring-red-200">
        <b className="text-[14px]">重要な注意</b>
        <span>
          本サービスは<b>プロトタイプ</b>であり、投票者の本人確認を行いません。二重投票や
          なりすましを技術的に防ぐ仕組みは入っていないため、投票結果は
          <b>参考値としてのみ</b>お使いください。公職選挙、法令に基づく投票、株主総会・
          社員総会などの法的な効果を有する正式な議決には利用できません。
        </span>
      </div>

      <Section id="about" title="1. このサービスについて">
        <p className="m-0">
          みんなのRCV（以下「本サービス」）は、優先順位付投票（Ranked Choice
          Voting）を誰でも無料で開催できるツールです。アカウント登録なしで利用でき、
          チームみらい（以下「運営者」）がプロトタイプとして提供しています。本サービスを
          利用した時点で、このページの内容に同意いただいたものとみなします。
        </p>
        <p className="m-0">
          本サービスで作成される投票（お題・説明・選択肢）は、すべて利用者が自ら作成する
          コンテンツです。運営者はその内容を事前に確認しておらず、内容について
          <b>作成者以外は責任を負いません</b>。運営者が作成・支持・推奨するものでもありません。
        </p>
      </Section>

      <Section id="disclaimer" title="2. 免責事項">
        <p className="m-0">
          本サービスは無償で、<b>現状有姿（AS IS）</b>で提供されます。運営者は次の事項について
          いかなる保証も行いません。
        </p>
        <List>
          <li>
            <b>投票結果の正確性・公正性</b>——本サービスは「1ブラウザ1票」の緩い一意性しか
            持たず、同一人物による複数投票や第三者による自動投票を防げません。集計処理そのものは
            決定的ですが、<b>入力される票が正しいことは保証しません</b>。
          </li>
          <li>
            <b>可用性</b>——予告なくサービスの中断・仕様変更・提供終了を行うことがあります。
            投票の受付中や開票中であっても同様です。
          </li>
          <li>
            <b>データの保全</b>——作成された投票・投票内容・集計結果は、後述の保存期間に
            関わらず、障害・運用上の判断・不具合により失われることがあります。バックアップからの
            復旧は保証しません。残しておきたい結果は、結果ページの内容をお手元に控えてください。
          </li>
          <li>
            <b>秘密性</b>——参加URL・管理URLを知っている人は誰でもアクセスできます。URLの
            管理は利用者の責任で行ってください。
          </li>
        </List>
        <p className="m-0">
          本サービスの利用に関連して利用者または第三者に生じた損害について、運営者は、運営者の
          故意または重大な過失による場合を除き、責任を負いません。利用者間または利用者と第三者との
          間で生じた紛争についても、当事者間で解決していただきます。
        </p>
      </Section>

      <Section id="prohibited" title="3. してはいけないこと">
        <List>
          <li>法令または公序良俗に反する利用</li>
          <li>
            <b>公職選挙法に抵触するおそれのある利用</b>。とくに、選挙に関し、公職の候補者
            （候補者となろうとする者を含む）について当選人を予想する人気投票を作成し、その経過
            または結果を公表する行為は、公職選挙法第138条の3により禁止されています。
          </li>
          <li>誹謗中傷・差別・ハラスメントにあたる内容の投稿</li>
          <li>第三者の個人情報（氏名・連絡先など）を本人の同意なく含める投稿</li>
          <li>第三者の著作権・商標権その他の権利を侵害する内容の投稿</li>
          <li>
            法令に基づく選挙、会社の株主総会その他の法的効果をもたらす決議のための利用
          </li>
          <li>
            不正アクセス、自動化された大量作成・大量投票、投票結果の操作、その他運営を妨げる行為
          </li>
          <li>その他、運営者が不適切と判断する利用</li>
        </List>
        <p className="m-0">
          これらに該当すると判断した場合、運営者は、事前の通知なく、該当する投票の削除・
          アクセスの制限を行うことがあります。
        </p>
      </Section>

      <Section id="privacy" title="4. データの取り扱い">
        <p className="m-0 font-bold">取得する情報</p>
        <List>
          <li>作成された投票の内容（お題・説明・選択肢）</li>
          <li>投票内容（どの選択肢を何位にしたか）</li>
          <li>ブラウザ単位の匿名キー（Cookie。氏名等とは結びつきません）</li>
          <li>
            荒らし対策・不正投票の事後検証のための<b>送信ログ</b>——送信のたびに、上記の匿名キー・
            投票内容・IPアドレスの鍵付きハッシュ・ブラウザ情報（User-Agent）・日時を記録します。
            投票をやり直した場合、その履歴も残ります。
          </li>
        </List>
        <p className="m-0">
          氏名やメールアドレスの登録は求めません。IPアドレスは平文では保存せず、秘密鍵つきの
          ハッシュとしてのみ保持します。
        </p>

        <p className="m-0 mt-1 font-bold">使いかた</p>
        <List>
          <li>
            個々の投票内容は、集計・ご本人による順位の再編集・不正投票の検証にのみ使い、公開しません
            （結果ページに表示されるのは集計値だけです）。第三者への提供や広告目的の利用は行いません。
          </li>
          <li>
            運営者は、システムの運用上、送信ログを通じて個々の送信内容を確認できる状態にあります。
            <b>投票の秘密は運営者に対しては保証されません</b>。秘匿性が求められる用途には
            利用しないでください。
          </li>
        </List>

        <p className="m-0 mt-1 font-bold">保存期間</p>
        <List>
          <li>
            投票データ（お題・選択肢・票・集計結果）：最終更新から1年を経過したものは、予告なく
            削除することがあります。
          </li>
          <li>
            プロトタイプのため、提供を終了する場合には、これより前にすべてのデータを削除することが
            あります。
          </li>
        </List>

        <p className="m-0 mt-1 font-bold">削除のご依頼</p>
        <p className="m-0">
          作成した投票の削除や、ご自身の投票内容の削除をご希望の場合は、対象ページのURLを添えて
          下記の窓口までご連絡ください。作成者ご本人であることの確認のため、管理URLの提示を
          お願いすることがあります。
        </p>

        <p className="m-0 mt-1 font-bold">委託先・保管場所</p>
        <p className="m-0">
          本サービスは Vercel および Supabase のインフラ上で稼働しており、データは日本国外の
          サーバに保管されることがあります。個人情報の取り扱いは、運営者であるチームみらいの{" "}
          <a
            href="https://team-mir.ai/policies/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-tm-teal-deep underline underline-offset-2"
          >
            プライバシーポリシー
          </a>
          に従います。
        </p>
      </Section>

      <Section id="report" title="5. 通報・お問い合わせ">
        <p className="m-0">
          不適切な投票を見つけた場合や、本サービスについてのお問い合わせ・削除のご依頼は、
          <b>該当ページのURLを添えて</b>下記までご連絡ください。内容を確認のうえ、必要と判断した
          場合は削除等の対応を行います。
        </p>
        <p className="m-0">
          <a
            href={SUPPORT_MAILTO}
            className="font-[family-name:var(--tm-font-latin)] text-tm-teal-deep underline underline-offset-2"
          >
            contact@team-mir.ai
          </a>
        </p>
      </Section>

      <Section id="provider" title="6. 提供者・準拠法">
        <p className="m-0">
          本サービスは{" "}
          <a
            href="https://team-mir.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-tm-teal-deep underline underline-offset-2"
          >
            チームみらい
          </a>{" "}
          が提供しています。本規約の準拠法は日本法とし、本サービスに関して紛争が生じた場合は、
          東京地方裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
        <p className="m-0">
          本規約は予告なく改定することがあります。改定後の内容は、このページに掲示した時点から
          効力を生じます。
        </p>
      </Section>

      <div className="pt-2">
        <Link
          href="/"
          className="text-[13.5px] font-semibold text-tm-teal-deep underline underline-offset-2"
        >
          トップにもどる
        </Link>
      </div>
    </main>
  );
}

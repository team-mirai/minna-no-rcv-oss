import CreatePollForm from "./CreatePollForm";

export const metadata = {
  title: "投票をつくる",
  description:
    "お題と選択肢を入れるだけ。アカウント登録は不要で、参加URLと管理URLがその場で発行されます。",
};

export default function NewPollPage() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-[18px] py-5 pb-16">
      <div className="flex flex-col gap-1">
        <h1
          className="font-[family-name:var(--tm-font-jp-display)] text-[22px] tracking-[0.04em]"
          style={{ fontWeight: 900 }}
        >
          投票をつくる
        </h1>
        <span className="text-[13.5px] leading-[1.75] text-tm-fg-muted">
          お題と選択肢（2つ以上）を入れるだけ。アカウント登録は不要です。
        </span>
      </div>
      <CreatePollForm />
    </main>
  );
}

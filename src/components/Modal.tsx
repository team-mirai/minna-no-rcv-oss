"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";

/** ダイアログ内で Tab 移動の対象になる要素 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * 汎用ダイアログ（移植元アプリの components/Modal.tsx の移植・center/sheet）。
 * document.body に直接ポータルし、fixed 配置が親レイアウトにクリップされないようにする。
 *
 * フォーカス管理（WAI-ARIA APG の Modal Dialog Pattern）:
 * - 開いたら initialFocusRef（無ければパネル内の最初の操作要素）へフォーカスを移す
 * - 開いている間は背景（body 直下の他の要素）を inert にし、Tab / Shift+Tab はパネル内で循環させる
 * - 閉じたら returnFocusRef（無ければ開く前にフォーカスしていた要素）へ戻す。
 *   OK・Escape・背景クリックのどれで閉じても同じ扱い
 */
export function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  variant = "sheet",
  panelClassName,
  initialFocusRef,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  /** "sheet"=下からのボトムシート（既定） / "center"=中央モーダル（投票完了等）。 */
  variant?: "sheet" | "center";
  /** center variant のパネル内側クラス（余白の上書き）。既定は上下20px・左右18px。 */
  panelClassName?: string;
  /** 開いたときに最初にフォーカスする要素。読ませたい見出しなどは tabIndex={-1} を付けて渡す */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * 閉じたときにフォーカスを戻す要素。開くきっかけの要素が状態遷移で消える場合
   * （投票完了で投票ボタンが done 画面に置き換わる等）に指定する。
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // フォーカス管理の effect は open の変化だけで動かしたい（onClose は毎描画で変わりうる）
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;
  const returnFocusRefRef = useRef(returnFocusRef);
  returnFocusRefRef.current = returnFocusRef;

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // 背景を支援技術とキーボードの両方から外す。元から inert だった要素は触らない
    const inerted: HTMLElement[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === overlay || !(el instanceof HTMLElement) || el.inert) continue;
      el.inert = true;
      inerted.push(el);
    }

    const initial = initialFocusRefRef.current?.current ?? focusableIn(panel)[0] ?? panel;
    initial.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // パネル外（またはパネル自身・tabIndex=-1 の見出し）にいるときも端で折り返す
      const inItems = active instanceof HTMLElement && items.includes(active);
      if (e.shiftKey && (active === first || !inItems)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inItems)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      for (const el of inerted) el.inert = false;
      // 閉じる操作と同じ描画で戻り先が差し替わることがあるので、描画後に戻す
      requestAnimationFrame(() => {
        const target = returnFocusRefRef.current?.current ?? previouslyFocused;
        if (target?.isConnected) target.focus();
      });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  if (variant === "center") {
    return createPortal(
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.5)] p-[26px] [animation:tm-fade_.18s_ease]"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={
            "max-h-[88vh] w-full max-w-[420px] overflow-y-auto rounded-[16px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.28)] outline-none " +
            (panelClassName ?? "px-[18px] py-5")
          }
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-end justify-center bg-tm-black/45 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[20px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--tm-shadow-card)] outline-none [animation:tm-slide-up_.22s_ease] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

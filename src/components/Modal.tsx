"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * 汎用ダイアログ（移植元アプリの components/Modal.tsx の移植・center/sheet）。
 * document.body に直接ポータルし、fixed 配置が親レイアウトにクリップされないようにする。
 */
export function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  variant = "sheet",
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  /** "sheet"=下からのボトムシート（既定） / "center"=中央モーダル（投票完了等）。 */
  variant?: "sheet" | "center";
  /** center variant のパネル内側クラス（余白の上書き）。既定は上下20px・左右18px。 */
  panelClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  if (variant === "center") {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.5)] p-[26px] [animation:tm-fade_.18s_ease]"
        onClick={onClose}
      >
        <div
          className={
            "max-h-[88vh] w-full max-w-[420px] overflow-y-auto rounded-[16px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.28)] " +
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
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-end justify-center bg-tm-black/45 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[20px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--tm-shadow-card)] [animation:tm-slide-up_.22s_ease] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

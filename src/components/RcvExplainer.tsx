"use client";

import { useState } from "react";
import { CaretDown, CaretUp, Info } from "@phosphor-icons/react";

/**
 * 「RCV（優先順位付投票）とは」の折りたたみ説明（デフォルト閉）。
 * 移植元アプリの components/RcvExplainer.tsx の移植（文言のみ汎用化）。
 */
export function RcvExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-tm-gray-50 rounded-[14px] flex-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-[7px] px-4 py-3.5 text-left cursor-pointer"
      >
        <Info size={18} className="text-tm-gray-500 shrink-0" />
        <b className="flex-1 text-[14px] text-tm-gray-600">RCV（優先順位付投票）とは</b>
        {open ? (
          <CaretUp size={16} className="text-tm-gray-500 shrink-0" />
        ) : (
          <CaretDown size={16} className="text-tm-gray-500 shrink-0" />
        )}
      </button>
      {open && (
        <p className="px-4 pb-3.5 text-pretty text-[14px] leading-[1.75] text-tm-gray-700 m-0">
          希望する候補だけに「1位、2位、3位…」と順位をつけて投票する方式です。1位票が最も少ない候補を除外し、その票を次の順位の候補に移す集計を、どれかが過半数に達するまで繰り返します。似た候補で票が割れず、「広く支持される選択」が残りやすくなります。
        </p>
      )}
    </div>
  );
}

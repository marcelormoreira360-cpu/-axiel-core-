"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { setFinanceRoleAction } from "./actions";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  finance_role: string | null;
};

const FINANCE_ROLE_OPTIONS = ["cfo", "controller", "billing", "pricing", "cpa"] as const;

export function PermissoesClient({ members }: { members: Member[] }) {
  const t = useTranslations("finance.permissions");
  return (
    <div className="divide-y divide-black/[.04]">
      {members.map((m) => (
        <MemberRow key={m.id} member={m} t={t} />
      ))}
    </div>
  );
}

function MemberRow({ member, t }: { member: Member; t: (k: string) => string }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(member.finance_role ?? "");

  function onChange(next: string) {
    setValue(next);
    startTransition(() => setFinanceRoleAction(member.id, next));
  }

  const inputCls =
    "text-[12px] text-[#0F1A2E] bg-white border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[6px] outline-none focus:border-[#0F6E56]/50 transition disabled:opacity-60";

  return (
    <div className="flex items-center gap-[12px] px-[16px] py-[11px]">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[#0F1A2E] truncate">{member.full_name || member.email || "—"}</p>
        <p className="text-[10px] text-[#A09E98]">{member.email}</p>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={pending} className={inputCls}>
        <option value="">{t("none")}</option>
        {FINANCE_ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {t(`role_${r}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

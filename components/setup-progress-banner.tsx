"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ArrowRight, X } from "lucide-react";

const STORAGE_KEY = "axiel-setup-banner-dismissed";

export type SetupTask = {
  key: string;
  title: string;
  href: string;
  done: boolean;
};

interface Props {
  tasks: SetupTask[];
}

export function SetupProgressBanner({ tasks }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  // Don't flash on first render
  if (dismissed === null) return null;

  const done  = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const allDone = done === total;

  // Hide when all done or dismissed
  if (allDone || dismissed) return null;

  const nextTask = tasks.find((t) => !t.done);
  const pct = Math.round((done / total) * 100);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="mb-[20px] bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      {/* Top row */}
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-[8px]">
          <p className="text-[11px] font-semibold text-[#0F1A2E]">Configuração inicial</p>
          <span className="text-[10px] font-medium text-[#0F6E56] bg-[#E1F5EE] px-[7px] py-[2px] rounded-full">
            {done}/{total} concluídos
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-[#D3D1C7] hover:text-[#A09E98] transition"
          aria-label="Dispensar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[5px] bg-[#F4F3EF] rounded-full overflow-hidden mb-[12px]">
        <div
          className="h-full bg-[#0F6E56] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Task pills */}
      <div className="flex items-center gap-[6px] flex-wrap mb-[12px]">
        {tasks.map((task) => (
          <div
            key={task.key}
            className={`flex items-center gap-[4px] text-[10px] font-medium rounded-full px-[8px] py-[3px] border ${
              task.done
                ? "border-[#0F6E56]/20 bg-[#E1F5EE] text-[#085041]"
                : "border-black/[.08] bg-[#F4F3EF] text-[#A09E98]"
            }`}
          >
            {task.done
              ? <CheckCircle2 className="h-3 w-3" />
              : <Circle className="h-3 w-3" />
            }
            {task.title}
          </div>
        ))}
      </div>

      {/* Next action */}
      <div className="flex items-center justify-between">
        {nextTask && (
          <p className="text-[11px] text-[#6B6A66]">
            Próximo: <span className="font-medium text-[#0F1A2E]">{nextTask.title}</span>
          </p>
        )}
        <div className="flex items-center gap-[8px] ml-auto">
          {nextTask && (
            <Link
              href={nextTask.href}
              className="flex items-center gap-[4px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[12px] py-[6px] rounded-[7px]"
            >
              Fazer agora <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          <Link
            href="/get-started"
            className="text-[11px] font-medium text-[#A09E98] hover:text-[#0F1A2E] transition"
          >
            Ver tudo
          </Link>
        </div>
      </div>
    </div>
  );
}

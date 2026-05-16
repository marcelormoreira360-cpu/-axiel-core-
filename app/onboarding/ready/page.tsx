import Link from "next/link";
import { ArrowRight, CheckCircle2, LayoutDashboard, UserRound } from "lucide-react";
import { Shell } from "@/components/shell";

export default function OnboardingReadyPage() {
  return (
    <Shell>
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-[3rem] bg-axiel-ink p-10 text-center text-white shadow-sm md:p-16">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
            <CheckCircle2 className="h-10 w-10 text-axiel-gold" />
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-axiel-gold">
            Setup complete
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
            Your clinic is ready.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/70">
            Your clinic is ready. Let’s get started.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-axiel-ink transition hover:bg-white/90 sm:w-auto"
            >
              <LayoutDashboard className="h-5 w-5" />
              Go to Dashboard
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-8 text-base font-semibold text-white/90 transition hover:bg-white/10 sm:w-auto"
            >
              <UserRound className="h-5 w-5" />
              Start with your first patient
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mx-auto mt-8 max-w-lg text-sm leading-6 text-white/45">
            We created sample data so you can explore the system without feeling lost.
          </p>
        </div>
      </section>
    </Shell>
  );
}

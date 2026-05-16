"use client";

import { Button } from "@/components/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">AXIEL Core</p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">Something needs attention</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The system protected your data and stopped the action safely. Please try again. If it continues, contact support.
            </p>
            {error?.digest ? <p className="mt-3 text-xs text-slate-400">Reference: {error.digest}</p> : null}
            <Button onClick={reset} className="mt-6 w-full">Try again</Button>
          </div>
        </main>
      </body>
    </html>
  );
}

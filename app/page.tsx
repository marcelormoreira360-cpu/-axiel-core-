import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound, UsersRound } from "lucide-react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] px-6 py-8 text-axiel-ink">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col justify-center">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold tracking-[0.28em] text-axiel-gold">AXIEL CORE</p>
          <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">Run the clinic from one simple screen.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-black/60">
            Patients, leads, schedule, follow-ups, insights, and AI placeholders — organized so a non-technical team can understand it quickly.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/dashboard"><Button>Open AXIEL Core <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link href="/auth/login"><Button variant="secondary">Sign in</Button></Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: UserRound, title: "Patients", text: "Open one record and see everything important." },
            { icon: UsersRound, title: "Leads", text: "Drag people through a simple pipeline." },
            { icon: CalendarDays, title: "Schedule", text: "Book generic sessions with minimal clicks." },
          ].map((item) => (
            <Card key={item.title} className="p-6">
              <item.icon className="h-7 w-7 text-axiel-gold" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-black/55">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

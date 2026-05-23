import type { Metadata } from "next";
import { Card } from "@/components/card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Criar conta | AXIEL Core",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string }>;
}) {
  const { invite, email } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff_0,#fbfaf7_48%,#f1eee8_100%)] px-6">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">AXIEL CORE</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Criar conta</h1>
          <p className="mt-2 text-sm leading-6 text-black/55">
            {invite
              ? "Você foi convidado para uma clínica. Crie sua conta para aceitar o convite."
              : "Crie sua conta para começar."}
          </p>
          <SignupForm inviteToken={invite} prefillEmail={email} />
        </Card>
        <p className="text-center text-xs text-black/30">
          Ao criar sua conta, você concorda com nossos{" "}
          <a href="/termos" className="underline hover:text-black/50 transition" target="_blank" rel="noopener noreferrer">
            Termos de Uso
          </a>{" "}
          e{" "}
          <a href="/privacidade" className="underline hover:text-black/50 transition" target="_blank" rel="noopener noreferrer">
            Política de Privacidade
          </a>.
        </p>
      </div>
    </main>
  );
}

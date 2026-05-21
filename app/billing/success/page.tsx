import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { Button } from "@/components/button";

export default function BillingSuccessPage() {
  return (
    <Shell>
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Assinatura atualizada</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sua assinatura está sendo ativada</h1>
        <p className="mt-4 text-lg text-black/55">O Stripe confirmará a assinatura via webhook seguro. O acesso da sua clínica será atualizado automaticamente.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/dashboard"><Button>Ir ao dashboard</Button></Link>
          <Link href="/billing"><Button variant="secondary">Ver cobrança</Button></Link>
        </div>
      </Card>
    </Shell>
  );
}

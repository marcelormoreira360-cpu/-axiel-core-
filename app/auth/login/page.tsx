import { Card } from "@/components/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff_0,#fbfaf7_48%,#f1eee8_100%)] px-6">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">AXIEL CORE</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-2 text-sm leading-6 text-black/55">Acesse sua conta com e-mail e senha.</p>
          <LoginForm />
        </Card>
        <p className="text-center text-xs text-black/30">
          Ao acessar, você concorda com nossos{" "}
          <a href="/termos" className="underline hover:text-black/50 transition" target="_blank">Termos de Uso</a>
          {" "}e{" "}
          <a href="/privacidade" className="underline hover:text-black/50 transition" target="_blank">Política de Privacidade</a>.
        </p>
      </div>
    </main>
  );
}

import { Card } from "@/components/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff_0,#fbfaf7_48%,#f1eee8_100%)] px-6">
      <Card className="w-full max-w-md">
        <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">AXIEL CORE</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-black/55">This starter screen is ready for Supabase email/password or magic-link authentication.</p>
<LoginForm />
      </Card>
    </main>
  );
}

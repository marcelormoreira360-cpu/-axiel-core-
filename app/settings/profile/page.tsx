import { Shell } from "@/components/shell";
import { ProfileForm } from "./profile-form";

export default function ProfilePage() {
  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Configurações</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="mt-3 text-lg text-black/55">Atualize seus dados de acesso.</p>
      </div>
      <ProfileForm />
    </Shell>
  );
}

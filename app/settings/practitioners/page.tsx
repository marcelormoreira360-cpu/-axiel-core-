import { redirect } from "next/navigation";

// "Profissionais" foi unificado com "Equipe" numa tela só com abas.
// Esta rota agora redireciona para a aba "Perfil público" de /settings/equipe.
// (A lista e as actions continuam vivas em practitioners-list.tsx / actions.ts,
//  reusadas pela aba.)
export default function PractitionersPage() {
  redirect("/settings/equipe?tab=perfil");
}

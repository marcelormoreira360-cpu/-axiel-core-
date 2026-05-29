import { redirect } from "next/navigation";

/**
 * /schedule/[id] — redireciona para a página de registro de sessão.
 * Evita 404 quando links de agendamento são acessados diretamente.
 */
export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/schedule/${id}/session`);
}

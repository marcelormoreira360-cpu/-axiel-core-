import type { Patient } from "@/lib/types";
import { Button } from "@/components/button";
import { MESSAGE_AUTOMATION_STATUS } from "@/modules/follow-ups/message-placeholder";
import { VoiceDictation } from "@/components/voice-dictation";

export function FollowUpForm({ patients, action }: { patients: Patient[]; action: (formData: FormData) => Promise<void> }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <p className="text-sm font-semibold text-black/75">Criar lembrete</p>
        <p className="mt-1 text-xs leading-5 text-black/45">Estrutura simples. Nada é enviado automaticamente.</p>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Paciente
        <select name="patient_id" required className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="">Selecione o paciente</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.full_name}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        Título do lembrete
        <input name="title" defaultValue="Lembrete de próxima sessão" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-black/65">
          Data
          <input name="date" type="date" required defaultValue={defaultDate} className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
        <label className="block text-sm font-semibold text-black/65">
          Horário
          <input name="time" type="time" required defaultValue="09:00" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Modelo de mensagem
        <select name="channel" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="none">Sem mensagem</option>
          <option value="email">Modelo de e-mail</option>
          <option value="sms">Modelo de SMS</option>
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        Observações
        <VoiceDictation
          name="notes"
          placeholder="Nota interna opcional — clique no 🎤 para ditar"
          rows={3}
          textareaClassName="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 pr-8 text-sm outline-none focus:border-black/25"
        />
      </label>

      <div className="rounded-3xl bg-axiel-soft p-4 text-xs leading-5 text-black/50">
        {MESSAGE_AUTOMATION_STATUS}
      </div>

      <Button className="min-h-14 w-full text-base">Criar lembrete</Button>
    </form>
  );
}

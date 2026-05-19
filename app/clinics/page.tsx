import { Building2, Users } from "lucide-react";
import { revalidatePath } from "next/cache";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { ClinicEditForm } from "@/components/clinic-edit-form";
import { getClinicsForUser, updateClinic, getCurrentClinic } from "@/services/clinic-service";
import { getUsersForCurrentScope } from "@/services/user-service";
import { roleLabels } from "@/modules/auth/roles";

export default async function ClinicsPage() {
  const [clinics, users, myClinic] = await Promise.all([
    getClinicsForUser(),
    getUsersForCurrentScope(),
    getCurrentClinic(),
  ]);

  async function updateClinicAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (!id || !name || !slug) throw new Error("Campos obrigatórios.");
    await updateClinic(id, { name, slug });
    revalidatePath("/clinics");
    revalidatePath("/settings");
  }

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">ORGANIZATION</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Clinics</h1>
        <p className="mt-3 max-w-2xl text-black/55">Admins see every clinic. Clinic Owners and Staff only see their own clinic.</p>
      </header>

      {/* My clinic — editable */}
      {myClinic && (
        <div className="mb-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[10px]">
            Minha clínica
          </h2>
          <Card className="p-[16px]">
            <ClinicEditForm
              id={myClinic.id}
              name={myClinic.name}
              slug={myClinic.slug}
              updateAction={updateClinicAction}
            />
          </Card>
        </div>
      )}

      <div className="grid gap-3">
        {clinics.filter((c) => c.id !== myClinic?.id).slice(0, 5).map((clinic) => (
          <Card key={clinic.id}>
            <h2 className="font-semibold">{clinic.name}</h2>
            <p className="mt-1 text-sm text-black/50">/{clinic.slug} · {clinic.status}</p>
          </Card>
        ))}
        {clinics.length > 5 ? (
          <LimitedList items={clinics.slice(5)} detailsLabel={`View ${clinics.length - 5} more clinics`} renderItem={(clinic) => (
            <Card key={clinic.id}>
              <h2 className="font-semibold">{clinic.name}</h2>
              <p className="mt-1 text-sm text-black/50">/{clinic.slug} · {clinic.status}</p>
            </Card>
          )} />
        ) : null}
        {clinics.length === 0 && (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="No clinic connected yet"
            text="Finish onboarding to connect this user to a clinic and unlock the workspace."
            href="/onboarding"
            action="Start onboarding"
          />
        )}
      </div>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Team</h2>
      <div className="grid gap-3">
        {users.slice(0, 5).map((user) => (
          <Card key={user.id} className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{user.full_name || user.email || "Unnamed user"}</h3>
              <p className="mt-1 text-sm text-black/50">{user.email ?? "No email"}</p>
            </div>
            <span className="rounded-full bg-axiel-soft px-3 py-1 text-xs font-medium">{roleLabels[user.role]}</span>
          </Card>
        ))}
        {users.length > 5 ? (
          <LimitedList items={users.slice(5)} detailsLabel={`View ${users.length - 5} more team members`} renderItem={(user) => (
            <Card key={user.id} className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">{user.full_name || user.email || "Unnamed user"}</h3>
                <p className="mt-1 text-sm text-black/50">{user.email ?? "No email"}</p>
              </div>
              <span className="rounded-full bg-axiel-soft px-3 py-1 text-xs font-medium">{roleLabels[user.role]}</span>
            </Card>
          )} />
        ) : null}
        {users.length === 0 && (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="No team members yet"
            text="Invite the first staff member when the clinic is ready to grow."
            href="/onboarding"
            action="Invite staff"
          />
        )}
      </div>
    </Shell>
  );
}

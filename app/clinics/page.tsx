import { Building2, Users } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { getClinicsForUser } from "@/services/clinic-service";
import { getUsersForCurrentScope } from "@/services/user-service";
import { roleLabels } from "@/modules/auth/roles";

export default async function ClinicsPage() {
  const [clinics, users] = await Promise.all([getClinicsForUser(), getUsersForCurrentScope()]);

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">ORGANIZATION</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Clinics</h1>
        <p className="mt-3 max-w-2xl text-black/55">Admins see every clinic. Clinic Owners and Staff only see their own clinic.</p>
      </header>
      <div className="grid gap-3">
        {clinics.slice(0, 5).map((clinic) => (
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

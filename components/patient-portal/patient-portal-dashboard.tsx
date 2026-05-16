import Link from "next/link";
import { CalmMessage } from "@/components/ui/calm-message";
import { Card } from "@/components/ui/card";
import { ButtonPrimary } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { getTerm } from "@/modules/ui/terminology";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function shortText(value: string, maxLength = 180) {
  const clean = value?.trim();
  if (!clean) return "Your clinic will add an update here when it is ready.";
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 3)}...` : clean;
}

export function PatientPortalDashboard({ data }: { data: PatientPortalData }) {
  const firstName = data.patient.full_name.split(" ")[0] ?? data.patient.full_name;

  return (
    <div className="bg-axiel-background min-h-screen p-4 md:p-8 space-y-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-axiel-text-primary">
            Your Progress
          </h1>
          <p className="text-sm text-axiel-text-secondary">
            {firstName}
          </p>
        </div>

        {/* Calm message */}
        <CalmMessage>
          You are on the right path. This is part of your progress.
        </CalmMessage>



        {/* Simple Snapshot */}
        <Card>
          <h2 className="text-sm font-semibold text-axiel-text-primary">
            Patient Snapshot
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-axiel-text-secondary">
            {data.latestInsight
              ? shortText(data.latestInsight.summary, 140)
              : "Your clinic is reviewing your information."}
          </p>
          <div className="mt-4 rounded-2xl bg-axiel-background p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">
              {getTerm("nextStep")}
            </p>
            <p className="mt-1 text-sm leading-6 text-axiel-text-primary">
              {shortText(data.nextStep, 120)}
            </p>
          </div>
        </Card>

        {/* Latest Insight */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-axiel-text-primary">
              Latest {getTerm("insight")}
            </h2>
            {data.latestInsight ? (
              <Badge status={data.latestInsight.status} />
            ) : (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                Coming soon
              </span>
            )}
          </div>

          <h3 className="mt-3 text-base font-semibold text-axiel-text-primary">
            {data.latestInsight?.title ?? "No insight yet"}
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-axiel-text-secondary">
            {data.latestInsight
              ? shortText(data.latestInsight.summary)
              : "Your clinic will share a simple update here when it is ready."}
          </p>
        </Card>

        {/* Timeline */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-axiel-text-primary">
            Your {getTerm("session", "plural")}
          </h2>

          <div className="space-y-2">
            {data.sessions.length ? (
              data.sessions.slice(0, 5).map((session, index) => (
                <div
                  key={session.id ?? index}
                  className="flex justify-between gap-4 text-sm text-axiel-text-secondary"
                >
                  <span>{getTerm("session")} {index + 1}</span>
                  <span>{formatDate(session.starts_at)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-axiel-text-secondary">
                Your sessions will appear here after your first visit.
              </p>
            )}
          </div>
        </Card>

        {/* Next Step */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-axiel-text-primary">
            {getTerm("nextStep")}
          </h2>

          <p className="text-sm leading-relaxed text-axiel-text-secondary">
            {shortText(data.nextStep, 160)}
          </p>
        </Card>

        {/* WhatsApp */}
        {data.whatsappUrl ? (
          <Link href={data.whatsappUrl} target="_blank" rel="noreferrer" className="block">
            <ButtonPrimary className="w-full">
              Talk to your practitioner
            </ButtonPrimary>
          </Link>
        ) : (
          <Card>
            <p className="text-center text-sm text-axiel-text-secondary">
              Contact your clinic if you have a question.
            </p>
          </Card>
        )}

        <p className="pb-2 text-center text-xs leading-5 text-axiel-text-secondary">
          This page is private. Please do not share this link.
        </p>
      </div>
    </div>
  );
}

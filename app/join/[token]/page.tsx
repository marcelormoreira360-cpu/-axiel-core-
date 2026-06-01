import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getInviteByToken, acceptInvite, ROLE_LABELS } from "@/services/team-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

async function getClinicName(clinicId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("clinics").select("name").eq("id", clinicId).single();
  return (data?.name as string | null) ?? "Clínica";
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const t = await getTranslations("join");

  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] px-4">
        <div className="bg-white rounded-2xl border border-black/[.07] p-8 max-w-sm w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="text-[18px] font-semibold text-[#0F1A2E] mb-2">{t("invalidTitle")}</h1>
          <p className="text-[13px] text-[#A09E98]">
            {t("invalidDesc")}
          </p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  const profile = await getCurrentUserProfile();
  const clinicName = await getClinicName(invite.clinic_id);

  // If logged in, accept automatically and redirect
  if (profile) {
    try {
      await acceptInvite(token, profile.id);
    } catch {
      // Already accepted or error
    }
    redirect("/dashboard?joined=1");
  }

  // Not logged in — show a page directing them to sign up/login
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const loginUrl = `${appUrl}/auth/login?invite=${token}&email=${encodeURIComponent(invite.email)}`;
  const signupUrl = `${appUrl}/auth/signup?invite=${token}&email=${encodeURIComponent(invite.email)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] px-4">
      <div className="bg-white rounded-2xl border border-black/[.07] p-8 max-w-sm w-full text-center">
        {/* Logo placeholder */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B1F3A]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-1">{t("eyebrow")}</p>
        <h1 className="text-[20px] font-semibold text-[#0F1A2E] mb-1">{clinicName}</h1>
        <p className="text-[13px] text-[#6B6A66] mb-1">
          {t.rich("invitedAs", { role: ROLE_LABELS[invite.role], b: (c) => <strong>{c}</strong> })}
        </p>
        <p className="text-[12px] text-[#A09E98] mb-6">{invite.email}</p>

        <div className="space-y-2">
          <a
            href={signupUrl}
            className="flex items-center justify-center w-full rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white hover:bg-black transition"
          >
            {t("createAccept")}
          </a>
          <a
            href={loginUrl}
            className="flex items-center justify-center w-full rounded-lg border border-black/15 py-2.5 text-[13px] font-medium text-[#6B6A66] hover:bg-[#F4F3EF] transition"
          >
            {t("haveAccount")}
          </a>
        </div>

        <p className="text-[11px] text-[#D3D1C7] mt-5">
          {t("accessNote", { name: clinicName })}
        </p>
      </div>
    </div>
  );
}

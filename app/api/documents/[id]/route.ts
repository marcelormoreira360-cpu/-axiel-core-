import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Verify authentication
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Get the document and verify clinic ownership
  const admin = createSupabaseAdminClient();
  const { data: doc } = await admin
    .from("patient_documents")
    .select("file_path, file_name, clinic_id")
    .eq("id", id)
    .single();

  if (!doc) return new NextResponse("Not found", { status: 404 });

  // Check user belongs to the same clinic
  const { data: profile } = await admin
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.clinic_id !== doc.clinic_id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Generate signed URL (1 hour)
  const { data } = await admin.storage
    .from("patient-docs")
    .createSignedUrl(doc.file_path, 3600, {
      download: doc.file_name,
    });

  if (!data?.signedUrl) return new NextResponse("Could not generate URL", { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}

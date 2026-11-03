import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ updateId: string }> },
) {
  const { updateId } = await params;
  if (!uuidPattern.test(updateId)) {
    return NextResponse.json({ error: "Invalid progress update." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return NextResponse.json(
      { error: "Unable to verify your account." },
      { status: 401 },
    );
  }
  if (!userData.user) {
    return NextResponse.json({ error: "Sign in to download this file." }, { status: 401 });
  }

  const { data: update, error: updateError } = await supabase
    .from("project_milestone_updates")
    .select("storage_path, file_name")
    .eq("id", updateId)
    .maybeSingle();
  if (updateError) {
    return NextResponse.json(
      { error: `Unable to load progress attachment: ${updateError.message}` },
      { status: 500 },
    );
  }
  if (!update?.storage_path) {
    return NextResponse.json({ error: "Progress attachment not found." }, { status: 404 });
  }

  const { data: signedUrl, error: signingError } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(update.storage_path, 60, {
      download: update.file_name ?? true,
    });
  if (signingError || !signedUrl) {
    return NextResponse.json(
      {
        error: `Unable to create a secure download link: ${signingError?.message ?? "No signed link was returned."}`,
      },
      { status: 500 },
    );
  }
  return NextResponse.redirect(signedUrl.signedUrl);
}

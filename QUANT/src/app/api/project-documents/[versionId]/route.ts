import { NextResponse } from "next/server";
import { createSupabaseActionClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  if (!uuidPattern.test(versionId)) {
    return NextResponse.json({ error: "Document version not found." }, {
      status: 404,
    });
  }

  const supabase = await createSupabaseActionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sign in to download this document." }, {
      status: 401,
    });
  }

  const { data: version, error: versionError } = await supabase
    .from("project_document_versions")
    .select("storage_path")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) {
    console.error("Unable to load project document version:", versionError.message);
    return NextResponse.json(
      { error: "Unable to load this document version." },
      { status: 500 },
    );
  }
  if (!version) {
    return NextResponse.json({ error: "Document version not found." }, {
      status: 404,
    });
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(version.storage_path, 60, { download: true });
  if (signedUrlError) {
    console.error("Unable to create project document download link:", signedUrlError.message);
    return NextResponse.json(
      { error: "Unable to create a secure download link." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signedUrl.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

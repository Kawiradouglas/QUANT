import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  if (!uuidPattern.test(documentId)) {
    return NextResponse.json({ error: "Invalid payment document." }, { status: 400 });
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
    return NextResponse.json(
      { error: "Sign in to download this document." },
      { status: 401 },
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("project_payment_application_documents")
    .select("storage_path, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (documentError) {
    return NextResponse.json(
      { error: `Unable to load payment document: ${documentError.message}` },
      { status: 500 },
    );
  }
  if (!document) {
    return NextResponse.json(
      { error: "Payment document not found." },
      { status: 404 },
    );
  }

  const { data: signedUrl, error: signingError } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(document.storage_path, 60, {
      download: document.file_name,
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

import { NextResponse } from "next/server";
import { createSupabaseActionClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  if (!uuidPattern.test(submissionId)) {
    return NextResponse.json({ error: "Task submission not found." }, {
      status: 404,
    });
  }

  const supabase = await createSupabaseActionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Sign in to download this task submission." },
      { status: 401 },
    );
  }

  const { data: submission, error: submissionError } = await supabase
    .from("project_task_submissions")
    .select("storage_path, file_name")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) {
    console.error("Unable to load project task submission:", submissionError.message);
    return NextResponse.json(
      { error: "Unable to load this task submission." },
      { status: 500 },
    );
  }
  if (!submission) {
    return NextResponse.json({ error: "Task submission not found." }, {
      status: 404,
    });
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(submission.storage_path, 60, {
      download: submission.file_name,
    });
  if (signedUrlError) {
    console.error(
      "Unable to create task submission download link:",
      signedUrlError.message,
    );
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

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the local environment.",
    );
  }

  return { url, key };
}

export function getSupabaseServiceRoleKey() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not configured. Add the Supabase server secret to the environment to send email invitations.",
    );
  }
  return key;
}

export function getSiteUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const isLocalSiteUrl =
    configuredSiteUrl &&
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
      configuredSiteUrl,
    );
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const vercelSiteUrl = vercelHost
    ? /^https?:\/\//i.test(vercelHost)
      ? vercelHost
      : `https://${vercelHost}`
    : undefined;
  const siteUrl =
    configuredSiteUrl && !isLocalSiteUrl
      ? configuredSiteUrl
      : vercelSiteUrl ?? configuredSiteUrl;

  if (!siteUrl) {
    throw new Error(
      "The application URL is not configured. Set NEXT_PUBLIC_SITE_URL or deploy to Vercel so authentication callbacks use the deployed URL.",
    );
  }

  return siteUrl.replace(/\/+$/, "");
}

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
  const siteUrl = "https://quant-dex-6280.vercel.app";
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (
    configuredSiteUrl &&
    new URL(configuredSiteUrl).origin !== siteUrl
  ) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL must be set to ${siteUrl}.`,
    );
  }

  return siteUrl;
}

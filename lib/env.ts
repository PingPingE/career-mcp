function stripSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export const APP_URL = stripSlash(
  process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

/** The MCP endpoint. Tokens are audience-bound to this exact URL. */
export const MCP_RESOURCE = `${APP_URL}/api/mcp`;

export const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim().toLowerCase() || null;

export type RegistrationMode = "dcr" | "cimd" | "both";
export const REGISTRATION_MODE: RegistrationMode = (() => {
  const v = (process.env.OAUTH_CLIENT_REGISTRATION || "dcr").toLowerCase();
  return v === "cimd" || v === "both" ? v : "dcr";
})();

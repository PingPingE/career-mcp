import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { dialect } from "./db";
import { APP_URL, MCP_RESOURCE, OWNER_EMAIL, REGISTRATION_MODE } from "./env";

const useDcr = REGISTRATION_MODE === "dcr" || REGISTRATION_MODE === "both";
const useCimd = REGISTRATION_MODE === "cimd" || REGISTRATION_MODE === "both";

export const auth = betterAuth({
  baseURL: APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: { dialect, type: "postgres" },
  emailAndPassword: { enabled: true },
  databaseHooks: {
    user: {
      create: {
        // One server, one owner. Only the first account may be created,
        // and only with OWNER_EMAIL when that is set.
        before: async (user, ctx) => {
          if (!ctx) throw new APIError("FORBIDDEN", { message: "No context" });
          const existing = await ctx.context.adapter.count({ model: "user" });
          if (existing > 0) {
            throw new APIError("FORBIDDEN", { message: "This server already has an owner." });
          }
          if (OWNER_EMAIL && user.email.toLowerCase() !== OWNER_EMAIL) {
            throw new APIError("FORBIDDEN", { message: "Only OWNER_EMAIL can register." });
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/login",
      consentPage: "/consent",
      resource: MCP_RESOURCE,
      // claude.ai registers itself without credentials, so open DCR is required for the DCR path.
      // Registering a client grants nothing by itself: tokens still need the owner's login + consent.
      allowDynamicClientRegistration: useDcr,
      allowUnauthenticatedClientRegistration: useDcr,
    }),
    ...(useCimd
      ? [cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" })]
      : []),
  ],
});

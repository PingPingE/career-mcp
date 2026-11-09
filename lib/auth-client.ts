"use client";
import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

// oauthProviderClient attaches the signed OAuth query from the current URL to
// sign-in / consent calls, so the authorization flow resumes after login.
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });

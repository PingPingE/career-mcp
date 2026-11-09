import { auth } from "@/lib/auth";

// MCP clients look for discovery documents at the origin root:
//   /.well-known/oauth-protected-resource/api/mcp   (RFC 9728)
//   /.well-known/oauth-authorization-server/api/auth (RFC 8414)
//   /.well-known/openid-configuration/api/auth
// Better Auth's onRequest hooks match these root paths, so forward the request as-is.
export async function GET(request: Request) {
  return auth.handler(request);
}
export async function HEAD(request: Request) {
  return auth.handler(request);
}

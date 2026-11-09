// Simulates what a remote MCP client (e.g. claude.ai) does: discovery -> DCR -> authorize (PKCE)
// -> owner login + consent -> token -> MCP calls. Also checks the single-owner policy.
// Usage: node scripts/e2e-oauth.mjs [baseUrl] [email] [password]
import crypto from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = process.argv[3] ?? "owner@example.com";
const PASSWORD = process.argv[4] ?? "correct-horse-battery";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) process.exitCode = 1; };
const b64url = (b) => b.toString("base64url");
let cookies = "";
const keepCookies = (res) => {
  const set = res.headers.getSetCookie?.() ?? [];
  const jar = Object.fromEntries(cookies.split("; ").filter(Boolean).map((c) => c.split(/=(.*)/s).slice(0, 2)));
  for (const s of set) { const [kv] = s.split(";"); const [k, v] = kv.split(/=(.*)/s); jar[k] = v; }
  cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
};

// 1. unauthenticated call -> 401 + resource_metadata
const r401 = await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" });
const prmUrl = /resource_metadata="([^"]+)"/.exec(r401.headers.get("www-authenticate") ?? "")?.[1];
ok(r401.status === 401 && prmUrl, `401 with resource_metadata (${prmUrl})`);
const prm = await (await fetch(prmUrl)).json();
const issuer = prm.authorization_servers[0];
const asMeta = await (await fetch(`${new URL(issuer).origin}/.well-known/oauth-authorization-server${new URL(issuer).pathname}`)).json();
ok(asMeta.registration_endpoint, `AS metadata, registration_endpoint present`);

// 2. DCR
const reg = await fetch(asMeta.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "e2e-claude-sim", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
const client = await reg.json();
ok(reg.ok && client.client_id, `DCR registered client ${client.client_id ?? JSON.stringify(client)}`);

// 3. authorize with PKCE
const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
const state = b64url(crypto.randomBytes(8));
const authUrl = new URL(asMeta.authorization_endpoint);
Object.entries({ response_type: "code", client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state, resource: prm.resource, ...(process.env.NO_SCOPE ? {} : { scope: "openid offline_access" }) }).forEach(([k, v]) => authUrl.searchParams.set(k, v));
const browser = { accept: "text/html", "sec-fetch-mode": "navigate" };
const a1 = await fetch(authUrl, { redirect: "manual", headers: browser });
// Node's fetch always sends sec-fetch-mode: cors, so the server answers JSON {url} instead of 302.
const nextOf = async (r) => r.headers.get("location") ?? (await r.json().catch(() => ({}))).url ?? "";
const loginLoc = await nextOf(a1);
ok(loginLoc.includes("/login"), `authorize -> login page`);
const oauthQuery = new URL(loginLoc, BASE).search.slice(1);

// 4. owner sign-up (first run) or sign-in
const setup = await (await fetch(`${BASE}/api/setup-state`)).json();
const path = setup.hasOwner ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email";
const s1 = await fetch(`${BASE}${path}`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", accept: "application/json", origin: BASE }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "owner", oauth_query: oauthQuery }) });
keepCookies(s1);
const s1body = await s1.json();
ok(s1.ok && s1body.url, `${setup.hasOwner ? "sign-in" : "sign-up"} -> next url ${s1body.url}`);

// 5. consent (if asked)
let nextUrl = s1body.url;
if (nextUrl.includes("/consent")) {
  const cq = new URL(nextUrl, BASE).search.slice(1);
  const c = await fetch(`${BASE}/api/auth/oauth2/consent`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", cookie: cookies, origin: BASE }, body: JSON.stringify({ accept: true, oauth_query: cq }) });
  const cb = await c.json();
  ok(c.ok && cb.url, `consent accepted -> ${cb.url?.slice(0, 60)}…`);
  nextUrl = cb.url;
}
const cbUrl = new URL(nextUrl);
const code = cbUrl.searchParams.get("code");
ok(cbUrl.origin + cbUrl.pathname === REDIRECT && code && cbUrl.searchParams.get("state") === state, `redirected to client callback with code + state`);

// 6. token
const tok = await fetch(asMeta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: client.client_id, code_verifier: verifier, resource: prm.resource }) });
const tokens = await tok.json();
ok(tok.ok && tokens.access_token, `token issued (refresh_token: ${tokens.refresh_token ? "yes" : "no"}, expires_in: ${tokens.expires_in})`);

// 7. MCP calls with the token
const rpc = async (token, method, params = {}, id = 1) => {
  const r = await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  const text = await r.text();
  const json = text.startsWith("{") ? JSON.parse(text) : JSON.parse(text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? "null");
  return { status: r.status, json };
};
const init = await rpc(tokens.access_token, "initialize", { protocolVersion: "2025-06-18", capabilities: { elicitation: {} }, clientInfo: { name: "e2e-claude-sim", version: "0" } });
ok(init.status === 200 && init.json?.result?.serverInfo, `initialize (legacy 2025-06-18) -> ${init.json?.result?.protocolVersion}`);
const list = await rpc(tokens.access_token, "tools/list");
ok(list.json?.result?.tools?.length >= 7, `tools/list -> ${list.json?.result?.tools?.map((t) => t.name).join(", ")}`);
const who = await rpc(tokens.access_token, "tools/call", { name: "list_experiences", arguments: {} });
const whoText = who.json?.result?.content?.[0]?.text ?? JSON.stringify(who.json);
ok(Array.isArray(JSON.parse(whoText)), `list_experiences -> ${JSON.parse(whoText).length} experiences`);
const prompts = await rpc(tokens.access_token, "prompts/list");
ok(prompts.json?.result?.prompts?.some((p) => p.name === "reframe"), `prompts/list includes reframe`);

// 8. token for a different resource / garbage token must fail
const bad = await rpc("not-a-token", "tools/list");
ok(bad.status === 401, `garbage token rejected (${bad.status})`);

// 9. refresh
if (tokens.refresh_token) {
  const rt = await fetch(asMeta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id, resource: prm.resource }) });
  const rtj = await rt.json();
  const again = rt.ok ? await rpc(rtj.access_token, "tools/call", { name: "list_experiences", arguments: {} }) : null;
  ok(rt.ok && again?.status === 200, `refresh_token -> new access token works`);
}

// 10. single-owner policy: a second account cannot be created, even mid-OAuth
const a2 = await fetch(authUrl, { redirect: "manual", headers: browser });
const q2 = new URL(await nextOf(a2), BASE).search.slice(1);
const s2 = await fetch(`${BASE}/api/auth/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", origin: BASE }, body: JSON.stringify({ email: "intruder@example.com", password: "intruder-password", name: "x", oauth_query: q2 }) });
ok(s2.status === 403 || s2.status === 400, `second account sign-up blocked (${s2.status} ${(await s2.text()).slice(0, 80)})`);

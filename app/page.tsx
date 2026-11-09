import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MCP_RESOURCE, REGISTRATION_MODE } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const ctx = await auth.$context;
  const hasOwner = (await ctx.adapter.count({ model: "user" })) > 0;

  if (!session) {
    return (
      <>
        <h1>Career MCP</h1>
        <p className="muted">
          {hasOwner ? "Sign in as the owner to see connection logs." : "No owner yet. Create the owner account first."}
        </p>
        <p><a href="/login">{hasOwner ? "Sign in" : "Create the owner account"}</a></p>
      </>
    );
  }

  const rows = await db
    .selectFrom("mcp_request_log")
    .selectAll()
    .orderBy("id", "desc")
    .limit(50)
    .execute();

  return (
    <>
      <h1>Career MCP</h1>
      <p className="muted">Owner: {session.user.email} | Client registration: {REGISTRATION_MODE}</p>
      <p>
        Connector URL<br />
        <code>{MCP_RESOURCE}</code>
      </p>
      <h2 style={{ fontSize: 17, marginTop: 32 }}>Recent MCP requests</h2>
      <p className="muted">Which clients connected, and with which protocol version.</p>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Time (UTC)</th><th>Method</th><th>Protocol</th><th>Client</th><th>capabilities</th><th>user-agent</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.at ? new Date(r.at).toISOString().slice(5, 19).replace("T", " ") : ""}</td>
                <td>{r.rpc_method}</td>
                <td>{r.protocol_version}</td>
                <td>{[r.client_name, r.client_version].filter(Boolean).join(" ")}</td>
                <td><code>{r.capabilities ?? ""}</code></td>
                <td className="muted">{r.user_agent}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

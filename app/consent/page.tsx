"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type PublicClient = { client_name?: string; client_uri?: string };

export default function ConsentPage() {
  const [client, setClient] = useState<PublicClient | null>(null);
  const [scope, setScope] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setScope(q.get("scope") ?? "");
    const clientId = q.get("client_id");
    if (clientId)
      fetch(`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setClient)
        .catch(() => {});
  }, []);

  async function decide(accept: boolean) {
    setBusy(true);
    setError(null);
    // The client plugin attaches the signed OAuth query from this page's URL.
    const res = await authClient.oauth2.consent({ accept });
    setBusy(false);
    const data = res.data as { url?: string } | null;
    if (res.error || !data?.url) return setError(res.error?.message ?? "The request failed.");
    window.location.href = data.url;
  }

  return (
    <>
      <h1>Allow access</h1>
      <p>
        <b>{client?.client_name ?? "An MCP client"}</b> wants to access your career record.
      </p>
      {scope && (
        <p className="muted">
          Requested scope: <code>{scope}</code>
        </p>
      )}
      <form onSubmit={(e) => e.preventDefault()}>
        <button disabled={busy} onClick={() => decide(true)}>Allow</button>
        <button disabled={busy} className="secondary" onClick={() => decide(false)}>Deny</button>
        {error && <p className="err">{error}</p>}
      </form>
    </>
  );
}

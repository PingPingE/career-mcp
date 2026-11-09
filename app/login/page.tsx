"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/setup-state")
      .then((r) => r.json())
      .then((s: { hasOwner: boolean }) => setMode(s.hasOwner ? "signin" : "signup"))
      .catch(() => setMode("signin"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Sign-in failed.");
    const data = res.data as { url?: string; redirect?: boolean } | null;
    // During an OAuth flow the server answers with where to go next (consent or the client).
    window.location.href = data?.url ?? "/";
  }

  if (!mode) return <p className="muted">Loading...</p>;
  return (
    <>
      <h1>{mode === "signup" ? "Create the owner account" : "Sign in"}</h1>
      <p className="muted">
        {mode === "signup"
          ? "The first account on this server becomes the owner. No other accounts can be created after that."
          : "Only the owner of this server can sign in."}
      </p>
      <form onSubmit={submit}>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input type="password" required minLength={8} placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        <button disabled={busy}>{busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}</button>
        {error && <p className="err">{error}</p>}
      </form>
    </>
  );
}

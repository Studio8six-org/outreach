"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../../lib/api";
import { Mark } from "../components/Icons";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(true);

  // Already signed in? Go straight to the app
  useEffect(() => {
    api("/api/me")
      .then((d) => d.email && router.replace("/"))
      .catch((err) => setConfigured(err.data?.configured !== false));
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/login", { email: email.trim(), password });
      router.replace("/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="center-page">
        <div className="card">
          <h1>Almost ready</h1>
          <p>The server is missing its settings. Copy <code>.env.example</code> to <code>.env.local</code> and fill in the values.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login">
      <section className="login-art">
        <div className="brand"><Mark size={30} /><span>Outreach</span></div>
        <div>
          <h1>Pick. Follow up. Win the reply.</h1>
          <p>One shared list for the whole team, so nobody contacts the same business twice.</p>
        </div>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="muted">Use the login your team lead gave you.</p>
          <label>
            Email
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn primary wide" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

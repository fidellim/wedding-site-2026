import { useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

interface AuthGateProps {
  client: SupabaseClient;
  children: (session: Session, signOut: () => Promise<void>) => ReactNode;
}

export function AuthGate({ client, children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [enteringExistingCode, setEnteringExistingCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const sendCode = async () => {
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCodeSent(true);
    setEnteringExistingCode(false);
    setMessage("A sign-in code has been sent to your email.");
  };

  const verifyCode = async () => {
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setMessage(error.message);
  };

  if (checking) {
    return <div className="auth-screen"><div className="auth-card">Checking your session…</div></div>;
  }

  if (session) {
    return children(session, async () => {
      await client.auth.signOut();
    });
  }

  const codeEntryVisible = codeSent || enteringExistingCode;

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark">H <span>&amp;</span> F</div>
        <p className="eyebrow">Private planning studio</p>
        <h1 id="auth-title">Seating, thoughtfully arranged.</h1>
        <p className="auth-copy">
          Access is restricted to Hannah and Fidel. Enter an approved email address to continue.
        </p>
        <label>
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy || codeSent}
          />
        </label>
        {codeEntryVisible && (
          <label>
            <span>Email sign-in code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              maxLength={10}
              value={token}
              onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}
        {message && <p className="form-message" role="status">{message}</p>}
        <button
          className="primary-button"
          type="button"
          disabled={busy || !email.trim() || (codeEntryVisible && token.length < 6)}
          onClick={() => void (codeEntryVisible ? verifyCode() : sendCode())}
        >
          {busy ? "Please wait…" : codeEntryVisible ? "Verify and enter" : "Email me a code"}
        </button>
        {!codeEntryVisible && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setEnteringExistingCode(true);
              setMessage("Enter the code from the email you already received.");
            }}
          >
            I already have a code
          </button>
        )}
        {codeEntryVisible && (
          <button className="text-button" type="button" onClick={() => {
            setCodeSent(false);
            setEnteringExistingCode(false);
            setToken("");
            setMessage("");
          }}>
            Use another email
          </button>
        )}
      </section>
    </main>
  );
}

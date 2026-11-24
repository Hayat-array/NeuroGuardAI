import { useState } from "react";
import { supabaseClient } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

function readableAuthError(error, creatingAccount) {
  const message = error?.message || "";
  if (/email not confirmed|email_not_confirmed/i.test(message)) {
    return "Confirm your email using the link we sent, then sign in.";
  }
  if (/invalid login credentials|user not found/i.test(message)) {
    return "Invalid email or password. Check your details and try again.";
  }
  if (creatingAccount && /already registered|already exists/i.test(message)) {
    return "Unable to create this account with those details. Try signing in instead.";
  }
  if (/password.*(weak|short)|at least \d+ characters/i.test(message)) return message;
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please wait before trying again.";
  return "Sign-in is temporarily unavailable. Please try again.";
}

export default function AuthPanel() {
  const { session, loading, configurationError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event) => {
    event.preventDefault();
    if (!supabaseClient || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabaseClient.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(readableAuthError(error, false));
    setBusy(false);
  };

  const signUp = async () => {
    if (!supabaseClient || busy) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: import.meta.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
          || `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setMessage(readableAuthError(error, true));
    else if (!data.session) setMessage("Check your email to confirm your account, then sign in.");
    else setMessage("Account created and signed in.");
    setBusy(false);
  };

  const signOut = async () => {
    if (!supabaseClient || busy) return;
    setBusy(true);
    const { error } = await supabaseClient.auth.signOut();
    setMessage(error ? "Unable to sign out. Please try again." : "You have signed out.");
    setBusy(false);
  };

  return (
    <section className="panel glass auth-panel" aria-labelledby="auth-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="auth-title">Secure patient access</h2>
          <p className="panel-sub" role="status" aria-live="polite">
            {loading ? "Checking your sign-in…" : session ? `Signed in as ${session.user.email}` : configurationError || message || "Sign in to access your private patient profile."}
          </p>
        </div>
        {session && <button type="button" className="btn btn-ghost" onClick={signOut} disabled={busy}>Sign out</button>}
      </div>
      {!session && !loading && (
        <form className="auth-form" onSubmit={signIn}>
          <label className="field" htmlFor="auth-email">
            <span>Email</span>
            <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field" htmlFor="auth-password">
            <span>Password</span>
            <input id="auth-password" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <div className="auth-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || Boolean(configurationError)}>{busy ? "Please wait…" : "Sign in"}</button>
            <button className="btn btn-ghost" type="button" onClick={signUp} disabled={busy || Boolean(configurationError)}>{busy ? "Please wait…" : "Create account"}</button>
          </div>
        </form>
      )}
      {message && !session && <p className="auth-message" role="status">{message}</p>}
    </section>
  );
}

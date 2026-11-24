import { useEffect, useState } from "react";
import { AuthContext } from "./auth-context";
import { supabaseClient } from "../lib/supabase";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState("");

  useEffect(() => {
    if (!supabaseClient) {
      setConfigurationError("Supabase Auth is not configured for this frontend.");
      setLoading(false);
      return undefined;
    }

    let active = true;
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setConfigurationError("Unable to initialize secure sign-in.");
      setSession(data?.session ?? null);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setConfigurationError("Unable to initialize secure sign-in.");
        setLoading(false);
      }
    });

    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, configurationError }}>
      {children}
    </AuthContext.Provider>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getClientId, readJSON, writeJSON } from "../lib/storage";

// Optional login: needed only for Pro (so it works on every device). Token is kept in localStorage.
export default function useAccount() {
  const [clientId] = useState(getClientId);
  const [token, setToken] = useState(() => readJSON("fs:auth", null));
  const [account, setAccount] = useState(null);
  const [billing, setBilling] = useState(null);

  const saveToken = useCallback((next) => {
    writeJSON("fs:auth", next);
    setToken(next);
    if (!next) setAccount(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return null;
    const res = await api(`/me?clientId=${encodeURIComponent(clientId)}`, { token });
    if (res.status === 401) saveToken(null);
    else if (res.ok) setAccount(res.data.account);
    return res.ok ? res.data.account : null;
  }, [token, clientId, saveToken]);

  // Load the account on start, and again when the user comes back to the tab (e.g. after paying on the website)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api(`/me?clientId=${encodeURIComponent(clientId)}`, { token }).then((res) => {
      if (cancelled) return;
      if (res.status === 401) saveToken(null);
      else if (res.ok) setAccount(res.data.account);
    });
    const onFocus = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [token, clientId, refresh, saveToken]);

  useEffect(() => {
    api("/billing/config").then((res) => res.ok && setBilling(res.data));
  }, []);

  const authenticate = async (mode, { email, password, name }) => {
    const res = await api(`/auth/${mode}`, { method: "POST", body: { email, password, name, clientId } });
    if (!res.ok) return res;
    saveToken(res.data.token);
    setAccount(res.data.account);
    return res;
  };

  const logout = async () => {
    if (token) await api("/auth/logout", { method: "POST", token });
    saveToken(null);
  };

  return {
    token,
    account,
    pro: !!account?.pro,
    billing,
    refresh,
    setAccount,
    signup: (form) => authenticate("signup", form),
    login: (form) => authenticate("login", form),
    logout,
  };
}

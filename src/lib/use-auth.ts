/** React bindings for the session store in lib/api.ts. */
import * as React from "react";
import { getAuth, refreshAuth, subscribeAuth, authApi, type SessionUser } from "./api";

export function useAuth() {
  const snapshot = React.useSyncExternalStore(subscribeAuth, getAuth, getAuth);

  React.useEffect(() => {
    if (snapshot.loading) void refreshAuth();
  }, [snapshot.loading]);

  return snapshot;
}

export function useCustomer(): SessionUser | null {
  return useAuth().user;
}

export function useAdmin(): SessionUser | null {
  return useAuth().admin;
}

export { authApi };

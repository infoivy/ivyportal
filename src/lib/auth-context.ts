import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  roles: string[];
  displayName: string | null;
  loading: boolean;
};

export const AuthContext = createContext<AuthState>({ user: null, roles: [], displayName: null, loading: true });

export const useAuth = () => useContext(AuthContext);
export const useHasRole = (role: string) => useAuth().roles.includes(role);
export const useIsAdmin = () => useHasRole("admin");

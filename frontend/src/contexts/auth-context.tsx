"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Tenant } from "@/lib/api/schemas";
import { useAuthQuery, useSignIn, useSignOut } from "@/hooks/use-auth";

interface AuthContextValue {
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
  isSigningIn: boolean;
  signInError: Error | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const meQuery = useAuthQuery();
  const signInMutation = useSignIn();
  const signOutMutation = useSignOut();

  const tenant = meQuery.data ?? null;

  const value: AuthContextValue = {
    tenant,
    isAuthenticated: !!tenant,
    isLoading: meQuery.isLoading,
    signIn: () => signInMutation.mutate(),
    signOut: () => signOutMutation.mutate(),
    isSigningIn: signInMutation.isPending,
    signInError: signInMutation.error instanceof Error ? signInMutation.error : null,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

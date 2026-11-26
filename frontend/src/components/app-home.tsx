"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/button";
import { FormAlert } from "@/components/field";
import { getMe, logout, type User } from "@/lib/api";
import { FormMessage } from "@/lib/messages";
import { Route } from "@/lib/routes";

export function AppHome() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMe()
      .then((me) => active && setUser(me))
      .catch(() => active && router.replace(Route.SignIn));
    return () => {
      active = false;
    };
  }, [router]);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace(Route.SignIn);
    } catch {
      setLogoutError(FormMessage.LogoutFailed);
      setLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <p role="status" className="w-full text-center text-muted">
        Loading...
      </p>
    );
  }

  return (
    <AuthCard
      title="Welcome to the application."
      description={`${user.name} (${user.email})`}
    >
      <div className="space-y-4">
        <FormAlert message={logoutError} />
        <Button type="button" onClick={onLogout} pending={loggingOut} pendingLabel="Logging out...">
          Log out
        </Button>
      </div>
    </AuthCard>
  );
}

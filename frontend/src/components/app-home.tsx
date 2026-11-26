"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/button";
import { FormAlert } from "@/components/field";
import { ApiError, HttpStatus, getMe, logout, type User } from "@/lib/api";
import { FormMessage } from "@/lib/messages";
import { Route } from "@/lib/routes";

enum LoadState {
  Loading,
  Failed,
  Retrying,
}

export function AppHome() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadState, setLoadState] = useState(LoadState.Loading);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMe()
      .then((me) => active && setUser(me))
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.statusCode === HttpStatus.Unauthorized) {
          router.replace(Route.SignIn);
          return;
        }
        setLoadState(LoadState.Failed);
      });
    return () => {
      active = false;
    };
  }, [router, attempt]);

  useEffect(() => {
    if (user) headingRef.current?.focus();
  }, [user]);

  const retry = () => {
    if (loadState === LoadState.Retrying) return;
    setLoadState(LoadState.Retrying);
    setAttempt((current) => current + 1);
  };

  const loggingOutPending = loggingOut || isNavigating;

  const onLogout = async () => {
    if (loggingOutPending) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      startNavigation(() => router.replace(Route.SignIn));
    } catch {
      setLogoutError(FormMessage.LogoutFailed);
    } finally {
      setLoggingOut(false);
    }
  };

  if (!user && loadState === LoadState.Loading) {
    return (
      <p role="status" className="w-full text-center text-muted">
        Loading...
      </p>
    );
  }

  if (!user) {
    return (
      <div className="w-full space-y-4">
        <FormAlert message={FormMessage.LoadFailed} />
        <Button
          type="button"
          onClick={retry}
          pending={loadState === LoadState.Retrying}
          pendingLabel="Retrying..."
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <AuthCard
      headingRef={headingRef}
      title="Welcome to the application."
      description={`${user.name} (${user.email})`}
    >
      <div className="space-y-4">
        <FormAlert message={logoutError} />
        <Button type="button" onClick={onLogout} pending={loggingOutPending} pendingLabel="Logging out...">
          Log out
        </Button>
      </div>
    </AuthCard>
  );
}

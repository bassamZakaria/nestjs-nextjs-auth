"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/button";
import { Field, FormAlert, PasswordField } from "@/components/field";
import { signIn } from "@/lib/api";
import { toFormMessage } from "@/lib/form-error";
import { Route } from "@/lib/routes";
import { FieldName, signInSchema, type SignInValues } from "@/lib/schemas";

export function SignInForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: "onBlur",
  });

  const pending = isSubmitting || isNavigating;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values);
      startNavigation(() => router.replace(Route.Home));
    } catch (error) {
      setFormError(toFormMessage(error));
    }
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) =>
    pending ? event.preventDefault() : submit(event);

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Enter your details to continue."
      footer={
        <>
          New here?{" "}
          <Link href={Route.SignUp} className="font-semibold text-accent-strong underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={errors[FieldName.Email]?.message}
          {...register(FieldName.Email)}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors[FieldName.Password]?.message}
          {...register(FieldName.Password)}
        />
        <Button type="submit" pending={pending} pendingLabel="Signing in…">
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

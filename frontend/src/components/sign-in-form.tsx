"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/button";
import { Field, FormAlert, PasswordField } from "@/components/field";
import { ApiError, HttpStatus, signIn } from "@/lib/api";
import { FormMessage } from "@/lib/messages";
import { Route } from "@/lib/routes";
import { FieldName, signInSchema, type SignInValues } from "@/lib/schemas";

const toMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return FormMessage.Generic;
  if (error.statusCode === HttpStatus.Unauthorized) return FormMessage.InvalidCredentials;
  if (error.statusCode === HttpStatus.TooManyRequests) return FormMessage.TooManyAttempts;
  return FormMessage.Generic;
};

export function SignInForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: "onBlur",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values);
      router.replace(Route.Home);
    } catch (error) {
      setFormError(toMessage(error));
    }
  });

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
        <Button type="submit" pending={isSubmitting} pendingLabel="Signing in...">
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/button";
import { Field, FormAlert, PasswordField } from "@/components/field";
import { PasswordChecklist } from "@/components/password-checklist";
import { ApiError, HttpStatus, signUp } from "@/lib/api";
import { FormMessage } from "@/lib/messages";
import { Route } from "@/lib/routes";
import { FieldName, signUpSchema, type SignUpValues } from "@/lib/schemas";

export function SignUpForm() {
  const router = useRouter();
  const checklistId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
  });

  const password = useWatch({ control, name: FieldName.Password }) ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
      router.replace(Route.Home);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === HttpStatus.Conflict) {
        setError(FieldName.Email, { message: FormMessage.EmailTaken }, { shouldFocus: true });
        return;
      }
      const tooMany = error instanceof ApiError && error.statusCode === HttpStatus.TooManyRequests;
      setFormError(tooMany ? FormMessage.TooManyAttempts : FormMessage.Generic);
    }
  });

  return (
    <AuthCard
      title="Create account"
      description="It takes a minute. No spam."
      footer={
        <>
          Already registered?{" "}
          <Link href={Route.SignIn} className="font-semibold text-accent-strong underline underline-offset-4">
            Sign in
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
        <Field
          label="Name"
          type="text"
          autoComplete="name"
          error={errors[FieldName.Name]?.message}
          {...register(FieldName.Name)}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hintId={checklistId}
          error={errors[FieldName.Password]?.message}
          {...register(FieldName.Password)}
        />
        <PasswordChecklist id={checklistId} value={password} />
        <Button type="submit" pending={isSubmitting} pendingLabel="Creating account...">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

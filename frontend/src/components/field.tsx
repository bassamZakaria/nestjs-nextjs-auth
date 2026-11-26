"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hintId?: string;
  adornment?: ReactNode;
};

export function Field({ label, error, hintId, adornment, ...input }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hintId].filter(Boolean).join(" ");

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={`min-h-11 w-full rounded-md border-2 border-line bg-background px-3 text-base text-ink aria-invalid:border-danger ${adornment ? "pr-20" : ""}`}
        />
        {adornment}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type" | "adornment">) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      adornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-1 right-1 min-w-16 rounded px-2 text-sm font-semibold text-accent-strong"
        >
          {visible ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      }
    />
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border-2 border-danger px-3 py-2 text-sm font-medium text-danger"
    >
      {message}
    </p>
  );
}

import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  pending?: boolean;
  pendingLabel: string;
};

export function Button({ pending, pendingLabel, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      aria-disabled={pending || undefined}
      className="min-h-11 w-full rounded-md bg-accent px-4 font-semibold text-on-accent transition-colors hover:bg-accent-strong aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

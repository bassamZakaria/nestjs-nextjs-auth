import type { ReactNode, Ref } from "react";

type AuthCardProps = {
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthCard({ title, headingRef, description, footer, children }: AuthCardProps) {
  return (
    <section className="w-full rounded-lg border-2 border-ink bg-surface p-6 shadow-[6px_6px_0_var(--accent)] sm:p-8">
      <h1 ref={headingRef} tabIndex={-1} className="text-balance text-3xl font-bold tracking-tight">{title}</h1>
      {description ? <p className="mt-2 wrap-anywhere text-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? <p className="mt-6 text-sm text-muted">{footer}</p> : null}
    </section>
  );
}

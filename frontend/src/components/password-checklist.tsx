import { PASSWORD_CHECKS } from "@/lib/schemas";

export function PasswordChecklist({ id, value }: { id: string; value: string }) {
  return (
    <ul id={id} className="space-y-1 text-sm">
      {PASSWORD_CHECKS.map(({ rule, test }) => {
        const met = test(value);
        return (
          <li key={rule} className={met ? "text-success" : "text-muted"}>
            <span aria-hidden="true" className="inline-block w-5 font-bold">
              {met ? "✓" : "○"}
            </span>
            {rule}
            <span className="sr-only">{met ? ": met" : ": not met"}</span>
          </li>
        );
      })}
    </ul>
  );
}

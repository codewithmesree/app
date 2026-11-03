import { useId, type ComponentProps } from "react";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  /** Plain-language validation message, tied to the input for assistive tech. */
  error?: string;
};

export function Field({ label, hint, error, className = "", ...props }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className="min-h-11 rounded-control border border-line bg-surface-muted px-3 text-ink transition-colors duration-150 placeholder:text-ink-subtle hover:border-ink-subtle focus:border-primary-hover disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger"
        {...props}
      />
      {message ? (
        <p id={messageId} className={`text-[13px] ${error ? "text-danger" : "text-ink-muted"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

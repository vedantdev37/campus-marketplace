type AlertProps = {
  tone: "error" | "success";
  children: React.ReactNode;
};

/**
 * A form-level message banner.
 *
 * `role="alert"` on the error tone makes assistive technology announce it the
 * moment it appears, which matters because a form-level error is usually the
 * only feedback after a submit that looked like it worked.
 */
export function Alert({ tone, children }: AlertProps) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={[
        "rounded-lg border px-3 py-2.5 text-sm",
        isError
          ? "border-error/40 bg-error-surface text-error"
          : "border-success/40 bg-success-surface text-success",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

import { Check, Sparkles } from "lucide-react";
import { STEP_LABELS, type Step } from "@/lib/flow-types";

export function Header({
  signedIn = false,
  onOpenWork,
  onSignIn,
}: {
  signedIn?: boolean;
  onOpenWork?: () => void;
  onSignIn?: () => void;
} = {}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">Social Media Machine</p>
          <p className="text-[11px] text-muted-foreground">by ZedBiz</p>
        </div>
        <div className="ml-auto">
          {signedIn ? (
            <button
              type="button"
              onClick={onOpenWork}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/30 sm:text-sm"
            >
              My saved work
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:text-sm"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function ProgressBar({ step }: { step: Step }) {
  const idx = STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <ol className="mb-6 flex items-center gap-1 sm:gap-2">
      {STEP_LABELS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-1 sm:gap-2">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={[
                "hidden truncate text-xs sm:inline",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <span className={["h-px flex-1", done ? "bg-accent" : "bg-border"].join(" ")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function BackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/30",
        className ?? "",
      ].join(" ")}
    >
      Back
    </button>
  );
}

export function SampleBanner() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-4 py-2 text-center backdrop-blur">
      <p className="text-[11px] text-muted-foreground">
        Sample preview — not live research. No real email is collected.
      </p>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

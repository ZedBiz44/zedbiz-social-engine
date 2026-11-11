import { Globe, Sparkles } from "lucide-react";
import { Field } from "@/components/flow-shared";
import { SAMPLE_PREVIEW, type FlowState } from "@/lib/flow-types";

export function BusinessStep({
  state,
  onPatch,
  onSubmit,
}: {
  state: FlowState;
  onPatch: (p: Partial<FlowState>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">
        Turn what you do into posts people actually read.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tell us about your business and we'll suggest topics, then draft three post ideas you can
        use right away.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Business name" htmlFor="businessName">
          <input
            id="businessName"
            type="text"
            required
            value={state.businessName}
            onChange={(e) => onPatch({ businessName: e.target.value })}
            placeholder="e.g. Maple Crust Bakery"
            className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="Website" htmlFor="website">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              id="website"
              type="text"
              required
              inputMode="url"
              value={state.website}
              onChange={(e) => onPatch({ website: e.target.value })}
              placeholder="yourbusiness.com"
              className="w-full bg-transparent py-3 text-base text-foreground outline-none"
            />
          </div>
        </Field>

        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.99]"
        >
          Suggest topics
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-dashed border-border bg-secondary/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Try a sample business
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_PREVIEW.map((s) => (
            <button
              key={s.website}
              type="button"
              onClick={() => onPatch({ businessName: s.businessName, website: s.website })}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Sample data only — not live research.
        </p>
      </div>
    </section>
  );
}

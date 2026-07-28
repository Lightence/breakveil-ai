import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react"

export default function ApplicationReviewChecklist({
  readiness,
  onToggle,
  readOnly = false,
  compact = false,
}) {
  return (
    <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-violet-300" />

        <div>
          <p className="font-medium text-zinc-100">Human review</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Tick these yourself after checking the real application. BreakVeil
            prepares it, but never submits it for you.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {readiness.reviewChecks.map((check) => (
          <label
            key={check.id}
            className={[
              "flex gap-3 rounded-lg border px-3 py-3",
              readOnly ? "cursor-default" : "cursor-pointer",
              check.passed
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-zinc-800 bg-zinc-900/50",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={check.passed}
              disabled={readOnly}
              onChange={(event) => onToggle?.(check.id, event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-500"
            />

            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm text-zinc-200">
                {check.passed ? (
                  <CheckCircle2 size={14} className="text-emerald-300" />
                ) : (
                  <CircleAlert size={14} className="text-amber-300" />
                )}
                {check.label}
              </span>

              {!compact && (
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  {check.help}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {readiness.reviewComplete
          ? "Human review complete. This package can be approved."
          : `${readiness.reviewTotalCount - readiness.reviewPassedCount} review check${readiness.reviewTotalCount - readiness.reviewPassedCount === 1 ? "" : "s"} left.`}
      </p>
    </section>
  )
}

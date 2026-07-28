import { AlertTriangle, X } from "lucide-react"

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-[#151515] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div className="flex items-start gap-4">
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                danger
                  ? "jp-tone-danger"
                  : "jp-tone-warning",
              ].join(" ")}
            >
              <AlertTriangle size={20} />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                {title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-end gap-3 px-6 py-5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              danger
                ? "jp-button-danger"
                : "jp-button-primary",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
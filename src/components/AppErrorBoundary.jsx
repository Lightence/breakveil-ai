import {
  Component,
} from "react"

import {
  AlertOctagon,
  FolderOpen,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"

import {
  openRecoveryFolder,
  requestSafeModeStartup,
} from "../lib/dataRecovery"

export default class AppErrorBoundary extends Component {
  constructor(
    props,
  ) {
    super(
      props,
    )

    this.state = {
      error:
        null,

      detailsOpen:
        false,
    }
  }

  static getDerivedStateFromError(
    error,
  ) {
    return {
      error,
    }
  }

  componentDidCatch(
    error,
    information,
  ) {
    console.error(
      "BreakVeil renderer error:",
      error,
      information,
    )
  }

  reloadApplication =
    () => {
      window.location.reload()
    }

  restartSafeMode =
    () => {
      requestSafeModeStartup(
        this.state.error
          ?.message ||
        "BreakVeil recovered from a renderer error.",
      )

      window.location.reload()
    }

  openRecovery =
    async () => {
      try {
        await openRecoveryFolder()
      } catch {
        // The visible recovery screen remains available.
      }
    }

  render() {
    if (
      !this.state.error
    ) {
      return this.props
        .children
    }

    const message =
      this.state.error
        ?.message ||
      "An unexpected renderer error occurred."

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101010] p-5 text-white">
        <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-red-500/20 bg-[#151515] shadow-2xl">
          <header className="border-b border-zinc-800 p-6">
            <div className="jp-tone-danger flex h-12 w-12 items-center justify-center rounded-2xl border">
              <AlertOctagon
                size={20}
              />
            </div>

            <h1 className="mt-4 text-xl font-semibold">
              BreakVeil Encountered a Display Error
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              The application stopped this screen from becoming a blank window. Reload normally, or restart in safe mode so local data can be checked and quarantined first.
            </p>
          </header>

          <div className="p-6">
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
              <p className="text-sm font-medium text-red-200">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                this.setState(
                  (current) => ({
                    detailsOpen:
                      !current
                        .detailsOpen,
                  }),
                )
              }
              className="mt-4 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              {this.state
                .detailsOpen
                ? "Hide Technical Details"
                : "Show Technical Details"}
            </button>

            {this.state
              .detailsOpen && (
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-xs leading-5 text-zinc-600">
                {String(
                  this.state
                    .error
                    ?.stack ||
                  message,
                )}
              </pre>
            )}
          </div>

          <footer className="grid gap-2 border-t border-zinc-800 px-6 py-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={
                this.openRecovery
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              <FolderOpen
                size={16}
              />
              Recovery Folder
            </button>

            <button
              type="button"
              onClick={
                this.reloadApplication
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              <RefreshCw
                size={16}
              />
              Reload
            </button>

            <button
              type="button"
              onClick={
                this.restartSafeMode
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/15"
            >
              <ShieldAlert
                size={16}
              />
              Restart Safe Mode
            </button>
          </footer>
        </section>
      </div>
    )
  }
}

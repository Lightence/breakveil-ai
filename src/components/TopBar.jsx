import { Search } from "lucide-react"
import { useLocation } from "react-router-dom"

export default function TopBar({
  onOpenCommand,
}) {
  const location = useLocation()

  const pageNames = {
    "/dashboard": "Dashboard",
    "/jobs": "Jobs",
    "/resume-library": "Resume Library",
    "/profile": "Candidate Profile",
    "/assistant": "AI Assistant",
    "/review-queue": "Application Review Queue",
    "/automation": "Automation",
    "/analytics": "Analytics",
    "/settings": "Settings",
  }

  const currentPage =
    pageNames[location.pathname] ||
    "BreakVeil AI"

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-8">
      <div>
        <p className="text-sm font-medium text-zinc-200">
          {currentPage}
        </p>

        <p className="text-xs text-zinc-500">
          BreakVeil AI Workspace
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        className="jp-search-trigger flex w-72 items-center justify-between rounded-xl border px-3 py-2 text-sm transition"
      >
        <span className="flex items-center gap-2">
          <Search size={16} />
          Search BreakVeil
        </span>

        <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs">
          Ctrl K
        </span>
      </button>
    </header>
  )
}
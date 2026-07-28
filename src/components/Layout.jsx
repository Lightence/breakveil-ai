import { useEffect, useState } from "react"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import CommandPalette from "./CommandPalette"
import ConnectivityBanner from "./ConnectivityBanner"

export default function Layout({ children }) {
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    function handleCommandShortcut(event) {
      const pressedK = event.key.toLowerCase() === "k"
      const pressedShortcut = event.ctrlKey || event.metaKey

      if (pressedShortcut && pressedK) {
        event.preventDefault()
        setCommandOpen((currentValue) => !currentValue)
      }
    }

    window.addEventListener("keydown", handleCommandShortcut)

    return () => {
      window.removeEventListener("keydown", handleCommandShortcut)
    }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[#090909]">
      <button
        type="button"
        onClick={() =>
          document
            .getElementById(
              "jobpilot-main-content",
            )
            ?.focus()
        }
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-xl transition focus:translate-y-0"
      >
        Skip to main content
      </button>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenCommand={() => setCommandOpen(true)} />
        <ConnectivityBanner />

        <main
          id="jobpilot-main-content"
          tabIndex="-1"
          className="jp-main-scroll flex-1 overflow-y-auto p-4 sm:p-6 2xl:p-8"
        >
          <div className="jp-page-container">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  )
}

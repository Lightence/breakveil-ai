import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import Layout from "./components/Layout"
import BackgroundAutomationRunner from "./components/BackgroundAutomationRunner"
import UiPreferencesBoot from "./components/UiPreferencesBoot"
import FirstRunSetup from "./components/FirstRunSetup"
import NavigationPreferences, {
  LandingRedirect,
} from "./components/NavigationPreferences"
import DataProtectionRunner from "./components/DataProtectionRunner"
import DataMigrationGate from "./components/DataMigrationGate"
import AppErrorBoundary from "./components/AppErrorBoundary"

import Dashboard from "./pages/Dashboard"
import Jobs from "./pages/Jobs"
import JobWorkspace from "./pages/JobWorkspace"
import ResumeLibrary from "./pages/ResumeLibrary"
import Profile from "./pages/Profile"
import Assistant from "./pages/Assistant"
import ApplicationQueue from "./pages/ApplicationQueue"
import Automation from "./pages/Automation"
import Analytics from "./pages/Analytics"
import Settings from "./pages/Settings"

function App() {
  return (
    <HashRouter>
      <AppErrorBoundary>
        <DataMigrationGate>
        <UiPreferencesBoot />
        <FirstRunSetup />
        <NavigationPreferences />
        <DataProtectionRunner />
        <BackgroundAutomationRunner />

        <Layout>
          <Routes>
          <Route
            path="/"
            element={
              <LandingRedirect />
            }
          />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/jobs"
            element={<Jobs />}
          />

          <Route
            path="/jobs/:jobId"
            element={<JobWorkspace />}
          />


          <Route
            path="/resume-library"
            element={<ResumeLibrary />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/assistant"
            element={<Assistant />}
          />

          <Route
            path="/review-queue"
            element={<ApplicationQueue />}
          />

          <Route
            path="/automation"
            element={<Automation />}
          />

          <Route
            path="/analytics"
            element={<Analytics />}
          />

          <Route
            path="/settings"
            element={<Settings />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />
          </Routes>
        </Layout>
        </DataMigrationGate>
      </AppErrorBoundary>
    </HashRouter>
  )
}

export default App

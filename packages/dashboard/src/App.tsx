import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ErrorBoundary from './components/common/ErrorBoundary'
import ConnectionStatus from './components/common/ConnectionStatus'
import LoginPage from './components/auth/LoginPage'
import RepoList from './components/repos/RepoList'
import RepoConfig from './components/repos/RepoConfig'
import PluginList from './components/plugins/PluginList'
import PluginMarketplace from './components/plugins/PluginMarketplace'
import CommandList from './components/commands/CommandList'
import ActivityFeed from './components/activity/ActivityFeed'
import Stats from './components/activity/Stats'
import SettingsPage from './components/settings/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center px-2 py-2 text-gray-900 font-bold">
                gh-pilot
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link to="/repos" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Repos
                </Link>
                <Link to="/plugins" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Plugins
                </Link>
                <Link to="/commands" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Commands
                </Link>
                <Link to="/activity" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Activity
                </Link>
                <Link to="/settings" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ConnectionStatus />
              {user && (
                <>
                  <span className="text-sm text-gray-600">{user.login}</span>
                  <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
          <Route path="/repos" element={<ProtectedRoute><RepoList /></ProtectedRoute>} />
          <Route path="/repos/:owner/:repo" element={<ProtectedRoute><RepoConfig /></ProtectedRoute>} />
          <Route path="/plugins" element={<ProtectedRoute><PluginList /></ProtectedRoute>} />
          <Route path="/plugins/marketplace" element={<ProtectedRoute><PluginMarketplace /></ProtectedRoute>} />
          <Route path="/commands" element={<ProtectedRoute><CommandList /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><ActivityFeed /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </ErrorBoundary>
  )
}

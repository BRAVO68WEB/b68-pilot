import { Routes, Route, Link } from 'react-router-dom'
import RepoList from './components/repos/RepoList'
import RepoConfig from './components/repos/RepoConfig'
import PluginList from './components/plugins/PluginList'
import CommandList from './components/commands/CommandList'
import ActivityFeed from './components/activity/ActivityFeed'
import Stats from './components/activity/Stats'

export default function App() {
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
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Stats />} />
          <Route path="/repos" element={<RepoList />} />
          <Route path="/repos/:owner/:repo" element={<RepoConfig />} />
          <Route path="/plugins" element={<PluginList />} />
          <Route path="/commands" element={<CommandList />} />
          <Route path="/activity" element={<ActivityFeed />} />
        </Routes>
      </main>
    </div>
  )
}

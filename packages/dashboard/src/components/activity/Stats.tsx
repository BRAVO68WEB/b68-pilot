import { useAsync } from '../../hooks/useAsync'
import { getStats } from '../../lib/api'
import { Link } from 'react-router-dom'

export default function Stats() {
  const { data: stats, loading, error } = useAsync(() => getStats())

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Items</p>
          <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Last 7 Days</p>
          <p className="text-3xl font-bold">{stats?.last7Days ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Last 30 Days</p>
          <p className="text-3xl font-bold">{stats?.last30Days ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Check Failures</p>
          <p className="text-3xl font-bold text-red-600">{stats?.byType.checkFailures ?? 0}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/repos" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">Repositories</h3>
          <p className="text-sm text-gray-500">Manage repo configs and rules</p>
        </Link>
        <Link to="/plugins" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">Plugins</h3>
          <p className="text-sm text-gray-500">View and manage plugins</p>
        </Link>
        <Link to="/commands" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">Commands</h3>
          <p className="text-sm text-gray-500">View all bot commands</p>
        </Link>
      </div>
    </div>
  )
}

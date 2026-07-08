// packages/worker/routes/dashboard.ts
// Dashboard API routes

import { ConfigStore, PilotStore, PluginManager, CommandRegistry } from 'core'
import { getSession, type SessionData } from '../auth/github'
import { unauthorized } from '../auth/middleware'

export interface DashboardContext {
  store: PilotStore
  configStore: ConfigStore
  pluginManager?: PluginManager
  commandRegistry?: CommandRegistry
}

export function createDashboardRoutes(ctx: DashboardContext) {
  return {
    // GET /api/repos - List all configured repos
    '/api/repos': async (req: Request): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const repos = ctx.configStore.listRepos()
      return Response.json(repos)
    },

    // GET /api/repos/:owner/:repo - Get repo config
    '/api/repos/:owner/:repo': async (req: Request, params: { owner: string; repo: string }): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const fullName = `${params.owner}/${params.repo}`
      const config = ctx.configStore.getRepo(fullName)
      return Response.json(config)
    },

    // PUT /api/repos/:owner/:repo - Update repo config
    '/api/repos/:owner/:repo/update': async (req: Request, params: { owner: string; repo: string }): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      try {
        const body = await req.json() as Record<string, unknown>
        const fullName = `${params.owner}/${params.repo}`
        body.repo = fullName
        ctx.configStore.saveRepo(fullName, body as any)
        return Response.json({ ok: true })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 400 })
      }
    },

    // DELETE /api/repos/:owner/:repo - Delete repo config
    '/api/repos/:owner/:repo/delete': async (req: Request, params: { owner: string; repo: string }): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const fullName = `${params.owner}/${params.repo}`
      ctx.configStore.deleteRepo(fullName)
      return Response.json({ ok: true })
    },

    // GET /api/activity - Recent webhook events
    '/api/activity': async (req: Request): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const url = new URL(req.url)
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const items = ctx.store.listWorkItems()
      return Response.json(items.slice(0, limit))
    },

    // GET /api/stats - PR/issue metrics
    '/api/stats': async (req: Request): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const items = ctx.store.listWorkItems()
      const now = new Date()
      const dayMs = 24 * 60 * 60 * 1000

      const last7d = items.filter(i => new Date(i.updatedAt).getTime() > now.getTime() - 7 * dayMs)
      const last30d = items.filter(i => new Date(i.updatedAt).getTime() > now.getTime() - 30 * dayMs)

      return Response.json({
        total: items.length,
        last7Days: last7d.length,
        last30Days: last30d.length,
        byType: {
          issues: items.filter(i => i.type === 'issue').length,
          pullRequests: items.filter(i => i.type === 'pull_request').length,
          checkFailures: items.filter(i => i.type === 'check_failure').length,
        },
      })
    },

    // GET /api/plugins - List installed plugins
    '/api/plugins': async (req: Request): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const plugins = ctx.pluginManager?.list() || []
      return Response.json(plugins.map(p => ({
        name: p.manifest.name,
        version: p.manifest.version,
        description: p.manifest.description,
        enabled: p.enabled,
      })))
    },

    // GET /api/commands - List all commands
    '/api/commands': async (req: Request): Promise<Response> => {
      const session = await getSession(req)
      if (!session) return unauthorized()

      const commands = ctx.commandRegistry?.list() || []
      return Response.json(commands)
    },
  }
}

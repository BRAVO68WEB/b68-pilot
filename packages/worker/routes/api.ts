import type { PilotStore } from 'core'
import type { ConfigStore } from 'core'

/**
 * Dashboard API routes — REST endpoints for the React dashboard.
 * All routes are prefixed with /api.
 */

export interface ApiContext {
  store: PilotStore
  configStore: ConfigStore
}

export function createApiRoutes(ctx: ApiContext) {
  return {
    /** GET /api/repos — List all configured repos */
    listRepos: (): Response => {
      const repos = ctx.configStore.listRepos()
      return json(repos)
    },

    /** GET /api/repos/:owner/:repo — Get repo config */
    getRepoConfig: (owner: string, repo: string): Response => {
      const fullName = `${owner}/${repo}`
      const config = ctx.configStore.getRepo(fullName)
      return json(config)
    },

    /** PUT /api/repos/:owner/:repo — Update repo config */
    updateRepoConfig: async (owner: string, repo: string, body: unknown): Promise<Response> => {
      const fullName = `${owner}/${repo}`
      try {
        const config = body as any
        config.repo = fullName
        ctx.configStore.saveRepo(fullName, config)
        return json({ ok: true })
      } catch (error) {
        return json({ ok: false, error: String(error) }, 400)
      }
    },

    /** DELETE /api/repos/:owner/:repo — Delete repo config */
    deleteRepoConfig: (owner: string, repo: string): Response => {
      const fullName = `${owner}/${repo}`
      ctx.configStore.deleteRepo(fullName)
      return json({ ok: true })
    },

    /** GET /api/repos/:owner/:repo/rules — List rules for a repo */
    listRules: (owner: string, repo: string): Response => {
      const fullName = `${owner}/${repo}`
      const config = ctx.configStore.getRepo(fullName)
      return json(config.rules)
    },

    /** POST /api/repos/:owner/:repo/rules — Create a rule */
    createRule: async (owner: string, repo: string, body: unknown): Promise<Response> => {
      const fullName = `${owner}/${repo}`
      try {
        const rule = body as any
        if (!rule.id) rule.id = crypto.randomUUID()
        ctx.configStore.addRule(fullName, rule)
        return json({ ok: true, id: rule.id })
      } catch (error) {
        return json({ ok: false, error: String(error) }, 400)
      }
    },

    /** PUT /api/repos/:owner/:repo/rules/:id — Update a rule */
    updateRule: async (owner: string, repo: string, ruleId: string, body: unknown): Promise<Response> => {
      const fullName = `${owner}/${repo}`
      try {
        ctx.configStore.updateRule(fullName, ruleId, body as any)
        return json({ ok: true })
      } catch (error) {
        return json({ ok: false, error: String(error) }, 400)
      }
    },

    /** DELETE /api/repos/:owner/:repo/rules/:id — Delete a rule */
    deleteRule: (owner: string, repo: string, ruleId: string): Response => {
      const fullName = `${owner}/${repo}`
      try {
        ctx.configStore.deleteRule(fullName, ruleId)
        return json({ ok: true })
      } catch (error) {
        return json({ ok: false, error: String(error) }, 400)
      }
    },

    /** GET /api/plugins — List installed plugins */
    listPlugins: (): Response => {
      // This will be populated by PluginManager
      return json([])
    },

    /** POST /api/plugins/:name/enable — Enable plugin for repo */
    enablePlugin: (pluginName: string, owner: string, repo: string): Response => {
      const fullName = `${owner}/${repo}`
      ctx.configStore.setPluginEnabled(fullName, pluginName, true)
      return json({ ok: true })
    },

    /** POST /api/plugins/:name/disable — Disable plugin for repo */
    disablePlugin: (pluginName: string, owner: string, repo: string): Response => {
      const fullName = `${owner}/${repo}`
      ctx.configStore.setPluginEnabled(fullName, pluginName, false)
      return json({ ok: true })
    },

    /** GET /api/plugins/:name/config — Get plugin config for repo */
    getPluginConfig: (pluginName: string, owner: string, repo: string): Response => {
      const fullName = `${owner}/${repo}`
      const config = ctx.configStore.getRepo(fullName)
      const plugin = config.plugins.find((p) => p.name === pluginName)
      return json(plugin ?? { name: pluginName, enabled: false, settings: {} })
    },

    /** PUT /api/plugins/:name/config — Update plugin config for repo */
    updatePluginConfig: async (pluginName: string, owner: string, repo: string, body: unknown): Promise<Response> => {
      const fullName = `${owner}/${repo}`
      try {
        const settings = (body as any).settings ?? body
        ctx.configStore.updatePluginConfig(fullName, pluginName, settings)
        return json({ ok: true })
      } catch (error) {
        return json({ ok: false, error: String(error) }, 400)
      }
    },

    /** GET /api/commands — List all registered commands */
    listCommands: (): Response => {
      // This will be populated by CommandRegistry
      return json([])
    },

    /** GET /api/activity — Get activity feed */
    getActivity: (limit = 50): Response => {
      // Get recent webhook events
      const items = ctx.store.listWorkItems()
      return json(items.slice(0, limit))
    },

    /** GET /api/stats — Get stats */
    getStats: (): Response => {
      const items = ctx.store.listWorkItems()
      const now = new Date()
      const dayMs = 24 * 60 * 60 * 1000

      const last7d = items.filter((i) => new Date(i.updatedAt).getTime() > now.getTime() - 7 * dayMs)
      const last30d = items.filter((i) => new Date(i.updatedAt).getTime() > now.getTime() - 30 * dayMs)

      return json({
        total: items.length,
        last7Days: last7d.length,
        last30Days: last30d.length,
        byType: {
          issues: items.filter((i) => i.type === 'issue').length,
          pullRequests: items.filter((i) => i.type === 'pull_request').length,
          checkFailures: items.filter((i) => i.type === 'check_failure').length,
        },
      })
    },
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

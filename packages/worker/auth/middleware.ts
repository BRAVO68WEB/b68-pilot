// packages/worker/auth/middleware.ts
// Auth middleware for protected routes

import { getSession, type SessionData } from './github'

export interface AuthenticatedRequest extends Request {
  session?: SessionData
}

/**
 * Check if request has valid session.
 * Returns session data or null.
 */
export async function requireAuth(req: Request): Promise<SessionData | null> {
  return getSession(req)
}

/**
 * Check if authenticated user has access to a repository.
 * Uses GitHub API to verify access.
 */
export async function requireRepoAccess(
  req: Request,
  owner: string,
  repo: string
): Promise<{ session: SessionData; hasAccess: boolean } | null> {
  const session = await getSession(req)
  if (!session) return null

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    return { session, hasAccess: res.ok }
  } catch {
    return { session, hasAccess: false }
  }
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorized(message = 'Authentication required'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Create a 403 Forbidden response
 */
export function forbidden(message = 'Access denied'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

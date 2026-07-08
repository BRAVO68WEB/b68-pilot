// packages/worker/auth/github.ts
// GitHub OAuth flow implementation

import { encrypt, decrypt, getSessionCookieName, getStateCookieName } from './session'

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
}

export function getAuthRoutes() {
  return {
    // GET /auth/github - Redirect to GitHub OAuth
    '/auth/github': async (req: Request): Promise<Response> => {
      const clientId = Bun.env.GH_PILOT_GITHUB_CLIENT_ID
      if (!clientId) {
        return new Response('GitHub client ID not configured', { status: 500 })
      }

      const state = crypto.randomUUID()
      const url = new URL(GITHUB_AUTHORIZE_URL)
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', `${getBaseUrl(req)}/auth/callback`)
      url.searchParams.set('state', state)
      url.searchParams.set('scope', 'read:user repo')

      const response = Response.redirect(url.toString(), 302)
      
      // Set state cookie for CSRF protection
      const stateCookieName = getStateCookieName()
      response.headers.append('Set-Cookie', 
        `${stateCookieName}=${state}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=600`
      )

      return response
    },

    // GET /auth/callback - Exchange code for token
    '/auth/callback': async (req: Request): Promise<Response> => {
      const url = new URL(req.url)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (!code || !state) {
        return new Response('Missing code or state', { status: 400 })
      }

      // Verify state (CSRF protection)
      const cookies = parseCookies(req.headers.get('Cookie') || '')
      const storedState = cookies[getStateCookieName()]
      
      if (!storedState || storedState !== state) {
        return new Response('Invalid state parameter', { status: 403 })
      }

      // Exchange code for access token
      const clientId = Bun.env.GH_PILOT_GITHUB_CLIENT_ID
      const clientSecret = Bun.env.GH_PILOT_GITHUB_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        return new Response('GitHub OAuth not configured', { status: 500 })
      }

      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      })

      const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

      if (!tokenData.access_token) {
        return new Response(`Token exchange failed: ${tokenData.error}`, { status: 400 })
      }

      // Get user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })

      const user = await userRes.json() as GitHubUser

      // Create session data
      const sessionData = JSON.stringify({
        accessToken: tokenData.access_token,
        userId: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        createdAt: Date.now(),
      })

      // Encrypt and set session cookie
      const encrypted = await encrypt(sessionData)
      const response = Response.redirect(`${getBaseUrl(req)}/`, 302)
      
      response.headers.append('Set-Cookie',
        `${getSessionCookieName()}=${encrypted}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      )
      
      // Clear state cookie
      response.headers.append('Set-Cookie',
        `${getStateCookieName()}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      )

      return response
    },

    // GET /auth/logout - Clear session
    '/auth/logout': async (req: Request): Promise<Response> => {
      const response = Response.redirect(`${getBaseUrl(req)}/`, 302)
      response.headers.append('Set-Cookie',
        `${getSessionCookieName()}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      )
      return response
    },

    // GET /auth/me - Return current user info
    '/auth/me': async (req: Request): Promise<Response> => {
      const session = await getSession(req)
      
      if (!session) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        userId: session.userId,
        login: session.login,
        name: session.name,
        avatarUrl: session.avatarUrl,
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  }
}

export interface SessionData {
  accessToken: string
  userId: number
  login: string
  name: string | null
  avatarUrl: string
  createdAt: number
}

export async function getSession(req: Request): Promise<SessionData | null> {
  const cookies = parseCookies(req.headers.get('Cookie') || '')
  const sessionCookie = cookies[getSessionCookieName()]
  
  if (!sessionCookie) return null

  const decrypted = await decrypt(sessionCookie)
  if (!decrypted) return null

  try {
    const data = JSON.parse(decrypted) as SessionData
    
    // Check if session expired (24 hours)
    if (Date.now() - data.createdAt > 86400000) {
      return null
    }
    
    return data
  } catch {
    return null
  }
}

export async function getAccessToken(req: Request): Promise<string | null> {
  const session = await getSession(req)
  return session?.accessToken ?? null
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  
  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.split('=')
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  }
  
  return cookies
}

function getBaseUrl(req: Request): string {
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

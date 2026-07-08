// packages/worker/auth/session.ts
// Session management using Bun native Cookie API with AES-GCM-256 encryption

const ALGO = { name: 'AES-GCM', length: 256 }
const SESSION_COOKIE = '__Host-session'
const STATE_COOKIE = '__Host-oauth-state'

let encryptionKey: CryptoKey | null = null

async function getKey(): Promise<CryptoKey> {
  if (encryptionKey) return encryptionKey
  
  const secret = Bun.env.GH_PILOT_SESSION_SECRET
  if (!secret) throw new Error('GH_PILOT_SESSION_SECRET is required')
  
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  encryptionKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('gh-pilot-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    ALGO,
    false,
    ['encrypt', 'decrypt']
  )
  
  return encryptionKey
}

export async function encrypt(data: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  )
  
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
  const ctHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('')
  
  return `${ivHex}:${ctHex}`
}

export async function decrypt(encrypted: string): Promise<string | null> {
  try {
    const [ivHex, ctHex] = encrypted.split(':')
    if (!ivHex || !ctHex) return null
    
    const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
    const ciphertext = new Uint8Array(ctHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
    
    const key = await getKey()
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE
}

export function getStateCookieName(): string {
  return STATE_COOKIE
}

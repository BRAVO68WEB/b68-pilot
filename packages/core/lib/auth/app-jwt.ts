const JWT_ALG = 'RS256'
const JWT_TYP = 'JWT'

export interface AppJwtInput {
    appId: string
    privateKey: string
    now?: number
}

export async function generateAppJwt(input: AppJwtInput): Promise<string> {
    const now = input.now ?? Math.floor(Date.now() / 1000)
    const header = base64UrlJson({ alg: JWT_ALG, typ: JWT_TYP })
    const payload = base64UrlJson({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: input.appId,
    })
    const unsigned = `${header}.${payload}`
    const key = await importPrivateKey(input.privateKey)
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(unsigned)
    )
    return `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`
}

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
    const body = privateKeyPem
        .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
        .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '')
    const binary = Uint8Array.from(atob(body), (char) => char.charCodeAt(0))

    return crypto.subtle.importKey(
        'pkcs8',
        binary,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    )
}

function base64UrlJson(value: unknown): string {
    return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlBytes(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}


import { createSign } from 'node:crypto'

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
    const pem = normalizePem(input.privateKey)

    const sign = createSign('RSA-SHA256')
    sign.update(unsigned)
    const signature = sign.sign(pem)

    return `${unsigned}.${base64UrlBytes(signature)}`
}

function normalizePem(value: string): string {
    let pem = value.trim()

    if (pem.includes('\\n')) {
        pem = pem.replace(/\\n/g, '\n')
    }

    if (!pem.includes('-----BEGIN')) {
        pem = `-----BEGIN RSA PRIVATE KEY-----\n${pem}\n-----END RSA PRIVATE KEY-----`
    }

    return pem
}

function base64UrlJson(value: unknown): string {
    return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlBytes(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

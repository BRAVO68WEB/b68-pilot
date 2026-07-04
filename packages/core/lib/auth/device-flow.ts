export interface DeviceCodeResponse {
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
    interval: number
}

export interface DeviceTokenResponse {
    access_token: string
    token_type: string
    scope: string
}

export type DeviceTokenPending =
    | 'authorization_pending'
    | 'slow_down'
    | 'expired_token'
    | 'access_denied'

export class DeviceFlowPendingError extends Error {
    constructor(public readonly code: DeviceTokenPending) {
        super(code)
        this.name = 'DeviceFlowPendingError'
    }
}

export async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
    const response = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_id: clientId }),
    })
    return parseDeviceResponse<DeviceCodeResponse>(response)
}

export async function requestDeviceToken(
    clientId: string,
    deviceCode: string
): Promise<DeviceTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
    })
    const data = await parseDeviceResponse<DeviceTokenResponse & { error?: DeviceTokenPending }>(response)
    if (data.error) throw new DeviceFlowPendingError(data.error)
    return data
}

async function parseDeviceResponse<T>(response: Response): Promise<T> {
    const data = await response.json()
    if (!response.ok) throw new Error(`GitHub device flow failed: ${JSON.stringify(data)}`)
    return data as T
}


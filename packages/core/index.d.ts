export enum IMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH'
}

export interface IInput {
    path: string
    token: string
    query?: string
    /** Use Bearer token (recommended). Set false for classic token. */
    useBearer?: boolean
}

export interface IClientInput {
    method: IMethod
}

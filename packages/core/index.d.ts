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
}

export interface IClientInput {
    method: IMethod
}
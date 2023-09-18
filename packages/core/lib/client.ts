import { IClientInput, IInput, IMethod } from '../index.d'

const gh_client = async (input: IInput, body: any, cinput: IClientInput) => {
    const url = new Request('https://api.github.com' + input.path + (input.query ? '?' + input.query : ''))

    const requestObject = {
        method: IMethod[cinput.method],
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': 'token ' + input.token,
        },
    }

    if(IMethod[cinput.method] !== IMethod.GET) {
        Object.assign(requestObject, {
            body: JSON.stringify(body)
        })
    }

    const response = await fetch(url, requestObject)

    return await response.json()
}

export {
    gh_client
}

// Path: packages/core/lib/client.ts
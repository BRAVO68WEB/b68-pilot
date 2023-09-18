import { IMethod } from '..';
import { gh_client } from './client';

export class GitHub {
    constructor(private token: string) {}

    async notifications() {
        return await gh_client({
            path: '/notifications',
            token: this.token
        }, {}, {
            method: IMethod['GET']
        })
    }

    async markAsRead(url: string) {
        return await gh_client({
            path: url.replace('https://api.github.com', ''),
            token: this.token
        }, {}, {
            method: IMethod['PATCH']
        })
    }

    async fetch(url: string) {
        return await gh_client({
            path: url.replace('https://api.github.com', ''),
            token: this.token
        }, {}, {
            method: IMethod['GET']
        })
    }

    async listIssues(owner: string, repo: string) {
        return await gh_client({
            path: `/repos/${owner}/${repo}/issues`,
            token: this.token
        }, {}, {
            method: IMethod['GET']
        })
    }

    async listPRs(owner: string, repo: string) {
        return await gh_client({
            path: `/repos/${owner}/${repo}/pulls`,
            token: this.token
        }, {}, {
            method: IMethod['GET']
        })
    }

    async close(url: string) {
        return await gh_client({
            path: url.replace('https://api.github.com', ''),
            token: this.token
        }, {
            state: 'closed'
        }, {
            method: IMethod['PATCH']
        })
    }

    async approvePR(url: string) {
        return await gh_client({
            path: url.replace('https://api.github.com', '') + "/reviews",
            token: this.token
        }, {
            event: 'APPROVE',
            body: 'LGTM'
        }, {
            method: IMethod['POST']
        })
    }

    async mergePR(url: string) {
        return await gh_client({
            path: url.replace('https://api.github.com', '') + "/merge",
            token: this.token
        }, {
            commit_title: 'Merged by @b68web',
            commit_message: 'Merged by @b68web'
        }, {
            method: IMethod['PUT']
        })
    }
}
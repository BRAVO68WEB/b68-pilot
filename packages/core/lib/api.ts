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

    async thread(url: string) {
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

    async approvePR(owner: string, repo: string, pr_number: number, commit_id: string) {
        return await gh_client({
            path: `/repos/${owner}/${repo}/pulls/${pr_number}/reviews`,
            token: this.token
        }, {
            commit_id,
            event: 'APPROVE',
            body: 'LGTM'
        }, {
            method: IMethod['POST']
        })
    }

    async mergePR(url: string) {
        return await gh_client({
            path: url.replace('https://api.github.com', ''),
            token: this.token
        }, {

        }, {
            method: IMethod['PUT']
        })
    }
}
import { generateAppJwt } from '../auth/app-jwt'
import { githubRequest } from './base-client'
import type {
    GitHubAppConfig,
    GitHubInstallation,
    InstallationAccessToken,
} from './types'

export class GitHubAppClient {
    constructor(private readonly config: Pick<GitHubAppConfig, 'appId' | 'privateKey'>) {}

    async jwt(): Promise<string> {
        return generateAppJwt({
            appId: this.config.appId,
            privateKey: this.config.privateKey,
        })
    }

    async listInstallations(): Promise<GitHubInstallation[]> {
        return githubRequest<GitHubInstallation[]>({
            token: await this.jwt(),
            path: '/app/installations',
        })
    }

    async createInstallationAccessToken(installationId: number): Promise<InstallationAccessToken> {
        return githubRequest<InstallationAccessToken>({
            token: await this.jwt(),
            method: 'POST',
            path: `/app/installations/${installationId}/access_tokens`,
        })
    }
}


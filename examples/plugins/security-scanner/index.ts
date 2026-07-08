import type { PilotPlugin, TriggerEvent, PluginContext, TriggerResult } from '@pilot/plugin-sdk'

interface SecurityFinding {
  type: 'secret' | 'vulnerability' | 'dependency' | 'sensitive_file'
  severity: 'low' | 'medium' | 'high' | 'critical'
  file: string
  line?: number
  message: string
  recommendation: string
}

export default {
  name: 'security-scanner',
  version: '1.0.0',
  description: 'Automated security vulnerability detection',

  events: ['pull_request'],

  commands: [
    {
      name: 'security-check',
      description: 'Run security scan on PR',
      usage: 'security-check',
      prOnly: true,
      handler: async (args: string[], ctx: any) => {
        return { message: 'Security scan initiated...', acted: true }
      },
    },
  ],

  onTrigger: async (event: TriggerEvent, ctx: PluginContext): Promise<TriggerResult | null> => {
    // Only scan on PR open or synchronize
    if (event.action !== 'opened' && event.action !== 'synchronize') {
      return null
    }

    const settings = ctx.config.plugins.find(p => p.name === 'security-scanner')?.settings
    const checkSecrets = (settings?.checkSecrets as boolean) ?? true
    const checkVulnerabilities = (settings?.checkVulnerabilities as boolean) ?? true
    const checkDependencies = (settings?.checkDependencies as boolean) ?? true
    const severityThreshold = (settings?.severityThreshold as string) ?? 'medium'

    const repo = event.repo.split('/')
    if (repo.length !== 2 || !event.issueNumber) return null

    const [owner, repoName] = repo
    const findings: SecurityFinding[] = []

    try {
      const files = await ctx.github.getPullFiles(owner, repoName, event.issueNumber)

      for (const file of files) {
        // Skip binary files
        if (file.filename.match(/\.(png|jpg|gif|ico|woff|ttf|pdf)$/)) continue

        // Check for secrets
        if (checkSecrets && file.patch) {
          findings.push(...detectSecrets(file.filename, file.patch))
        }

        // Check for vulnerability patterns
        if (checkVulnerabilities && file.patch) {
          findings.push(...detectVulnerabilities(file.filename, file.patch))
        }

        // Check for sensitive file changes
        if (isSensitiveFile(file.filename)) {
          findings.push({
            type: 'sensitive_file',
            severity: 'medium',
            file: file.filename,
            message: 'Sensitive file modified',
            recommendation: 'Review changes carefully and ensure no secrets are exposed.',
          })
        }

        // Check dependencies
        if (checkDependencies && file.filename.match(/package\.json|requirements\.txt|Gemfile|go\.mod/)) {
          findings.push({
            type: 'dependency',
            severity: 'low',
            file: file.filename,
            message: 'Dependency file changed',
            recommendation: 'Run dependency audit after merge.',
          })
        }
      }

      // Filter by severity threshold
      const filteredFindings = filterBySeverity(findings, severityThreshold)

      if (filteredFindings.length > 0) {
        const report = generateSecurityReport(filteredFindings)
        await ctx.github.comment(owner, repoName, event.issueNumber, report)

        // Add security label
        const hasHigh = filteredFindings.some(f => f.severity === 'high' || f.severity === 'critical')
        if (hasHigh) {
          await ctx.github.addLabels(owner, repoName, event.issueNumber, ['security', 'needs-changes'])
        } else {
          await ctx.github.addLabels(owner, repoName, event.issueNumber, ['security'])
        }

        return {
          handled: true,
          message: `Found ${filteredFindings.length} security issue(s)`,
        }
      }

      // No issues
      await ctx.github.comment(owner, repoName, event.issueNumber,
        '✅ **Security Scan Passed**\n\nNo security issues detected.'
      )

      return { handled: true, message: 'Security scan passed' }
    } catch (error) {
      ctx.logger.error('Security scan failed', { error: String(error) })
      return null
    }
  },
} satisfies PilotPlugin

function detectSecrets(filename: string, patch: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  const secretPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{10,}['"]/gi, name: 'API Key' },
    { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Password' },
    { pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]{10,}['"]/gi, name: 'Secret/Token' },
    { pattern: /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{20,}/g, name: 'Stripe Key' },
    { pattern: /(?:ghp|gho|ghu|ghs)_[a-zA-Z0-9]{36}/g, name: 'GitHub Token' },
    { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, name: 'AWS Access Key' },
    { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, name: 'Private Key' },
    { pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/g, name: 'MongoDB Connection String' },
    { pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/g, name: 'PostgreSQL Connection String' },
  ]

  for (const { pattern, name } of secretPatterns) {
    if (pattern.test(patch)) {
      findings.push({
        type: 'secret',
        severity: 'critical',
        file: filename,
        message: `Potential ${name} detected`,
        recommendation: 'Remove the secret and rotate it immediately. Use environment variables instead.',
      })
    }
  }

  return findings
}

function detectVulnerabilities(filename: string, patch: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  // SQL Injection
  if (patch.match(/query\s*\(\s*`[^`]*\$\{/g) || patch.match(/query\s*\(\s*['"][^'"]*\+/g)) {
    findings.push({
      type: 'vulnerability',
      severity: 'high',
      file: filename,
      message: 'Potential SQL injection vulnerability',
      recommendation: 'Use parameterized queries or an ORM.',
    })
  }

  // XSS
  if (patch.match(/innerHTML\s*=/g) || patch.match(/dangerouslySetInnerHTML/g)) {
    findings.push({
      type: 'vulnerability',
      severity: 'high',
      file: filename,
      message: 'Potential XSS vulnerability',
      recommendation: 'Sanitize user input before rendering.',
    })
  }

  // Command Injection
  if (patch.match(/exec\s*\(\s*`[^`]*\$\{/g) || patch.match(/spawn\s*\(\s*['"][^'"]*['"]/g)) {
    findings.push({
      type: 'vulnerability',
      severity: 'high',
      file: filename,
      message: 'Potential command injection vulnerability',
      recommendation: 'Validate and sanitize input before executing commands.',
    })
  }

  // Path Traversal
  if (patch.match(/readFile\s*\(\s*[^)]*\+/g) || patch.match(/path\.join\s*\(\s*[^)]*req\./g)) {
    findings.push({
      type: 'vulnerability',
      severity: 'medium',
      file: filename,
      message: 'Potential path traversal vulnerability',
      recommendation: 'Validate file paths and use path.resolve() with a base directory.',
    })
  }

  return findings
}

function isSensitiveFile(filename: string): boolean {
  const sensitivePatterns = [
    /\.env$/,
    /\.env\.local$/,
    /\.env\.production$/,
    /config\/.*\.json$/,
    /credentials/i,
    /secrets/i,
    /\.pem$/,
    /\.key$/,
    /id_rsa/,
    /id_ed25519/,
  ]

  return sensitivePatterns.some(pattern => pattern.test(filename))
}

function filterBySeverity(findings: SecurityFinding[], threshold: string): SecurityFinding[] {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 }
  const thresholdValue = severityOrder[threshold as keyof typeof severityOrder] ?? 1

  return findings.filter(f => severityOrder[f.severity] >= thresholdValue)
}

function generateSecurityReport(findings: SecurityFinding[]): string {
  const critical = findings.filter(f => f.severity === 'critical')
  const high = findings.filter(f => f.severity === 'high')
  const medium = findings.filter(f => f.severity === 'medium')
  const low = findings.filter(f => f.severity === 'low')

  let report = '## 🔒 Security Scan Results\n\n'

  if (critical.length > 0) {
    report += '### 🚨 Critical\n\n'
    for (const f of critical) {
      report += `- **${f.file}**: ${f.message}\n`
      report += `  - Recommendation: ${f.recommendation}\n`
    }
    report += '\n'
  }

  if (high.length > 0) {
    report += '### ⚠️ High\n\n'
    for (const f of high) {
      report += `- **${f.file}**: ${f.message}\n`
      report += `  - Recommendation: ${f.recommendation}\n`
    }
    report += '\n'
  }

  if (medium.length > 0) {
    report += '### 🔶 Medium\n\n'
    for (const f of medium) {
      report += `- **${f.file}**: ${f.message}\n`
      report += `  - Recommendation: ${f.recommendation}\n`
    }
    report += '\n'
  }

  if (low.length > 0) {
    report += '### 🔵 Low\n\n'
    for (const f of low) {
      report += `- **${f.file}**: ${f.message}\n`
    }
    report += '\n'
  }

  report += '---\n*Security scan by gh-pilot*'
  return report
}

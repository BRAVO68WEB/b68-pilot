// packages/core/lib/ai/openai.ts
// OpenAI integration for AI-powered code review

export interface OpenAIConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface ReviewRequest {
  diff: string
  prTitle: string
  prDescription?: string
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
  }>
  repoContext?: string
}

export interface ReviewResult {
  summary: string
  issues: ReviewIssue[]
  suggestions: string[]
  securityConcerns: string[]
  overallAssessment: 'approve' | 'request_changes' | 'comment'
}

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'info'
  file?: string
  line?: number
  message: string
  suggestion?: string
}

const DEFAULT_MODEL = 'gpt-4o-mini' // Cost-effective, good for code review
const DEFAULT_MAX_TOKENS = 4000
const DEFAULT_TEMPERATURE = 0.3 // Low temperature for consistent reviews

export class OpenAIClient {
  private readonly apiKey: string
  private readonly model: string
  private readonly maxTokens: number
  private readonly temperature: number

  constructor(config: OpenAIConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required')
    }
    this.apiKey = config.apiKey
    this.model = config.model ?? DEFAULT_MODEL
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE
  }

  /**
   * Generate a code review using OpenAI
   */
  async reviewCode(request: ReviewRequest): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(request)
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as any
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    return this.parseReviewResponse(content)
  }

  /**
   * Build the review prompt from PR context
   */
  private buildReviewPrompt(request: ReviewRequest): string {
    // Truncate diff to fit context window (rough estimate: 4 chars per token)
    const maxDiffChars = 12000 // ~3000 tokens
    const truncatedDiff = request.diff.length > maxDiffChars
      ? request.diff.substring(0, maxDiffChars) + '\n\n... [diff truncated]'
      : request.diff

    let prompt = `## Pull Request Review

**Title:** ${request.prTitle}
`

    if (request.prDescription) {
      prompt += `**Description:** ${request.prDescription}\n`
    }

    prompt += `
**Files Changed:** ${request.files.length}
${request.files.map(f => `- ${f.filename} (${f.status}): +${f.additions}/-${f.deletions}`).join('\n')}

**Code Diff:**
\`\`\`diff
${truncatedDiff}
\`\`\`

Please review this code and provide your analysis in the specified JSON format.
Focus on:
1. Code quality and best practices
2. Potential bugs or logic errors
3. Security concerns
4. Performance issues
5. Suggestions for improvement
`

    return prompt
  }

  /**
   * Parse the OpenAI response into structured review
   */
  private parseReviewResponse(content: string): ReviewResult {
    try {
      const parsed = JSON.parse(content)
      
      return {
        summary: parsed.summary ?? 'No summary provided',
        issues: Array.isArray(parsed.issues) ? parsed.issues.map((i: any) => ({
          severity: this.validateSeverity(i.severity),
          file: i.file,
          line: i.line,
          message: i.message ?? 'No message',
          suggestion: i.suggestion,
        })) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        securityConcerns: Array.isArray(parsed.security_concerns) ? parsed.security_concerns : [],
        overallAssessment: this.validateAssessment(parsed.overall_assessment),
      }
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        summary: content.substring(0, 500),
        issues: [],
        suggestions: [],
        securityConcerns: [],
        overallAssessment: 'comment',
      }
    }
  }

  private validateSeverity(severity: string): 'critical' | 'warning' | 'info' {
    if (severity === 'critical' || severity === 'warning' || severity === 'info') {
      return severity
    }
    return 'info'
  }

  private validateAssessment(assessment: string): 'approve' | 'request_changes' | 'comment' {
    if (assessment === 'approve' || assessment === 'request_changes' || assessment === 'comment') {
      return assessment
    }
    return 'comment'
  }
}

const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided code diff and provide constructive, actionable feedback.

Your response MUST be valid JSON with this structure:
{
  "summary": "Brief summary of the changes",
  "issues": [
    {
      "severity": "critical|warning|info",
      "file": "filename.ts",
      "line": 42,
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "suggestions": ["General improvement suggestions"],
  "security_concerns": ["Security issues if any"],
  "overall_assessment": "approve|request_changes|comment"
}

Guidelines:
- Be specific and reference actual code
- Provide actionable suggestions
- Focus on real issues, not style preferences
- Consider security implications
- Check for common pitfalls
- Be constructive, not critical

Severity levels:
- critical: Bugs, security vulnerabilities, data loss risks
- warning: Code smells, potential issues, missing error handling
- info: Suggestions, best practices, minor improvements`

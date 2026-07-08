// packages/core/lib/ai/issue-analyzer.ts
// AI-powered issue analysis using OpenAI

export interface IssueAnalysisRequest {
  title: string
  body: string
  labels?: string[]
  similarIssues?: Array<{
    number: number
    title: string
    state: string
    body?: string
  }>
  repoContext?: string
}

export interface IssueAnalysisResult {
  summary: string
  suggestedLabels: string[]
  suggestedAssignee?: string
  similarIssues: Array<{
    number: number
    title: string
    similarity: number
    resolution?: string
  }>
  suggestedSolutions: Array<{
    title: string
    description: string
    confidence: number
    steps?: string[]
  }>
  isDuplicate: boolean
  duplicateOf?: number
  category: 'bug' | 'feature' | 'question' | 'documentation' | 'security' | 'performance' | 'other'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export class IssueAnalyzer {
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required')
    }
    this.apiKey = apiKey
    this.model = model
  }

  /**
   * Analyze an issue and generate suggestions
   */
  async analyze(request: IssueAnalysisRequest): Promise<IssueAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(request)

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
            content: ISSUE_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 3000,
        temperature: 0.3,
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

    return this.parseAnalysisResponse(content, request.similarIssues)
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(request: IssueAnalysisRequest): string {
    let prompt = `## Issue Analysis

**Title:** ${request.title}

**Description:**
${request.body || 'No description provided'}
`

    if (request.labels && request.labels.length > 0) {
      prompt += `\n**Labels:** ${request.labels.join(', ')}`
    }

    if (request.similarIssues && request.similarIssues.length > 0) {
      prompt += `\n\n**Similar Past Issues:**\n`
      for (const issue of request.similarIssues) {
        prompt += `- #${issue.number}: ${issue.title} (${issue.state})\n`
        if (issue.body) {
          prompt += `  Summary: ${issue.body.substring(0, 200)}...\n`
        }
      }
    }

    if (request.repoContext) {
      prompt += `\n\n**Repository Context:**\n${request.repoContext}`
    }

    prompt += `\n\nPlease analyze this issue and provide your assessment in the specified JSON format.
Focus on:
1. Categorizing the issue (bug, feature, question, etc.)
2. Suggesting appropriate labels
3. Finding similar issues and checking for duplicates
4. Providing actionable solutions with step-by-step instructions
5. Assessing priority based on impact`

    return prompt
  }

  /**
   * Parse the OpenAI response
   */
  private parseAnalysisResponse(content: string, similarIssues?: IssueAnalysisRequest['similarIssues']): IssueAnalysisResult {
    try {
      const parsed = JSON.parse(content)

      return {
        summary: parsed.summary ?? 'No summary provided',
        suggestedLabels: Array.isArray(parsed.suggested_labels) ? parsed.suggested_labels : [],
        suggestedAssignee: parsed.suggested_assignee,
        similarIssues: Array.isArray(parsed.similar_issues) ? parsed.similar_issues.map((i: any) => ({
          number: i.number ?? 0,
          title: i.title ?? 'Unknown',
          similarity: i.similarity ?? 0,
          resolution: i.resolution,
        })) : [],
        suggestedSolutions: Array.isArray(parsed.suggested_solutions) ? parsed.suggested_solutions.map((s: any) => ({
          title: s.title ?? 'Solution',
          description: s.description ?? 'No description',
          confidence: s.confidence ?? 0.5,
          steps: Array.isArray(s.steps) ? s.steps : [],
        })) : [],
        isDuplicate: parsed.is_duplicate ?? false,
        duplicateOf: parsed.duplicate_of,
        category: this.validateCategory(parsed.category),
        priority: this.validatePriority(parsed.priority),
      }
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        summary: content.substring(0, 500),
        suggestedLabels: [],
        similarIssues: [],
        suggestedSolutions: [],
        isDuplicate: false,
        category: 'other',
        priority: 'medium',
      }
    }
  }

  private validateCategory(category: string): IssueAnalysisResult['category'] {
    const validCategories: IssueAnalysisResult['category'][] = ['bug', 'feature', 'question', 'documentation', 'security', 'performance', 'other']
    return validCategories.includes(category as any) ? category as any : 'other'
  }

  private validatePriority(priority: string): IssueAnalysisResult['priority'] {
    const validPriorities: IssueAnalysisResult['priority'][] = ['low', 'medium', 'high', 'critical']
    return validPriorities.includes(priority as any) ? priority as any : 'medium'
  }
}

const ISSUE_SYSTEM_PROMPT = `You are an expert issue triager and problem solver. Analyze the provided GitHub issue and provide actionable insights.

Your response MUST be valid JSON with this structure:
{
  "summary": "Brief summary of the issue",
  "suggested_labels": ["bug", "priority:high"],
  "suggested_assignee": "username or null",
  "similar_issues": [
    {
      "number": 123,
      "title": "Similar issue title",
      "similarity": 0.85,
      "resolution": "How it was resolved"
    }
  ],
  "suggested_solutions": [
    {
      "title": "Solution title",
      "description": "Detailed description",
      "confidence": 0.8,
      "steps": ["Step 1", "Step 2"]
    }
  ],
  "is_duplicate": false,
  "duplicate_of": null,
  "category": "bug|feature|question|documentation|security|performance|other",
  "priority": "low|medium|high|critical"
}

Guidelines:
- Be specific and actionable
- Reference similar issues if they exist
- Provide step-by-step solutions when possible
- Consider security implications
- Assess priority based on impact and urgency
- Suggest appropriate labels for categorization`

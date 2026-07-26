import { api } from '../../lib/api'

export type ProposalKind = 'MOVE_SESSION' | 'UPDATE_SESSION' | 'ADD_SESSION' | 'SKIP_SESSION'
export type ProposalStatus = 'PENDING' | 'APPLIED' | 'DISMISSED'

export interface ProposalResponse {
  id: string
  kind: ProposalKind
  sessionId: string | null
  /** Kind-specific change (date, durationMin, title…) as submitted by the coach. */
  payload: Record<string, unknown>
  rationale: string | null
  status: ProposalStatus
  resolvedAt: string | null
}

export interface WeeklyInsightResponse {
  id: string
  weekStart: string
  prose: string
  createdAt: string
  proposals: ProposalResponse[]
}

export function fetchInsights(limit = 12): Promise<WeeklyInsightResponse[]> {
  return api.get<WeeklyInsightResponse[]>(`/api/coach/insights?limit=${limit}`)
}

export function applyProposal(proposalId: string): Promise<WeeklyInsightResponse> {
  return api.post<WeeklyInsightResponse>(`/api/coach/proposals/${proposalId}/apply`, undefined)
}

export function dismissProposal(proposalId: string): Promise<WeeklyInsightResponse> {
  return api.post<WeeklyInsightResponse>(`/api/coach/proposals/${proposalId}/dismiss`, undefined)
}

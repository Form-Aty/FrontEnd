// 실 API 클라이언트 — 백엔드(develop_system.md §5 REST 명세)와 통신한다.
// 기존 목 API(mockApi.ts)의 `api.*` 시그니처를 그대로 유지하므로 호출부는
// import 경로만 바꾸면 된다. 엔벨로프 언래핑/인증/리프레시는 http 계층이 담당.
import type {
  AiCreditLedgerEntry,
  AuditResult,
  CreditLedgerEntry,
  GeneratedQuestion,
  Report,
  ReportReason,
  Survey,
  SurveyQuestion,
  SurveyResult,
  SurveySection,
  SurveyResponse,
  Team,
  TeamCreditLedgerEntry,
  TeamDetail,
  TeamInvite,
  TeamRole,
  User,
} from '@/types/domain';
import { http } from './http';

export interface TokenResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

type QuestionInput = Omit<SurveyQuestion, 'id' | 'surveyId' | 'sectionId' | 'position' | 'branchRules'> & {
  sectionClientId?: string | null;
  branchRules?: Record<string, string>;
};

export interface ResponseAnswerInput {
  questionId: number;
  value: string | string[];
}

export interface CreateSurveySectionInput {
  clientId: string;
  title: string;
  description?: string | null;
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  externalUrl?: string | null;
  category: string;
  estMinutes: number;
  targetCount: number;
  teamId?: number | null;
  proofRequired: boolean;
  selfBuilt?: boolean;
  sections?: CreateSurveySectionInput[];
  questions?: QuestionInput[];
}

export interface UpdateSurveyInput {
  title: string;
  description?: string;
  category: string;
  estMinutes: number;
  targetCount: number;
  sections?: CreateSurveySectionInput[];
  questions?: QuestionInput[];
}

export const api = {
  // ───────────────────────── Auth ─────────────────────────
  signup(input: { email: string; nickname: string; password: string }) {
    return http.post<{ userId: number }>('/auth/signup', input, { auth: false });
  },

  verify(input: { email: string; code: string }) {
    return http.post<{ verified: boolean }>('/auth/verify', input, { auth: false });
  },

  resendVerification(input: { email: string }) {
    return http.post<{ sent: boolean }>('/auth/verification/resend', input, { auth: false });
  },

  login(input: { email: string; password: string }) {
    return http.post<TokenResponse>('/auth/login', input, { auth: false });
  },

  me() {
    return http.get<User>('/auth/me');
  },

  // ──────────────────────── Survey ────────────────────────
  createSurvey(input: CreateSurveyInput) {
    return http.post<Survey>('/surveys', {
      title: input.title,
      description: input.description ?? null,
      externalUrl: input.externalUrl ?? null,
      category: input.category,
      estMinutes: input.estMinutes,
      targetCount: input.targetCount,
      teamId: input.teamId ?? null,
      proofRequired: input.proofRequired,
      selfBuilt: input.selfBuilt ?? false,
      sections: input.sections ?? [],
      questions: input.questions ?? [],
    });
  },

  updateSurvey(id: number, input: UpdateSurveyInput) {
    return http.put<Survey>(`/surveys/${id}`, {
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      estMinutes: input.estMinutes,
      targetCount: input.targetCount,
      sections: input.sections ?? [],
      questions: input.questions ?? [],
    });
  },

  getSurveySections(surveyId: number) {
    return http.get<SurveySection[]>(`/surveys/${surveyId}/sections`);
  },

  getSurveyQuestions(surveyId: number) {
    return http.get<SurveyQuestion[]>(`/surveys/${surveyId}/questions`);
  },

  getSurvey(id: number) {
    return http.get<Survey>(`/surveys/${id}`);
  },

  getSurveyResults(id: number) {
    return http.get<SurveyResult>(`/surveys/${id}/results`);
  },

  mySurveys() {
    return http.get<Survey[]>('/surveys/mine');
  },

  setSurveyStatus(id: number, status: 'ACTIVE' | 'PAUSED') {
    return http.patch<Survey>(`/surveys/${id}/status`, { status });
  },

  feed(page = 0) {
    return http.get<Survey[]>(`/feed?page=${page}`);
  },

  // ─────────────── Response (start / complete) ───────────────
  startResponse(surveyId: number) {
    return http.post<SurveyResponse>('/responses/start', { surveyId });
  },

  completeResponse(input: { surveyId: number; proofInput?: string; answers?: ResponseAnswerInput[] }) {
    return http.post<{ response: SurveyResponse; reward: number }>('/responses/complete', {
      surveyId: input.surveyId,
      proofInput: input.proofInput ?? null,
      answers: input.answers ?? [],
    });
  },

  // ───────────────────────── Report ─────────────────────────
  report(input: { targetResponseId: number | null; reason: ReportReason; note?: string }) {
    return http.post<Report>('/reports', {
      targetResponseId: input.targetResponseId,
      reason: input.reason,
      note: input.note ?? null,
    });
  },

  // ───────────────────────── Credit ─────────────────────────
  responseCredit() {
    return http.get<{ balance: number; ledger: CreditLedgerEntry[] }>('/credits/response');
  },

  aiCredit() {
    return http.get<{ balance: number; ledger: AiCreditLedgerEntry[] }>('/credits/ai');
  },

  // ─────────────────────── AI (유료) ───────────────────────
  aiRefine(goal: string) {
    return http.post<{ questions: string[]; researchQuestion: string }>('/ai/refine', { goal });
  },

  aiGenerate(researchQuestion: string) {
    return http.post<{ questions: GeneratedQuestion[] }>('/ai/generate', { researchQuestion });
  },

  aiAudit(questions: string[]) {
    return http.post<AuditResult>('/ai/audit', { questions });
  },

  purchaseAiCredit(amount: number) {
    return http.post<{ balance: number }>('/ai/credits/purchase', { amount });
  },

  // ───────────────────────── Team ─────────────────────────
  teams() {
    return http.get<Team[]>('/teams');
  },

  createTeam(input: { name: string; courseName?: string; semester?: string }) {
    return http.post<TeamDetail>('/teams', {
      name: input.name,
      courseName: input.courseName ?? null,
      semester: input.semester ?? null,
    });
  },

  team(id: number) {
    return http.get<TeamDetail>(`/teams/${id}`);
  },

  joinTeam(code: string) {
    return http.post<TeamDetail>('/teams/join', { code });
  },

  teamInvites(teamId: number) {
    return http.get<TeamInvite[]>(`/teams/${teamId}/invites`);
  },

  createTeamInvite(teamId: number, input: { maxUses?: number; expiresInDays?: number } = {}) {
    return http.post<TeamInvite>(`/teams/${teamId}/invites`, {
      maxUses: input.maxUses ?? null,
      expiresInDays: input.expiresInDays ?? null,
    });
  },

  revokeTeamInvite(teamId: number, inviteId: number) {
    return http.patch<TeamInvite>(`/teams/${teamId}/invites/${inviteId}/revoke`, {});
  },

  updateTeamMemberRole(teamId: number, userId: number, role: Exclude<TeamRole, 'OWNER'>) {
    return http.patch<TeamDetail>(`/teams/${teamId}/members/${userId}/role`, { role });
  },

  teamCredit(teamId: number) {
    return http.get<{ balance: number; ledger: TeamCreditLedgerEntry[] }>(`/teams/${teamId}/credits`);
  },

  depositTeamCredit(teamId: number, amount: number) {
    return http.post<{ balance: number; ledger: TeamCreditLedgerEntry[] }>(
      `/teams/${teamId}/credits/deposit`,
      { amount },
    );
  },
};

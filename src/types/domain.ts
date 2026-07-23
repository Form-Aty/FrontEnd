// 도메인 타입 — develop_system.md §3.2 DDL 과 1:1 대응.
// 백엔드 연동 전까지 더미 데이터/목 API가 이 타입을 그대로 사용한다.

export type UserStatus = 'ACTIVE' | 'FROZEN';

export interface User {
  id: number;
  email: string;
  nickname: string;
  university: string | null;
  verifiedAt: string | null; // 학교 이메일 인증 시각
  responseCredit: number; // 캐시된 잔액 (원장과 함께 갱신)
  aiCredit: number;
  contribution: number; // 기여도 (갚은 응답 수 기반)
  status: UserStatus;
  createdAt: string;
}

export type SurveyStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

// 카드/상세에서 쓰는 작성자 요약 (백엔드 SurveyDto.owner 임베드).
export interface OwnerSummary {
  id: number;
  nickname: string;
  university: string | null;
}

export interface Survey {
  id: number;
  ownerId: number;
  owner?: OwnerSummary;
  teamId: number | null;
  team?: TeamSummary | null;
  title: string;
  description: string | null;
  externalUrl: string | null; // 구글폼 등 (자체빌더면 null)
  category: string | null;
  estMinutes: number;
  targetCount: number;
  collectedCount: number;
  costPerResponse: number; // 응답당 차감 크레딧 (소요시간 기반 산정)
  proofRequired: boolean; // 증빙 토큰 사용 여부
  selfBuilt: boolean; // 자체 빌더로 만든 설문(externalUrl 없이 앱 안에서 응답)
  status: SurveyStatus;
  createdAt: string;
}

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type TeamStatus = 'ACTIVE' | 'ARCHIVED';

export interface TeamSummary {
  id: number;
  name: string;
  courseName: string | null;
  semester: string | null;
}

export interface Team {
  id: number;
  name: string;
  courseName: string | null;
  semester: string | null;
  university: string | null;
  responseCredit: number;
  status: TeamStatus;
  role: TeamRole;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  userId: number;
  email: string;
  nickname: string;
  university: string | null;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamDetail {
  team: Team;
  members: TeamMember[];
}

export interface TeamInvite {
  id: number;
  teamId: number;
  code: string;
  createdById: number;
  createdByNickname: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

// 자체 설문 빌더 — develop_system.md §3.1 survey_questions (자체 빌더용).
// 구글폼 레퍼런스의 문항 유형.
export type QuestionType =
  | 'short' // 단답형
  | 'paragraph' // 장문형
  | 'single' // 객관식 질문(라디오)
  | 'multi' // 체크박스
  | 'dropdown' // 드롭다운
  | 'scale' // 선형 배율
  | 'date'; // 날짜

export interface SurveyQuestion {
  id: number;
  surveyId: number;
  sectionId: number | null;
  position: number;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  options: string[]; // single/multi/dropdown 용
  branchRules: Record<string, number>; // single/dropdown 옵션값 -> 이동할 섹션 id
  scaleMax: number; // scale 용 (2~10)
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
}

export interface SurveySection {
  id: number;
  surveyId: number;
  position: number;
  title: string;
  description: string | null;
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short: '단답형',
  paragraph: '장문형',
  single: '객관식 질문',
  multi: '체크박스',
  dropdown: '드롭다운',
  scale: '선형 배율',
  date: '날짜',
};

export type ResponseStatus = 'PENDING' | 'VERIFIED' | 'DISPUTED';

export interface SurveyResponse {
  id: number;
  surveyId: number;
  responderId: number;
  status: ResponseStatus;
  proofToken: string | null; // 응답자별 고유 증빙 토큰
  startedAt: string | null; // 체류시간 검사용
  completedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}

export interface SurveyResultValueCount {
  value: string;
  count: number;
  percentage: number;
}

export interface SurveyResultTextAnswer {
  value: string;
  completedAt: string | null;
}

export interface SurveyQuestionResult {
  questionId: number;
  sectionId: number | null;
  position: number;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  options: string[];
  answerCount: number;
  optionCounts: SurveyResultValueCount[];
  average: number | null;
  distribution: SurveyResultValueCount[];
  textAnswers: SurveyResultTextAnswer[];
}

export interface SurveyResult {
  survey: Survey;
  responseCount: number;
  sections: SurveySection[];
  questions: SurveyQuestionResult[];
}

export type CreditReason =
  | 'EARN_RESPONSE'
  | 'SPEND_COLLECT'
  | 'SEED'
  | 'TRANSFER_TO_TEAM'
  | 'PENALTY';

export interface CreditLedgerEntry {
  id: number;
  userId: number;
  delta: number; // +적립 / -차감
  reason: CreditReason;
  refResponseId: number | null;
  createdAt: string;
}

export type AiCreditReason =
  | 'PURCHASE'
  | 'SPEND_DESIGN'
  | 'SPEND_AUDIT'
  | 'BRIDGE'
  | 'REFUND_AI_FAILURE';

export interface AiCreditLedgerEntry {
  id: number;
  userId: number;
  delta: number;
  reason: AiCreditReason;
  tokensUsed: number | null;
  refSessionId: number | null;
  createdAt: string;
}

export type AiFeature = 'REFINE' | 'GENERATE' | 'AUDIT';

export interface AiSession {
  id: number;
  userId: number;
  feature: AiFeature;
  inputSummary: string;
  outputJson: unknown;
  requestId?: string | null;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  provider?: string | null;
  model?: string | null;
  providerResponseId?: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  createdAt: string;
}

export type TeamCreditReason = 'DEPOSIT_FROM_USER' | 'SPEND_COLLECT' | 'ADJUSTMENT' | 'REFUND';

export interface TeamCreditLedgerEntry {
  id: number;
  teamId: number;
  actorId: number | null;
  actorNickname: string | null;
  delta: number;
  reason: TeamCreditReason;
  refResponseId: number | null;
  createdAt: string;
}

export type ReportReason = 'LOW_EFFORT' | 'FAKE' | 'SPAM';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';

export interface Report {
  id: number;
  reporterId: number;
  targetResponseId: number | null;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
}

// ── AI 편향 감수 출력 스키마 (develop_system.md §4.4) ──
export type AiIssueType =
  | 'leading'
  | 'double_barreled'
  | 'ambiguous'
  | 'missing_option'
  | 'scale_imbalance'
  | 'cognitive_burden'
  | 'sensitive_required'
  | 'response_mismatch';

export interface AuditIssue {
  index: number;
  type: AiIssueType;
  severity: 'warning' | 'error';
  reason: string;
  suggestion: string;
  suggestedText: string;
}

export interface AuditResult {
  issues: AuditIssue[];
  qualityScore: number;
  nextSteps: string[];
  validationNotice: string;
}

// AI 문항 생성 출력
export interface GeneratedQuestion {
  sectionIndex: number;
  type: QuestionType;
  text: string;
  description: string;
  required: boolean;
  options: string[];
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  construct: string;
  rationale: string;
}

export interface GeneratedSection {
  title: string;
  description: string;
}

export interface ResearchBasis {
  code: string;
  title: string;
  doi: string;
  appliedRule: string;
}

export interface GenerateSurveyInput {
  researchQuestion: string;
  topic: string;
  targetAudience: string;
  decisionContext: string;
  questionCount: number;
  constraints: string;
}

export interface GeneratedSurvey {
  title: string;
  description: string;
  researchQuestion: string;
  category: string;
  estimatedMinutes: number;
  sections: GeneratedSection[];
  questions: GeneratedQuestion[];
  audit: AuditResult;
  researchBasis: ResearchBasis[];
  validationSteps: string[];
  validationNotice: string;
}

export interface AuditQuestionInput {
  text: string;
  type: QuestionType;
  options: string[];
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  required: boolean;
}

// 카테고리 (설문 등록/피드 칩)
export const CATEGORIES = [
  '학업/전공',
  '창업/사업',
  '소비/트렌드',
  '심리/행동',
  '사회/시사',
  '건강/운동',
  '기타',
] as const;
export type Category = (typeof CATEGORIES)[number];

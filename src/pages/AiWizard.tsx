import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClose, IconCheck } from '@/components/icons';
import { Stepper } from '@/components/Stepper';
import { Button } from '@/components/Button';
import { Card } from '@/components/Bits';
import { api } from '@/api/api';
import { ApiError } from '@/api/errors';
import { useInvalidateAll } from '@/api/queries';
import { useToast } from '@/store/ui';
import type {
  AuditIssue,
  AuditQuestionInput,
  AuditResult,
  GeneratedQuestion,
  GeneratedSurvey,
  QuestionType,
} from '@/types/domain';
import styles from './AiWizard.module.css';

const ISSUE_LABEL: Record<AuditIssue['type'], string> = {
  leading: '유도질문',
  double_barreled: '이중질문',
  ambiguous: '모호한 표현',
  missing_option: '선택지 문제',
  scale_imbalance: '척도 불균형',
  cognitive_burden: '인지부담',
  sensitive_required: '민감 문항 필수응답',
  response_mismatch: '응답 형식 불일치',
};

const Q_TYPE: Record<QuestionType, string> = {
  short: '단답형',
  paragraph: '장문형',
  single: '객관식',
  multi: '복수선택',
  dropdown: '드롭다운',
  scale: '5점 척도',
  date: '날짜',
};

const keepIdempotencyKey = (error: ApiError) =>
  ['TIMEOUT', 'NETWORK', 'AI_REQUEST_CONFLICT'].includes(error.code);

const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `ai-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

function toAuditQuestion(question: GeneratedQuestion): AuditQuestionInput {
  return {
    text: question.text,
    type: question.type,
    options: question.options,
    scaleMax: question.scaleMax,
    scaleMinLabel: question.scaleMinLabel,
    scaleMaxLabel: question.scaleMaxLabel,
    required: question.required,
  };
}

// 논문 기반 AI 설문 설계: 요구사항 → 구조화 생성 → 정밀 감수 → 빌더 인계.
export function AiWizard() {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const push = useToast((state) => state.push);

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [decisionContext, setDecisionContext] = useState('');
  const [constraints, setConstraints] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [researchQuestion, setResearchQuestion] = useState('');
  const [survey, setSurvey] = useState<GeneratedSurvey | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const generationRequestId = useRef<string | null>(null);
  const auditRequestId = useRef<string | null>(null);

  const generate = async () => {
    setBusy(true);
    generationRequestId.current ??= newRequestId();
    try {
      const refined = await api.aiRefine({
        goal: topic.trim(),
        targetAudience: targetAudience.trim(),
        decisionContext: decisionContext.trim(),
      });
      setResearchQuestion(refined.researchQuestion);
      const generated = await api.aiGenerate(
        {
          researchQuestion: refined.researchQuestion,
          topic: topic.trim(),
          targetAudience: targetAudience.trim(),
          decisionContext: decisionContext.trim(),
          questionCount,
          constraints: constraints.trim(),
        },
        generationRequestId.current,
      );
      setSurvey(generated);
      setAuditResult(generated.audit);
      generationRequestId.current = null;
      auditRequestId.current = null;
      invalidate();
      setStep(2);
    } catch (error) {
      if (error instanceof ApiError) {
        push(error.message, 'warning');
        if (!keepIdempotencyKey(error)) generationRequestId.current = null;
      } else {
        push('설문을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.', 'warning');
        generationRequestId.current = null;
      }
    } finally {
      setBusy(false);
    }
  };

  const audit = async () => {
    if (!survey) return;
    setBusy(true);
    auditRequestId.current ??= newRequestId();
    try {
      const result = await api.aiAudit(
        survey.questions.map(toAuditQuestion),
        auditRequestId.current,
      );
      setAuditResult(result);
      auditRequestId.current = null;
      invalidate();
      setStep(3);
    } catch (error) {
      if (error instanceof ApiError) {
        push(error.message, 'warning');
        if (!keepIdempotencyKey(error)) auditRequestId.current = null;
      } else {
        push('문항을 감수하지 못했어요. 잠시 후 다시 시도해 주세요.', 'warning');
        auditRequestId.current = null;
      }
    } finally {
      setBusy(false);
    }
  };

  const openBuilder = () => {
    if (!survey) return;
    navigate('/surveys/new', { state: { aiDraft: survey } });
  };

  const issues = auditResult?.issues ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.icon} onClick={() => navigate('/feed')} aria-label="닫기">
          <IconClose />
        </button>
        <span className={styles.headerTitle}>AI 설문 설계</span>
        <span className={styles.icon} />
      </header>

      <div className={styles.body}>
        <Stepper current={step} total={4} />

        {step === 1 && (
          <>
            <h1 className={styles.title}>
              조사 목적을
              <br />
              구체적으로 알려주세요
            </h1>
            <p className={styles.sub}>
              연구 근거를 적용해 문항·응답척도·순서를 함께 설계해요. 현재 무료 베타이며 사용자별
              호출 한도가 있어요.
            </p>

            <div className={styles.form}>
              <label className={styles.field}>
                <span className={styles.label}>조사 주제</span>
                <textarea
                  className={styles.textarea}
                  maxLength={500}
                  placeholder="예) 대학생의 카페 이용 경험과 재방문 의도"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                />
                <span className={styles.counter}>{topic.length}/500</span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>조사 대상</span>
                <input
                  className={styles.input}
                  maxLength={200}
                  placeholder="예) 최근 3개월 안에 교내 카페를 이용한 대학생"
                  value={targetAudience}
                  onChange={(event) => setTargetAudience(event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>결과로 내릴 결정</span>
                <input
                  className={styles.input}
                  maxLength={500}
                  placeholder="예) 메뉴와 좌석 환경의 개선 우선순위를 정한다"
                  value={decisionContext}
                  onChange={(event) => setDecisionContext(event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  문항 수 <strong>{questionCount}개</strong>
                </span>
                <input
                  className={styles.range}
                  type="range"
                  min={5}
                  max={20}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                />
                <span className={styles.rangeHint}>인지부담을 고려해 5~20개만 생성해요.</span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>추가 조건 (선택)</span>
                <textarea
                  className={`${styles.textarea} ${styles.compactTextarea}`}
                  maxLength={1000}
                  placeholder="예) 개인정보는 묻지 않고, 자유서술은 마지막에 1개만"
                  value={constraints}
                  onChange={(event) => setConstraints(event.target.value)}
                />
              </label>
            </div>
          </>
        )}

        {step === 2 && survey && (
          <>
            <h1 className={styles.title}>생성된 설문 초안</h1>
            <p className={styles.sub}>
              서버 품질검사를 통과한 초안이에요. 다음 단계에서 의미·편향을 한 번 더 감수할 수 있어요.
            </p>
            <div className={styles.rqBox}>
              <span className={styles.eyebrow}>연구질문</span>
              {researchQuestion}
            </div>
            <div className={styles.surveyMeta}>
              <strong>{survey.title}</strong>
              <span>
                {survey.questions.length}문항 · 약 {survey.estimatedMinutes}분
              </span>
            </div>

            <div className={styles.qList}>
              {survey.sections.map((section, sectionIndex) => (
                <section key={`${section.title}-${sectionIndex}`} className={styles.generatedSection}>
                  <div className={styles.sectionHead}>
                    <span>섹션 {sectionIndex + 1}</span>
                    <strong>{section.title}</strong>
                    {section.description && <p>{section.description}</p>}
                  </div>
                  {survey.questions
                    .map((question, index) => ({ question, index }))
                    .filter(({ question }) => question.sectionIndex === sectionIndex)
                    .map(({ question, index }) => (
                      <div key={`${question.text}-${index}`} className={styles.qCard}>
                        <div className={styles.qHead}>
                          <span className={styles.qNum}>Q{index + 1}</span>
                          <span className={styles.qType}>{Q_TYPE[question.type]}</span>
                          <span className={styles.construct}>{question.construct}</span>
                        </div>
                        <p className={styles.qText}>{question.text}</p>
                        {question.options.length > 0 && (
                          <ul className={styles.options}>
                            {question.options.map((option) => (
                              <li key={option}>{option}</li>
                            ))}
                          </ul>
                        )}
                        {question.type === 'scale' && (
                          <p className={styles.scaleLabels}>
                            1 {question.scaleMinLabel} — {question.scaleMax} {question.scaleMaxLabel}
                          </p>
                        )}
                      </div>
                    ))}
                </section>
              ))}
            </div>
          </>
        )}

        {step === 3 && auditResult && survey && (
          <>
            <h1 className={styles.title}>정밀 감수 결과</h1>
            <div className={styles.scoreCard}>
              <span>문항 품질 점수</span>
              <strong>{auditResult.qualityScore}</strong>
              <span>/ 100</span>
            </div>
            {issues.length === 0 ? (
              <Card className={styles.clean}>
                <p className="h3">자동 검사에서 추가 결함을 찾지 못했어요.</p>
                <p className="sm muted">실제 대상자를 통한 사전검증은 별도로 필요해요.</p>
              </Card>
            ) : (
              <div className={styles.issues}>
                {issues.map((issue, index) => (
                  <div
                    key={`${issue.index}-${issue.type}-${index}`}
                    className={`${styles.issue} ${
                      issue.severity === 'error' ? styles.issueError : ''
                    }`}
                  >
                    <div className={styles.issueHead}>
                      <span className={styles.warnMark} aria-hidden>
                        !
                      </span>
                      <span className={styles.issueTitle}>{ISSUE_LABEL[issue.type]}</span>
                      <span className={styles.severity}>
                        {issue.severity === 'error' ? '수정 권장' : '확인'}
                      </span>
                    </div>
                    {issue.index >= 0 && (
                      <p className={styles.issueQuote}>“{survey.questions[issue.index]?.text}”</p>
                    )}
                    <p className={styles.issueReason}>{issue.reason}</p>
                    <p className={styles.issueSuggestion}>{issue.suggestion}</p>
                    {issue.suggestedText && (
                      <p className={styles.suggestedText}>제안: {issue.suggestedText}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 4 && survey && auditResult && (
          <div className={styles.doneWrap}>
            <div className={styles.doneMark}>
              <IconCheck size={30} />
            </div>
            <h1 className={styles.title}>편집할 준비가 됐어요</h1>
            <p className={styles.sub}>{auditResult.validationNotice}</p>
            <ol className={styles.nextSteps}>
              {auditResult.nextSteps.map((nextStep) => (
                <li key={nextStep}>{nextStep}</li>
              ))}
            </ol>
            <p className={styles.basisNote}>
              Artino(2014), Krosnick(1991), Saris et al.(2010), Boateng et al.(2018)의 설계 원칙을
              적용했습니다.
            </p>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {step === 1 && (
          <Button
            size="lg"
            full
            loading={busy}
            disabled={
              topic.trim().length < 5 ||
              targetAudience.trim().length < 3 ||
              decisionContext.trim().length < 3
            }
            onClick={generate}
          >
            논문 기반 설문 생성
          </Button>
        )}
        {step === 2 && (
          <div className={styles.row}>
            <Button size="lg" variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              조건 수정
            </Button>
            <Button size="lg" full loading={busy} onClick={audit}>
              정밀 감수
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className={styles.row}>
            <Button size="lg" variant="secondary" onClick={openBuilder}>
              바로 편집
            </Button>
            <Button size="lg" full onClick={() => setStep(4)}>
              검증 안내 보기
            </Button>
          </div>
        )}
        {step === 4 && (
          <Button size="lg" full onClick={openBuilder}>
            설문 편집기로 가져가기
          </Button>
        )}
      </div>
    </div>
  );
}

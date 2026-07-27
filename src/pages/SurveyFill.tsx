import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { QuestionView, type AnswerValue } from '@/components/QuestionView';
import { useCompleteResponse, useSurvey, useSurveyQuestions, useSurveySections } from '@/api/queries';
import { api } from '@/api/api';
import { ApiError } from '@/api/errors';
import { useToast } from '@/store/ui';
import type { SurveyQuestion, SurveySection } from '@/types/domain';
import styles from './SurveyFill.module.css';

const isEmpty = (v: AnswerValue | undefined) =>
  v === undefined || (Array.isArray(v) ? v.length === 0 : v.trim() === '');

// 자체 빌더 설문 — 앱 안에서 직접 응답 (구글폼 응답 화면 레퍼런스).
export function SurveyFill() {
  const { id } = useParams();
  const surveyId = Number(id);
  const navigate = useNavigate();
  const { data: survey } = useSurvey(surveyId);
  const { data: questions } = useSurveyQuestions(surveyId);
  const { data: sections } = useSurveySections(surveyId);
  const complete = useCompleteResponse();
  const push = useToast((s) => s.push);

  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [errorIdx, setErrorIdx] = useState<Set<number>>(new Set());
  const [currentSectionId, setCurrentSectionId] = useState<number | null>(null);
  const [sectionHistory, setSectionHistory] = useState<number[]>([]);

  // 직접 진입한 경우에도 응답 시작(체류시간 기록). 서버 start 는 멱등 —
  // 이미 PENDING 이면 기존 응답을 돌려준다. ref 로 중복 호출만 막는다.
  const started = useRef(false);
  useEffect(() => {
    if (surveyId && !started.current) {
      started.current = true;
      api.startResponse(surveyId).catch(() => {});
    }
  }, [surveyId]);

  useEffect(() => {
    if (!sections?.length) return;
    if (currentSectionId === null || !sections.some((section) => section.id === currentSectionId)) {
      setCurrentSectionId(sections[0].id);
      setSectionHistory([]);
    }
  }, [sections, currentSectionId]);

  if (!survey || !questions || !sections) {
    return (
      <AppShell back title="설문 응답" hideNav>
        <div className={styles.loading} />
      </AppShell>
    );
  }

  const setAnswer = (questionId: number, v: AnswerValue) =>
    setAnswers((a) => ({ ...a, [questionId]: v }));

  const submit = async () => {
    const reachableQuestionIds =
      sections.length > 0
        ? reachableQuestionIdsFor(sections, questions, answers)
        : new Set(questions.map((question) => question.id));
    const missing = new Set<number>();
    questions.forEach((q, i) => {
      if (reachableQuestionIds.has(q.id) && q.required && isEmpty(answers[q.id])) missing.add(i);
    });
    if (missing.size) {
      setErrorIdx(missing);
      push('필수 질문에 답해 주세요.', 'warning');
      return;
    }
    setErrorIdx(new Set());
    try {
      const res = await complete.mutateAsync({
        surveyId,
        answers: questions
          .filter((q) => reachableQuestionIds.has(q.id))
          .map((q) => ({
            questionId: q.id,
            value: answers[q.id] ?? (q.type === 'multi' ? [] : ''),
          })),
      });
      navigate(`/surveys/${surveyId}/done`, { replace: true, state: { reward: res.reward } });
    } catch (e) {
      if (e instanceof ApiError) push(e.message, 'warning');
    }
  };

  const currentSection = currentSectionId
    ? sections.find((section) => section.id === currentSectionId) ?? sections[0]
    : sections[0];
  const currentQuestions = currentSection
    ? questions.filter((question) => question.sectionId === currentSection.id)
    : [];
  const nextSectionId = currentSection
    ? resolveNextSectionId(currentSection.id, sections, questions, answers)
    : null;

  const validateCurrentSection = () => {
    const missing = new Set<number>();
    currentQuestions.forEach((q) => {
      const i = questions.findIndex((x) => x.id === q.id);
      if (q.required && isEmpty(answers[q.id])) missing.add(i);
    });
    if (missing.size) {
      setErrorIdx(missing);
      push('필수 질문에 답해 주세요.', 'warning');
      return false;
    }
    setErrorIdx(new Set());
    return true;
  };

  const goNext = () => {
    if (!validateCurrentSection()) return;
    if (!nextSectionId) {
      void submit();
      return;
    }
    if (currentSection) {
      setSectionHistory((history) => [...history, currentSection.id]);
    }
    setCurrentSectionId(nextSectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setSectionHistory((history) => {
      const next = [...history];
      const previous = next.pop();
      if (previous) setCurrentSectionId(previous);
      return next;
    });
    setErrorIdx(new Set());
  };

  const answeredCount = questions.filter((q) => !isEmpty(answers[q.id])).length;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <AppShell back title="설문 응답" hideNav>
      {/* 헤더 바로 아래 붙는 진행률 바 — 스크롤해도 유지 */}
      <div className={styles.progressTrack} aria-hidden>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.formHead}>
        <h1 className={styles.title}>{survey.title}</h1>
        {survey.description && <p className={styles.desc}>{survey.description}</p>}
        <div className={styles.metaRow}>
          <span className={styles.metaText}>
            약 {survey.estMinutes}분 · 제출하면 <b>+{survey.costPerResponse} 크레딧</b>
          </span>
          <span className={styles.reqNote}>* 필수 질문</span>
        </div>
      </div>

      {sections.length > 0 && currentSection ? (
        <div className={styles.sectionList}>
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionStep}>
                섹션 {sections.findIndex((section) => section.id === currentSection.id) + 1} / {sections.length}
              </p>
              <h2 className={styles.sectionTitle}>{currentSection.title}</h2>
              {currentSection.description && <p className={styles.sectionDesc}>{currentSection.description}</p>}
            </div>
            {currentQuestions.map((q) => {
              const i = questions.findIndex((x) => x.id === q.id);
              return (
                <QuestionView
                  key={q.id}
                  question={q}
                  index={i}
                  value={answers[q.id] ?? (q.type === 'multi' ? [] : '')}
                  onChange={(v) => setAnswer(q.id, v)}
                  error={errorIdx.has(i)}
                />
              );
            })}
          </section>
        </div>
      ) : (
        <div className={styles.list}>
          {questions.map((q, i) => (
            <QuestionView
              key={q.id}
              question={q}
              index={i}
              value={answers[q.id] ?? (q.type === 'multi' ? [] : '')}
              onChange={(v) => setAnswer(q.id, v)}
              error={errorIdx.has(i)}
            />
          ))}
        </div>
      )}

      <div className={styles.submit}>
        <p className={styles.progressText}>
          <b className="num">{answeredCount}</b>/{questions.length} 답변함
        </p>
        {sections.length > 0 ? (
          <div className={styles.navRow}>
            <Button variant="secondary" size="lg" disabled={sectionHistory.length === 0} onClick={goBack}>
              이전
            </Button>
            <Button size="lg" full loading={complete.isPending} onClick={goNext}>
              {nextSectionId ? '다음' : '제출하고 크레딧 받기'}
            </Button>
          </div>
        ) : (
          <Button size="lg" full loading={complete.isPending} onClick={submit}>
            제출하고 크레딧 받기
          </Button>
        )}
        {!nextSectionId && <p className={styles.hint}>제출하면 +{survey.costPerResponse} 크레딧이 적립돼요.</p>}
      </div>
    </AppShell>
  );
}

function resolveNextSectionId(
  currentSectionId: number,
  sections: SurveySection[],
  questions: SurveyQuestion[],
  answers: Record<number, AnswerValue>,
) {
  const currentQuestions = questions
    .filter((question) => question.sectionId === currentSectionId)
    .sort((a, b) => a.position - b.position);
  for (const question of currentQuestions) {
    if (question.type !== 'single' && question.type !== 'dropdown') continue;
    const answer = answers[question.id];
    if (typeof answer !== 'string' || !answer) continue;
    const target = question.branchRules?.[answer];
    if (target && sections.some((section) => section.id === target)) return target;
  }
  const currentIndex = sections.findIndex((section) => section.id === currentSectionId);
  return currentIndex >= 0 && currentIndex + 1 < sections.length ? sections[currentIndex + 1].id : null;
}

function reachableQuestionIdsFor(
  sections: SurveySection[],
  questions: SurveyQuestion[],
  answers: Record<number, AnswerValue>,
) {
  if (sections.length === 0) return new Set(questions.map((question) => question.id));

  const reachable = new Set<number>();
  let currentSectionId: number | null = sections[0]?.id ?? null;
  const visited = new Set<number>();
  let guard = 0;
  while (currentSectionId && guard++ < sections.length) {
    if (visited.has(currentSectionId)) break;
    visited.add(currentSectionId);
    questions
      .filter((question) => question.sectionId === currentSectionId)
      .forEach((question) => reachable.add(question.id));
    currentSectionId = resolveNextSectionId(currentSectionId, sections, questions, answers);
  }
  questions
    .filter((question) => question.sectionId === null)
    .forEach((question) => reachable.add(question.id));
  return reachable;
}

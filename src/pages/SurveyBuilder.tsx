import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  IconBack,
  IconClose,
  IconCopy,
  IconChevronRight,
} from '@/components/icons';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { QuestionView } from '@/components/QuestionView';
import {
  coerceForType,
  estimateMinutes,
  newDraft,
  newSection,
  needsOptions,
  toQuestionInput,
  validateQuestions,
  type DraftQuestion,
  type DraftSection,
} from '@/lib/questions';
import { QUESTION_TYPE_LABEL, type QuestionType, CATEGORIES } from '@/types/domain';
import { api } from '@/api/api';
import { ApiError } from '@/api/errors';
import {
  useInvalidateAll,
  useSurvey,
  useSurveyQuestions,
  useSurveySections,
  useTeams,
} from '@/api/queries';
import { useToast } from '@/store/ui';
import { confirmDialog } from '@/store/confirm';
import type { GeneratedSurvey, SurveyQuestion, SurveySection, Team } from '@/types/domain';
import styles from './SurveyBuilder.module.css';

const serialize = (
  title: string,
  description: string,
  sections: DraftSection[],
  qs: DraftQuestion[],
) =>
  JSON.stringify({
    title,
    description,
    sections: sections.map(({ uid: _uid, ...rest }) => rest),
    q: qs.map(({ uid: _uid, ...rest }) => rest),
  });

const TYPE_ORDER: QuestionType[] = [
  'short',
  'paragraph',
  'single',
  'multi',
  'dropdown',
  'scale',
  'date',
];

function hydrateDraft(
  serverSections: SurveySection[],
  serverQuestions: SurveyQuestion[],
): { sections: DraftSection[]; questions: DraftQuestion[] } {
  const sectionUidById = new Map<number, string>();
  const sections =
    serverSections.length > 0
      ? serverSections.map((section) => {
          const uid = `section_${section.id}`;
          sectionUidById.set(section.id, uid);
          return {
            uid,
            title: section.title,
            description: section.description ?? '',
          };
        })
      : [newSection()];
  const fallbackSectionUid = sections[0]?.uid ?? '';

  const questions = serverQuestions.map((question) => {
    const branchRules: Record<number, string> = {};
    Object.entries(question.branchRules ?? {}).forEach(([option, targetSectionId]) => {
      const optionIndex = question.options.findIndex((candidate) => candidate === option);
      const targetUid = sectionUidById.get(Number(targetSectionId));
      if (optionIndex >= 0 && targetUid) {
        branchRules[optionIndex] = targetUid;
      }
    });

    return {
      uid: `question_${question.id}`,
      sectionUid: question.sectionId
        ? sectionUidById.get(question.sectionId) ?? fallbackSectionUid
        : fallbackSectionUid,
      type: question.type,
      title: question.title,
      description: question.description,
      required: question.required,
      options: [...question.options],
      branchRules,
      scaleMax: question.scaleMax,
      scaleMinLabel: question.scaleMinLabel,
      scaleMaxLabel: question.scaleMaxLabel,
    };
  });

  if (questions.length > 0) {
    return { sections, questions };
  }
  return { sections, questions: [newDraft('single', fallbackSectionUid)] };
}

function hydrateAiDraft(survey: GeneratedSurvey): {
  title: string;
  description: string;
  sections: DraftSection[];
  questions: DraftQuestion[];
  category: string;
  estimatedMinutes: number;
  validationNotice: string;
} {
  const sections =
    survey.sections.length > 0
      ? survey.sections.map((section, index) =>
          newSection(section.title.trim() || `섹션 ${index + 1}`),
        )
      : [newSection()];
  survey.sections.forEach((section, index) => {
    if (sections[index]) sections[index].description = section.description?.trim() ?? '';
  });

  const questions = survey.questions.map((question) => {
    const section = sections[question.sectionIndex] ?? sections[0];
    return {
      uid: newDraft().uid,
      sectionUid: section.uid,
      type: question.type,
      title: question.text,
      description: question.description?.trim() || null,
      required: question.required,
      options: [...(question.options ?? [])],
      branchRules: {},
      scaleMax: question.scaleMax || 5,
      scaleMinLabel: question.scaleMinLabel?.trim() || null,
      scaleMaxLabel: question.scaleMaxLabel?.trim() || null,
    };
  });

  return {
    title: survey.title,
    description: survey.description,
    sections,
    questions: questions.length > 0 ? questions : [newDraft('single', sections[0].uid)],
    category: survey.category,
    estimatedMinutes: survey.estimatedMinutes,
    validationNotice: survey.validationNotice,
  };
}

// 자체 설문 빌더 — 구글폼 레퍼런스 UX.
export function SurveyBuilder() {
  const { id } = useParams();
  const editId = Number(id ?? 0);
  const editMode = editId > 0;
  const location = useLocation();
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const push = useToast((s) => s.push);
  const { data: teams } = useTeams();
  const {
    data: existingSurvey,
    isLoading: surveyLoading,
    isError: surveyError,
    refetch: refetchSurvey,
  } = useSurvey(editId);
  const {
    data: existingSections,
    isLoading: sectionsLoading,
    isError: sectionsError,
    refetch: refetchSections,
  } = useSurveySections(editId);
  const {
    data: existingQuestions,
    isLoading: questionsLoading,
    isError: questionsError,
    refetch: refetchQuestions,
  } = useSurveyQuestions(editId);
  const [aiImport] = useState(() => {
    const candidate = (location.state as { aiDraft?: GeneratedSurvey } | null)?.aiDraft;
    if (
      editMode ||
      !candidate ||
      !Array.isArray(candidate.sections) ||
      !Array.isArray(candidate.questions)
    ) {
      return null;
    }
    return hydrateAiDraft(candidate);
  });
  const initialSection = useRef(aiImport?.sections[0] ?? newSection());
  const initialQuestions = useRef(
    aiImport?.questions ?? [newDraft('single', initialSection.current.uid)],
  );

  const [title, setTitle] = useState(aiImport?.title ?? '');
  const [description, setDescription] = useState(aiImport?.description ?? '');
  const [sections, setSections] = useState<DraftSection[]>(
    aiImport?.sections ?? [initialSection.current],
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>(initialQuestions.current);
  const [activeUid, setActiveUid] = useState<string>(questions[0]?.uid ?? '');
  const [preview, setPreview] = useState(false);
  const [errorUids, setErrorUids] = useState<Set<string>>(new Set());
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const loadedEditId = useRef<number | null>(null);

  // 작성 중 이탈 방지 — 초기 스냅샷과 비교해 변경 여부 판단
  const initialSnap = useRef(
    aiImport
      ? '__unsaved_ai_import__'
      : serialize('', '', [initialSection.current], [initialQuestions.current[0]]),
  );
  const publishedRef = useRef(false);
  const dirty =
    !publishedRef.current && serialize(title, description, sections, questions) !== initialSnap.current;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!editMode || !existingSurvey || !existingSections || !existingQuestions) return;
    if (loadedEditId.current === editId) return;

    const draft = hydrateDraft(existingSections, existingQuestions);
    setTitle(existingSurvey.title);
    setDescription(existingSurvey.description ?? '');
    setSections(draft.sections);
    setQuestions(draft.questions);
    setActiveUid(draft.questions[0]?.uid ?? '');
    setPreview(false);
    setErrorUids(new Set());
    setPublishOpen(false);
    initialSnap.current = serialize(
      existingSurvey.title,
      existingSurvey.description ?? '',
      draft.sections,
      draft.questions,
    );
    publishedRef.current = false;
    loadedEditId.current = editId;
  }, [editMode, editId, existingSurvey, existingSections, existingQuestions]);

  const tryExit = async () => {
    if (
      dirty &&
      !(await confirmDialog({
        title: '작성 중인 설문을 나갈까요?',
        body: '저장하지 않은 내용은 사라져요.',
        confirmLabel: '나가기',
        cancelLabel: '계속 작성',
        tone: 'danger',
      }))
    )
      return;
    navigate(-1);
  };

  const requestRemove = async (uid: string) => {
    const q = questions.find((x) => x.uid === uid);
    if (
      q?.title.trim() &&
      !(await confirmDialog({
        title: '이 질문을 삭제할까요?',
        body: '입력한 내용이 사라져요.',
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    )
      return;
    remove(uid);
  };

  const patch = (uid: string, p: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.uid === uid ? { ...q, ...p } : q)));

  const patchSection = (uid: string, p: Partial<DraftSection>) =>
    setSections((ss) => ss.map((s) => (s.uid === uid ? { ...s, ...p } : s)));

  const addQuestionToSection = (sectionUid: string) => {
    const q = newDraft('single', sectionUid);
    setQuestions((qs) => {
      const lastInSection = qs.map((x, i) => ({ x, i })).filter(({ x }) => x.sectionUid === sectionUid).at(-1);
      const next = [...qs];
      next.splice(lastInSection ? lastInSection.i + 1 : qs.length, 0, q);
      return next;
    });
    setActiveUid(q.uid);
  };

  const addSection = () => {
    const section = newSection(`섹션 ${sections.length + 1}`);
    const q = newDraft('single', section.uid);
    setSections((ss) => [...ss, section]);
    setQuestions((qs) => [...qs, q]);
    setActiveUid(q.uid);
  };

  const requestRemoveSection = async (sectionUid: string) => {
    if (sections.length <= 1) return;
    const section = sections.find((s) => s.uid === sectionUid);
    const count = questions.filter((q) => q.sectionUid === sectionUid).length;
    if (
      !(await confirmDialog({
        title: '이 섹션을 삭제할까요?',
        body: `${section?.title || '섹션'}에 있는 질문 ${count}개도 함께 삭제돼요.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return;
    }
    const nextSections = sections.filter((s) => s.uid !== sectionUid);
    setSections(nextSections);
    setQuestions((qs) => {
      const next = qs.filter((q) => q.sectionUid !== sectionUid);
      const cleaned = next.map((q) => ({
        ...q,
        branchRules: Object.fromEntries(
          Object.entries(q.branchRules).filter(([, targetUid]) => targetUid !== sectionUid),
        ),
      }));
      if (cleaned.length) return cleaned;
      return [newDraft('single', nextSections[0]?.uid ?? '')];
    });
    setActiveUid((uid) => {
      const next = questions.find((q) => q.sectionUid !== sectionUid && q.uid !== uid);
      return next?.uid ?? '';
    });
  };

  const duplicate = (uid: string) =>
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q.uid === uid);
      if (idx < 0) return qs;
      const copy = {
        ...qs[idx],
        uid: newDraft().uid,
        options: [...qs[idx].options],
        branchRules: { ...qs[idx].branchRules },
      };
      const next = [...qs];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const remove = (uid: string) =>
    setQuestions((qs) => (qs.length <= 1 ? qs : qs.filter((q) => q.uid !== uid)));

  const move = (uid: string, dir: -1 | 1) =>
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q.uid === uid);
      if (idx < 0) return qs;
      const sectionUid = qs[idx].sectionUid;
      const sameSection = qs
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => q.sectionUid === sectionUid);
      const localIdx = sameSection.findIndex(({ q }) => q.uid === uid);
      const target = sameSection[localIdx + dir];
      if (!target) return qs;
      const next = [...qs];
      [next[idx], next[target.i]] = [next[target.i], next[idx]];
      return next;
    });

  const reorderTo = (targetUid: string) =>
    setQuestions((qs) => {
      if (!dragUid || dragUid === targetUid) return qs;
      const from = qs.findIndex((q) => q.uid === dragUid);
      const to = qs.findIndex((q) => q.uid === targetUid);
      if (from < 0 || to < 0) return qs;
      if (qs[from].sectionUid !== qs[to].sectionUid) return qs;
      const next = [...qs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const openPublish = () => {
    const errs = validateQuestions(questions);
    if (!title.trim()) {
      push('설문 제목을 입력해 주세요.', 'warning');
      return;
    }
    if (errs.length) {
      setErrorUids(new Set(errs.map((e) => e.uid)));
      push(errs[0].message, 'warning');
      setPreview(false);
      return;
    }
    setErrorUids(new Set());
    setPublishOpen(true);
  };

  const isEditError = editMode && (surveyError || sectionsError || questionsError);
  const isEditDataReady = !!existingSurvey && !!existingSections && !!existingQuestions;
  const isEditLoading =
    editMode &&
    !isEditError &&
    (surveyLoading || sectionsLoading || questionsLoading || !isEditDataReady || loadedEditId.current !== editId);
  const isLocked = editMode && !!existingSurvey && existingSurvey.collectedCount > 0;
  const headerTitle = editMode ? '설문 수정' : '설문 만들기';
  const actionLabel = editMode ? '수정 저장' : '발행하기';

  if (isEditLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.accent} />
        <header className={styles.header}>
          <button className={styles.icon} onClick={() => navigate(-1)} aria-label="뒤로">
            <IconBack />
          </button>
          <span className={styles.headerTitle}>설문 수정</span>
        </header>
        <div className={styles.body}>
          <div className={`${styles.cardBase} ${styles.stateCard}`}>설문을 불러오는 중이에요.</div>
        </div>
      </div>
    );
  }

  if (isEditError) {
    return (
      <div className={styles.page}>
        <div className={styles.accent} />
        <header className={styles.header}>
          <button className={styles.icon} onClick={() => navigate(-1)} aria-label="뒤로">
            <IconBack />
          </button>
          <span className={styles.headerTitle}>설문 수정</span>
        </header>
        <div className={styles.body}>
          <div className={`${styles.cardBase} ${styles.stateCard}`}>
            <strong>설문을 불러오지 못했어요.</strong>
            <Button
              variant="secondary"
              onClick={() => {
                refetchSurvey();
                refetchSections();
                refetchQuestions();
              }}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className={styles.page}>
        <div className={styles.accent} />
        <header className={styles.header}>
          <button className={styles.icon} onClick={() => navigate(-1)} aria-label="뒤로">
            <IconBack />
          </button>
          <span className={styles.headerTitle}>설문 수정</span>
        </header>
        <div className={styles.body}>
          <div className={`${styles.cardBase} ${styles.stateCard}`}>
            <strong>이미 응답이 있어 편집할 수 없어요.</strong>
            <p>질문이나 섹션을 바꾸면 저장된 답변과 결과가 어긋나서, 응답이 없는 설문만 수정할 수 있어요.</p>
            <div className={styles.stateActions}>
              <Button onClick={() => navigate(`/surveys/${editId}/results`)}>결과 보기</Button>
              <Button variant="secondary" onClick={() => navigate(`/surveys/${editId}`)}>
                상세로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.accent} />
      <header className={styles.header}>
        <button className={styles.icon} onClick={tryExit} aria-label="뒤로">
          <IconBack />
        </button>
        <span className={styles.headerTitle}>{headerTitle}</span>
        <button
          className={styles.previewBtn}
          onClick={() => setPreview((p) => !p)}
          aria-pressed={preview}
        >
          {preview ? '편집' : '미리보기'}
        </button>
      </header>

      <div className={styles.body}>
        {aiImport && !preview && (
          <div className={styles.aiImportNotice}>
            <strong>AI 초안을 편집기로 가져왔어요.</strong>
            <p>{aiImport.validationNotice}</p>
          </div>
        )}

        {/* 폼 헤더 */}
        <div className={`${styles.formHead} ${styles.cardBase}`}>
          {preview ? (
            <>
              <h1 className={styles.previewTitle}>{title || '제목 없는 설문'}</h1>
              {description && <p className={styles.previewDesc}>{description}</p>}
            </>
          ) : (
            <>
              <input
                className={styles.titleInput}
                placeholder="설문 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className={styles.descInput}
                placeholder="설문 설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </>
          )}
        </div>

        {/* 문항 */}
        {preview ? (
          <div className={styles.previewList}>
            {sections.map((section) => (
              <SectionPreview key={section.uid} section={section}>
                {questions
                  .filter((q) => q.sectionUid === section.uid)
                  .map((q) => (
                    <QuestionView
                      key={q.uid}
                      question={q}
                      index={questions.findIndex((x) => x.uid === q.uid)}
                      value={q.type === 'multi' ? [] : ''}
                      onChange={() => {}}
                      disabled
                    />
                  ))}
              </SectionPreview>
            ))}
          </div>
        ) : (
          <div className={styles.sectionList}>
            {sections.map((section, sectionIndex) => {
              const sectionQuestions = questions.filter((q) => q.sectionUid === section.uid);
              return (
                <section key={section.uid} className={styles.sectionBlock}>
                  <SectionEditor
                    section={section}
                    index={sectionIndex}
                    removable={sections.length > 1}
                    onPatch={(p) => patchSection(section.uid, p)}
                    onRemove={() => requestRemoveSection(section.uid)}
                  />
                  <ul className={styles.list}>
                    {sectionQuestions.map((q) => (
                      <li
                        key={q.uid}
                        onDragOver={(e) => {
                          if (dragUid) e.preventDefault();
                        }}
                        onDrop={() => {
                          reorderTo(q.uid);
                          setDragUid(null);
                        }}
                      >
                        <QuestionEditor
                          q={q}
                          sections={sections}
                          active={activeUid === q.uid}
                          invalid={errorUids.has(q.uid)}
                          onActivate={() => setActiveUid(q.uid)}
                          onPatch={(p) => patch(q.uid, p)}
                          onDuplicate={() => duplicate(q.uid)}
                          onRemove={() => requestRemove(q.uid)}
                          onMoveUp={() => move(q.uid, -1)}
                          onMoveDown={() => move(q.uid, 1)}
                          onDragStart={() => setDragUid(q.uid)}
                          onDragEnd={() => setDragUid(null)}
                          removable={questions.length > 1}
                        />
                      </li>
                    ))}
                  </ul>
                  <button className={styles.addQuestionBtn} onClick={() => addQuestionToSection(section.uid)}>
                    + 이 섹션에 질문 추가
                  </button>
                </section>
              );
            })}
          </div>
        )}

        {!preview && (
          <button className={styles.addBtn} onClick={addSection}>
            + 섹션 추가
          </button>
        )}
      </div>

      <div className={styles.footer}>
        <Button size="lg" full onClick={openPublish}>
          {actionLabel}
        </Button>
      </div>

      {publishOpen && (
        <PublishSheet
          mode={editMode ? 'edit' : 'create'}
          questionCount={questions.length}
          teams={teams ?? []}
          initialMeta={
            editMode && existingSurvey
              ? {
                  category: existingSurvey.category ?? CATEGORIES[0],
                  targetCount: existingSurvey.targetCount,
                  estMinutes: existingSurvey.estMinutes,
                }
              : aiImport
                ? {
                    category: aiImport.category,
                    targetCount: 50,
                    estMinutes: aiImport.estimatedMinutes,
                  }
                : undefined
          }
          onClose={() => setPublishOpen(false)}
          onPublish={async (meta) => {
            try {
              const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                category: meta.category,
                estMinutes: meta.estMinutes,
                targetCount: meta.targetCount,
                sections: sections.map((section, i) => ({
                  clientId: section.uid,
                  title: section.title.trim() || `섹션 ${i + 1}`,
                  description: section.description.trim() || null,
                })),
                questions: questions.map(toQuestionInput),
              };
              const survey = editMode
                ? await api.updateSurvey(editId, payload)
                : await api.createSurvey({
                    ...payload,
                    externalUrl: null,
                    selfBuilt: true,
                    proofRequired: false,
                    teamId: meta.teamId,
                  });
              publishedRef.current = true; // 이탈 경고 해제
              invalidate();
              push(editMode ? '설문 수정을 저장했어요.' : '설문을 발행했어요. 피드에 노출됩니다.', 'positive');
              navigate(`/surveys/${survey.id}`, { replace: true });
            } catch (e) {
              if (e instanceof ApiError) push(e.message, 'warning');
            }
          }}
        />
      )}
    </div>
  );
}

function SectionEditor({
  section,
  index,
  removable,
  onPatch,
  onRemove,
}: {
  section: DraftSection;
  index: number;
  removable: boolean;
  onPatch: (p: Partial<DraftSection>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`${styles.cardBase} ${styles.sectionEditor}`}>
      <div className={styles.sectionBadge}>섹션 {index + 1}</div>
      <input
        className={styles.sectionTitleInput}
        placeholder={`섹션 ${index + 1}`}
        value={section.title}
        onChange={(e) => onPatch({ title: e.target.value })}
      />
      <input
        className={styles.sectionDescInput}
        placeholder="섹션 설명 (선택)"
        value={section.description}
        onChange={(e) => onPatch({ description: e.target.value })}
      />
      {removable && (
        <button className={styles.sectionRemove} onClick={onRemove} aria-label="섹션 삭제">
          <IconClose size={18} />
        </button>
      )}
    </div>
  );
}

function SectionPreview({
  section,
  children,
}: {
  section: DraftSection;
  children: ReactNode;
}) {
  return (
    <section className={styles.previewSection}>
      <div className={`${styles.cardBase} ${styles.previewSectionHead}`}>
        <h2 className={styles.previewSectionTitle}>{section.title || '제목 없는 섹션'}</h2>
        {section.description && <p className={styles.previewDesc}>{section.description}</p>}
      </div>
      {children}
    </section>
  );
}

// ─────────────────── 문항 에디터 카드 ───────────────────
function QuestionEditor({
  q,
  sections,
  active,
  invalid,
  removable,
  onActivate,
  onPatch,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
}: {
  q: DraftQuestion;
  sections: DraftSection[];
  active: boolean;
  invalid: boolean;
  removable: boolean;
  onActivate: () => void;
  onPatch: (p: Partial<DraftQuestion>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const currentSectionIndex = sections.findIndex((section) => section.uid === q.sectionUid);
  const branchable = q.type === 'single' || q.type === 'dropdown';
  const targetSections =
    currentSectionIndex < 0 ? [] : sections.slice(currentSectionIndex + 1);
  const setOption = (i: number, val: string) => {
    const options = [...q.options];
    options[i] = val;
    onPatch({ options });
  };
  const addOption = () => onPatch({ options: [...q.options, `옵션 ${q.options.length + 1}`] });
  const removeOption = (i: number) => {
    const branchRules = Object.fromEntries(
      Object.entries(q.branchRules)
        .map(([key, value]) => [Number(key), value] as const)
        .filter(([key]) => key !== i)
        .map(([key, value]) => [key > i ? key - 1 : key, value]),
    );
    onPatch({ options: q.options.filter((_, idx) => idx !== i), branchRules });
  };
  const setBranchTarget = (i: number, targetUid: string) => {
    const branchRules = { ...q.branchRules };
    if (targetUid) branchRules[i] = targetUid;
    else delete branchRules[i];
    onPatch({ branchRules });
  };

  return (
    <div
      className={`${styles.cardBase} ${styles.qCard} ${active ? styles.qActive : ''} ${
        invalid ? styles.qInvalid : ''
      }`}
      onClick={onActivate}
    >
      <div
        className={styles.handle}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        aria-hidden
      >
        ⠿
      </div>

      <div className={styles.qTop}>
        <input
          className={styles.qTitle}
          placeholder="질문"
          value={q.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
        <select
          className={styles.typeSelect}
          value={q.type}
          onChange={(e) => onPatch(coerceForType(q, e.target.value as QuestionType))}
          aria-label="질문 유형"
        >
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {/* 유형별 바디 */}
      <div className={styles.qBody}>
        {q.type === 'short' && <p className={styles.ghost}>단답형 텍스트</p>}
        {q.type === 'paragraph' && <p className={styles.ghost}>장문형 텍스트</p>}
        {q.type === 'date' && <p className={styles.ghost}>날짜 (월/일/년)</p>}

        {needsOptions(q.type) &&
          q.options.map((opt, i) => (
            <div key={i} className={styles.optGroup}>
              <div className={styles.optRow}>
                <span className={styles.optMark} data-type={q.type} aria-hidden>
                  {q.type === 'dropdown' ? `${i + 1}` : ''}
                </span>
                <input
                  className={styles.optInput}
                  value={opt}
                  placeholder={`옵션 ${i + 1}`}
                  onChange={(e) => setOption(i, e.target.value)}
                />
                {q.options.length > 1 && (
                  <button
                    className={styles.optRemove}
                    onClick={() => removeOption(i)}
                    aria-label="옵션 삭제"
                  >
                    <IconClose size={16} />
                  </button>
                )}
              </div>
              {branchable && targetSections.length > 0 && (
                <label className={styles.branchRow}>
                  <span>이 답변이면</span>
                  <select
                    value={q.branchRules[i] ?? ''}
                    onChange={(e) => setBranchTarget(i, e.target.value)}
                  >
                    <option value="">다음 섹션</option>
                    {targetSections.map((section, index) => (
                      <option key={section.uid} value={section.uid}>
                        섹션 {currentSectionIndex + index + 2}: {section.title || '제목 없음'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        {needsOptions(q.type) && (
          <button className={styles.addOpt} onClick={addOption}>
            <span className={styles.optMark} data-type={q.type} aria-hidden />
            옵션 추가
          </button>
        )}

        {q.type === 'scale' && (
          <div className={styles.scaleEdit}>
            <div className={styles.scaleRange}>
              <span>1</span>
              <span className={styles.scaleTo}>~</span>
              <select
                className={styles.scaleSelect}
                value={q.scaleMax}
                onChange={(e) => onPatch({ scaleMax: Number(e.target.value) })}
                aria-label="배율 최대값"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <input
              className={styles.scaleLabelInput}
              placeholder="1 라벨 (예: 매우 불만족)"
              value={q.scaleMinLabel ?? ''}
              onChange={(e) => onPatch({ scaleMinLabel: e.target.value })}
            />
            <input
              className={styles.scaleLabelInput}
              placeholder={`${q.scaleMax} 라벨 (예: 매우 만족)`}
              value={q.scaleMaxLabel ?? ''}
              onChange={(e) => onPatch({ scaleMaxLabel: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className={styles.qFooter}>
        <div className={styles.moveGroup}>
          <button className={styles.footBtn} onClick={onMoveUp} aria-label="위로 이동">
            <span className={styles.chevUp}>
              <IconChevronRight size={16} />
            </span>
          </button>
          <button className={styles.footBtn} onClick={onMoveDown} aria-label="아래로 이동">
            <span className={styles.chevDown}>
              <IconChevronRight size={16} />
            </span>
          </button>
        </div>
        <div className={styles.footRight}>
          <button className={styles.footBtn} onClick={onDuplicate} aria-label="복제">
            <IconCopy size={18} />
          </button>
          <button
            className={`${styles.footBtn} ${!removable ? styles.footDisabled : ''}`}
            onClick={onRemove}
            disabled={!removable}
            aria-label="삭제"
          >
            <TrashIcon />
          </button>
          <span className={styles.vline} />
          <label className={styles.reqToggle}>
            필수
            <button
              type="button"
              role="switch"
              aria-checked={q.required}
              className={`${styles.switch} ${q.required ? styles.switchOn : ''}`}
              onClick={() => onPatch({ required: !q.required })}
            >
              <span className={styles.knob} />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
    </svg>
  );
}

// ─────────────────── 발행 설정 시트 ───────────────────
function PublishSheet({
  mode = 'create',
  questionCount,
  teams,
  initialMeta,
  onClose,
  onPublish,
}: {
  mode?: 'create' | 'edit';
  questionCount: number;
  teams: Team[];
  initialMeta?: { category: string; targetCount: number; estMinutes: number };
  onClose: () => void;
  onPublish: (meta: { category: string; targetCount: number; estMinutes: number; teamId: number | null }) => void;
}) {
  const [category, setCategory] = useState<string>(initialMeta?.category ?? CATEGORIES[0]);
  const [targetCount, setTargetCount] = useState(initialMeta?.targetCount ?? 50);
  const [estMinutes, setEstMinutes] = useState(initialMeta?.estMinutes ?? estimateMinutes(questionCount));
  const [ownerScope, setOwnerScope] = useState('personal');
  const [busy, setBusy] = useState(false);
  const selectedTeam = mode === 'create' ? teams.find((team) => String(team.id) === ownerScope) : undefined;
  const title = mode === 'edit' ? '수정 설정' : '발행 설정';

  return (
    <Sheet label={title} onClose={onClose}>
      <h2 className="h2">{title}</h2>
      <p className="sm muted">피드 노출과 크레딧 산정에 쓰여요.</p>

      {mode === 'create' && (
        <>
          <label className={styles.sheetField}>
            <span>발행 주체</span>
            <select value={ownerScope} onChange={(e) => setOwnerScope(e.target.value)}>
              <option value="personal">개인 크레딧</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} · {team.responseCredit}개
                </option>
              ))}
            </select>
          </label>
          {selectedTeam && (
            <p className={styles.sheetNote}>
              응답 보상은 {selectedTeam.name} 팀 크레딧에서 차감돼요.
            </p>
          )}
        </>
      )}

      <label className={styles.sheetField}>
        <span>카테고리</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.sheetRow}>
        <label className={styles.sheetField}>
          <span>목표 응답 수</span>
          <input
            type="number"
            min={1}
            value={targetCount}
            onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <label className={styles.sheetField}>
          <span>예상 소요 (분)</span>
          <input
            type="number"
            min={1}
            value={estMinutes}
            onChange={(e) => setEstMinutes(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </div>

      <div className={styles.sheetActions}>
        <Button variant="secondary" full onClick={onClose}>
          취소
        </Button>
        <Button
          full
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onPublish({
              category,
              targetCount,
              estMinutes,
              teamId: selectedTeam ? selectedTeam.id : null,
            });
            setBusy(false);
          }}
        >
          {mode === 'edit' ? '저장하기' : '발행하기'}
        </Button>
      </div>
    </Sheet>
  );
}

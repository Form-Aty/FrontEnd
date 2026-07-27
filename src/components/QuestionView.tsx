import type { QuestionType } from '@/types/domain';
import styles from './QuestionView.module.css';

export interface QuestionLike {
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  options: string[];
  scaleMax: number;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
}

export type AnswerValue = string | string[];

interface Props {
  question: QuestionLike;
  index: number;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  error?: boolean;
}

// 응답 화면 / 미리보기 공용 문항 렌더러.
export function QuestionView({ question: q, index, value, onChange, disabled, error }: Props) {
  const name = `q-${index}`;

  return (
    <div className={`${styles.card} ${error ? styles.error : ''}`}>
      <p className={styles.title}>
        <span className={styles.qNum}>{index + 1}</span>
        {q.title || '(질문 없음)'}
        {q.required && <span className={styles.req}>*</span>}
      </p>
      {q.description && <p className={styles.desc}>{q.description}</p>}

      <div className={styles.body}>
        {q.type === 'short' && (
          <input
            className={styles.input}
            placeholder="내 답변"
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {q.type === 'paragraph' && (
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            placeholder="내 답변"
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {q.type === 'single' &&
          q.options.map((opt, i) => (
            <label key={i} className={styles.choice}>
              <input
                type="radio"
                name={name}
                disabled={disabled}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span className={`${styles.ind} ${styles.indRadio}`} aria-hidden />
              <span className={styles.choiceText}>{opt}</span>
            </label>
          ))}

        {q.type === 'multi' &&
          q.options.map((opt, i) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt);
            return (
              <label key={i} className={styles.choice}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? arr.filter((v) => v !== opt) : [...arr, opt])
                  }
                />
                <span className={`${styles.ind} ${styles.indCheck}`} aria-hidden />
                <span className={styles.choiceText}>{opt}</span>
              </label>
            );
          })}

        {q.type === 'dropdown' && (
          <select
            className={`${styles.input} ${styles.select}`}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>
              선택
            </option>
            {q.options.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {q.type === 'scale' && (
          <div className={styles.scale}>
            <div className={styles.scaleRow}>
              {Array.from({ length: q.scaleMax }, (_, i) => {
                const n = String(i + 1);
                return (
                  <label key={n} className={styles.scaleItem}>
                    <input
                      type="radio"
                      name={name}
                      disabled={disabled}
                      checked={value === n}
                      onChange={() => onChange(n)}
                    />
                    <span className={styles.scaleBtn}>{i + 1}</span>
                  </label>
                );
              })}
            </div>
            {(q.scaleMinLabel || q.scaleMaxLabel) && (
              <div className={styles.scaleLabels}>
                <span>{q.scaleMinLabel}</span>
                <span>{q.scaleMaxLabel}</span>
              </div>
            )}
          </div>
        )}

        {q.type === 'date' && (
          <input
            type="date"
            className={`${styles.input} ${styles.date}`}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>

      {error && <p className={styles.errNote}>필수 질문이에요 — 답변해 주세요</p>}
    </div>
  );
}

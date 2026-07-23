import type { ReactNode } from 'react';
import { signed } from '@/lib/format';
import styles from './Bits.module.css';

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'teal' }) {
  return <span className={`${styles.chip} ${tone === 'teal' ? styles.chipTeal : ''}`}>{children}</span>;
}

// design_system.md §4.4 — 적립 +N(teal) / 차감 −N(중립 회색). 항상 tabular-nums.
export function CreditAmount({ value, suffix = '' }: { value: number; suffix?: string }) {
  const tone = value > 0 ? styles.positive : value < 0 ? styles.negative : '';
  return (
    <span className={`${styles.credit} num ${tone}`}>
      {signed(value)}
      {suffix}
    </span>
  );
}

// 기여도 별점 (★★★★☆) — 색에만 의존하지 않게 텍스트 라벨 동반
export function ContributionStars({ value }: { value: number }) {
  // 기여도(누적 갚은 응답)를 0~5 별로 매핑
  const stars = Math.max(0, Math.min(5, Math.round(value / 8)));
  return (
    <span className={styles.stars} aria-label={`기여도 ${stars}점 만점에 5점`}>
      {'★★★★★☆☆☆☆☆'.slice(5 - stars, 10 - stars)}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
}) {
  const map = {
    ACTIVE: { label: '진행 중', cls: styles.sActive },
    PAUSED: { label: '일시정지', cls: styles.sPaused },
    COMPLETED: { label: '수집 완료', cls: styles.sDone },
  } as const;
  const m = map[status];
  return <span className={`${styles.statusBadge} ${m.cls}`}>{m.label}</span>;
}

export function Card({
  children,
  className,
  as: As = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={`${styles.card} ${className ?? ''}`} {...rest}>
      {children}
    </As>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={styles.progress} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

// §14 빈 상태 — 따뜻한 한 줄 + 낮은 부담의 안내. 일러스트/마크 없음.
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className={styles.empty}>
      <p className="h3">{title}</p>
      {body && <p className="sm muted">{body}</p>}
    </div>
  );
}

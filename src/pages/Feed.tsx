import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { useStatusBarTheme } from '@/components/DesktopFrame';
import { SurveyCard } from '@/components/SurveyCard';
import { EmptyState } from '@/components/Bits';
import { ErrorState, SkeletonList } from '@/components/Skeleton';
import { IconBell, IconChevronRight, IconPlus, IconSparkle } from '@/components/icons';
import { useFeed, useMe, useReciprocity } from '@/api/queries';
import { useToast } from '@/store/ui';
import type { Survey } from '@/types/domain';
import styles from './Feed.module.css';

type Sort = '전체' | '최신순' | '인기순' | '짧은순';
const SORTS: Sort[] = ['전체', '최신순', '인기순', '짧은순'];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return '늦은 밤까지 열심이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '오늘도 화이팅이에요';
  return '편안한 저녁이에요';
};

// 크레딧 카운트업 — ease-out cubic, 모션 축소 설정이면 즉시 표시
function useCountUp(target: number, ms = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function Feed() {
  const navigate = useNavigate();
  const { data: surveys, isLoading, isError, refetch } = useFeed(0);
  const { data: me } = useMe();
  const { given, received } = useReciprocity();
  const push = useToast((s) => s.push);
  const [sort, setSort] = useState<Sort>('전체');
  const credit = useCountUp(me?.responseCredit ?? 0);
  useStatusBarTheme('#1c2532'); // 히어로 그라디언트 시작색과 동일

  const sorted = useMemo(() => {
    const list = [...(surveys ?? [])];
    const by: Record<Sort, (a: Survey, b: Survey) => number> = {
      전체: () => 0, // api.feed 의 가중 정렬 유지
      최신순: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      인기순: (a, b) => b.collectedCount - a.collectedCount,
      짧은순: (a, b) => a.estMinutes - b.estMinutes,
    };
    return list.sort(by[sort]);
  }, [surveys, sort]);

  return (
    <AppShell noHeader>
      {/* ── 히어로: 잉크 네이비 + 그린 글로우, 인사·크레딧·퀵액션 ── */}
      <section className={styles.hero}>
        <span className={styles.orbA} aria-hidden />
        <span className={styles.orbB} aria-hidden />

        <div className={styles.heroTop}>
          <img className={styles.heroBrand} src="/logo.png" alt="폼앗이" />
          <button
            className={styles.bell}
            aria-label="알림"
            onClick={() => push('새 알림이 없어요.', 'default')}
          >
            <IconBell />
          </button>
        </div>

        <p className={styles.greet}>
          {greeting()}, <b>{me?.nickname ?? '폼앗이'}님</b>
        </p>

        <button className={styles.creditRow} onClick={() => navigate('/credits')}>
          <span className={styles.creditLabel}>보유 크레딧</span>
          <span className={styles.creditValue}>
            <span className="num">{credit}</span>
            <span className={styles.creditUnit}>개</span>
            <IconChevronRight size={20} />
          </span>
        </button>

        <p className={styles.heroSub}>
          지금까지 응답 <b className="num">{given}</b>번 갚고, <b className="num">{received}</b>개
          받았어요
        </p>

        <div className={styles.heroActions}>
          <button className={styles.actNew} onClick={() => navigate('/surveys/new')}>
            <IconPlus size={18} />
            설문 만들기
          </button>
          <button className={styles.actAi} onClick={() => navigate('/ai')}>
            <IconSparkle size={18} />
            AI로 만들기
          </button>
        </div>
      </section>

      {/* ── 시트: 히어로 위로 살짝 겹쳐 올라오는 라운드 화이트 ── */}
      <section className={styles.sheet}>
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>응답을 기다리는 설문</h2>
          {!!surveys?.length && <span className={styles.sheetCount}>{surveys.length}</span>}
        </div>

        <div className={styles.tabs} role="tablist" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={sort === s}
              className={`${styles.tab} ${sort === s ? styles.tabOn : ''}`}
              onClick={() => setSort(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : sorted.length === 0 ? (
          <EmptyState title="아직 올라온 설문이 없어요" body="첫 설문을 올리고 응답을 받아보세요." />
        ) : (
          <div className={styles.list}>
            {sorted.map((s) => (
              <SurveyCard key={s.id} survey={s} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

import { Link } from 'react-router-dom';
import type { Survey } from '@/types/domain';
import { estLabel, relativeTime } from '@/lib/format';
import styles from './SurveyCard.module.css';

// 피드 리스트 행 — karrot 리스트 문법: 제목 / 플레인 메타 / 볼드 크레딧.
// 칩·아바타 등 장식 없이 텍스트 위계로만 구분한다 (§12.2, §12.8).
export function SurveyCard({ survey }: { survey: Survey }) {
  const owner = survey.owner;
  const remain = Math.max(0, survey.targetCount - survey.collectedCount);
  const nearEnd = remain > 0 && remain <= Math.ceil(survey.targetCount * 0.2);

  return (
    <Link to={`/surveys/${survey.id}`} className={styles.card}>
      <h3 className={styles.title}>{survey.title}</h3>
      <p className={styles.meta}>
        {owner?.university ? `${owner.university} · ` : ''}
        {owner?.nickname ?? '익명'} ·{' '}
        {nearEnd ? (
          <span className={styles.urgent}>마감 임박</span>
        ) : (
          relativeTime(survey.createdAt)
        )}
      </p>
      <p className={styles.meta}>
        {estLabel(survey.estMinutes)} · 목표 <span className="num">{survey.targetCount}</span>명
      </p>
      <p className={styles.credit}>크레딧 +{survey.costPerResponse}</p>
    </Link>
  );
}

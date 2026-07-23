import { useNavigate } from 'react-router-dom';
import { IconBack, IconChevronRight, IconCheck } from '@/components/icons';
import { Button } from '@/components/Button';
import { useMe } from '@/api/queries';
import styles from './Onboard.module.css';

// 환영 (mockup 3). 가입 시 지급된 시드 크레딧 안내. 조용한 확인 — 이모지/일러스트 없음 (§10).
export function Welcome() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const seedCredit = me?.responseCredit ?? 5;
  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/feed')} aria-label="뒤로">
        <IconBack />
      </button>

      <div className={styles.center}>
        <span className={styles.doneCheck} aria-hidden>
          <IconCheck size={32} />
        </span>
        <h1 className={styles.title}>가입이 완료되었어요</h1>
        <p className={styles.sub}>시작 크레딧 {seedCredit}개를 드렸어요.</p>

        <button className={styles.creditCard} onClick={() => navigate('/credits')}>
          <span className={styles.creditCardLabel}>내 크레딧</span>
          <span className={styles.creditCardValue}>
            <span className="num">{seedCredit}</span>
            <span className={styles.creditCardUnit}>개</span>
            <IconChevronRight size={18} />
          </span>
        </button>

        <p className={styles.welcomeHint}>응답하고 더 많은 크레딧을 모아보세요.</p>
      </div>

      <div className={styles.actions}>
        <Button size="lg" full onClick={() => navigate('/feed')}>
          둘러보기
        </Button>
      </div>
    </div>
  );
}

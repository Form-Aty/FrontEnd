import { useLocation, useNavigate } from 'react-router-dom';
import { IconCheck } from '@/components/icons';
import { Button } from '@/components/Button';
import { useMe } from '@/api/queries';
import styles from './Onboard.module.css';

// 품앗이 완료 (karrot §14) — 전용 확인 화면. 체크 아이콘 + 과거형 한 문장 + 단일 버튼.
export function ResponseDone() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { reward?: number } };
  const reward = state?.reward ?? 1;
  const { data: me } = useMe();

  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <span className={styles.doneCheck} aria-hidden>
          <IconCheck size={32} />
        </span>
        <h1 className={styles.title}>품앗이가 완료되었어요</h1>
        <p className={styles.sub}>크레딧 {reward}개를 받았어요.</p>

        <div className={styles.creditCard} style={{ cursor: 'default' }}>
          <span className={styles.creditCardLabel}>현재 보유 크레딧</span>
          <span className={styles.creditCardValue}>
            <span className="num">{me?.responseCredit ?? 0}</span>
            <span className={styles.creditCardUnit}>개</span>
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        <Button size="lg" full onClick={() => navigate('/feed')}>
          다른 설문 보러 가기
        </Button>
      </div>
    </div>
  );
}

import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useAuth } from '@/store/auth';
import styles from './Landing.module.css';

// 온보딩 (mockup 1). service.md §1 / design_system.md §0 호혜 컨셉.
export function Landing() {
  const navigate = useNavigate();
  const authed = useAuth((s) => s.authed);
  // 이미 로그인 상태면 바로 앱으로 (데스크톱에선 좌측 랜딩 카피가 별도로 노출됨)
  if (authed) return <Navigate to="/feed" replace />;
  return (
    <div className={styles.page}>
      <img className={styles.brand} src="/logo.png" alt="폼앗이" />

      <div className={styles.body}>
        <h1 className={styles.title}>
          설문을 주고받는
          <br />
          대학생 품앗이
        </h1>
        <p className={styles.lead}>
          설문은 설문으로,
          <br />
          돈 없이 서로 도와요.
        </p>
        <img className={styles.illust} src="/landing.png" alt="설문을 주고받는 두 학생" />
      </div>

      <div className={styles.actions}>
        <Button size="lg" full onClick={() => navigate('/verify')}>
          시작하기
        </Button>
        <Button size="lg" full variant="secondary" onClick={() => navigate('/login')}>
          로그인
        </Button>
      </div>
    </div>
  );
}

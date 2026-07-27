import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { IconBack } from './icons';
import styles from './AppShell.module.css';

interface Props {
  title?: string;
  children: ReactNode;
  back?: boolean;
  brand?: boolean; // 좌상단 로고
  action?: ReactNode; // 헤더 우측 (벨/설정 등)
  hideNav?: boolean;
  noHeader?: boolean; // 페이지가 자체 히어로/헤더를 그릴 때 (예: 피드 홈)
}

export function AppShell({ title, children, back, brand, action, hideNav, noHeader }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className={styles.shell}>
      {!noHeader && (
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.left}>
            {back && (
              <button className={styles.iconBtn} onClick={() => navigate(-1)} aria-label="뒤로">
                <IconBack />
              </button>
            )}
            {brand ? (
              <img className={styles.brand} src="/logo.png" alt="폼앗이" />
            ) : (
              <h1 className={styles.title}>{title}</h1>
            )}
          </div>
          <div className={styles.right}>{action}</div>
        </div>
      </header>
      )}

      <main
        id="main"
        key={location.pathname}
        tabIndex={-1}
        className={`${styles.main} ${hideNav ? styles.noNav : ''}`}
      >
        {children}
      </main>

      {!hideNav && <BottomNav />}
    </div>
  );
}

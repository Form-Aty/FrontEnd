import { NavLink, useNavigate } from 'react-router-dom';
import { IconFeed, IconMySurveys, IconUser, IconPlus, IconTeam } from './icons';
import styles from './BottomNav.module.css';

const left = [
  { to: '/feed', label: '설문 피드', Icon: IconFeed },
  { to: '/teams', label: '팀 관리', Icon: IconTeam },
];
const right = [
  { to: '/my-surveys', label: '내 설문', Icon: IconMySurveys },
  { to: '/me', label: '마이페이지', Icon: IconUser },
];

// design_system.md §3.3 — 하단 탭 + 중앙 등록 FAB (mockup 구조).
export function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      {left.map((t) => (
        <Tab key={t.to} {...t} />
      ))}
      <button
        className={styles.fab}
        onClick={() => navigate('/surveys/new')}
        aria-label="설문 등록"
      >
        <IconPlus size={30} />
      </button>
      {right.map((t) => (
        <Tab key={t.to} {...t} />
      ))}
    </nav>
  );
}

function Tab({ to, label, Icon }: { to: string; label: string; Icon: typeof IconFeed }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
    >
      <Icon size={26} />
      <span className={styles.label}>{label}</span>
    </NavLink>
  );
}

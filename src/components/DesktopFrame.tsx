import type { ReactNode } from 'react';
import styles from './DesktopFrame.module.css';

// 데스크톱: 왼쪽 랜딩 카피 + 오른쪽 폰 프레임 안의 실제 앱.
// 모바일: 프레임 없이 앱이 화면을 꽉 채움(요소들은 display:contents 로 통과).
export function DesktopFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <aside className={styles.pitch} aria-hidden>
        <img className={styles.brand} src="/logo.png" alt="" />
        <h1 className={styles.headline}>
          응답은 응답으로,
          <br />
          대학생 <span className={styles.accent}>설문 품앗이</span>
        </h1>
        <p className={styles.lead}>
          서로의 응답자가 되어주는 상호성 기반 설문 교환.
          <br />
          받은 만큼 갚으면 내 설문도 응답을 모읍니다.
        </p>

        <ul className={styles.features}>
          <Feature
            title="응답은 응답으로"
            desc="받은 만큼 갚는 구조라 무임승차가 없어요."
            glyph={<GlyphSwap />}
          />
          <Feature
            title="앱 안에서 바로 응답"
            desc="자체 빌더로 만들고 제출까지 한 번에. 완료가 자동 확인돼요."
            glyph={<GlyphForm />}
          />
          <Feature
            title="AI 편향 감수"
            desc="유도질문·이중질문을 짚어주는 폼앗이만의 설문 감수."
            glyph={<GlyphSparkle />}
          />
        </ul>
      </aside>

      <div className={styles.deviceWrap}>
        <div className={styles.device}>
          <div id="app-scroll" className={styles.viewport}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, desc, glyph }: { title: string; desc: string; glyph: ReactNode }) {
  return (
    <li className={styles.feature}>
      <span className={styles.fIcon}>{glyph}</span>
      <span className={styles.fText}>
        <b>{title}</b>
        <span>{desc}</span>
      </span>
    </li>
  );
}

const svg = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const GlyphSwap = () => (
  <svg {...svg}>
    <path d="M4 9a8 8 0 0 1 13-3l3 3" />
    <path d="M20 5v4h-4" />
    <path d="M20 15a8 8 0 0 1-13 3l-3-3" />
    <path d="M4 19v-4h4" />
  </svg>
);
const GlyphForm = () => (
  <svg {...svg}>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M8 8h2M8 12h2M8 16h2M13 8h3M13 12h3M13 16h3" />
  </svg>
);
const GlyphSparkle = () => (
  <svg {...svg}>
    <path d="M12 3l1.7 4.8L18.5 9l-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.2z" />
    <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21" />
  </svg>
);

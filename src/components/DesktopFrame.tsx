import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './DesktopFrame.module.css';

// 앱의 아이폰 논리 해상도 — CSS(.viewport 430×932)와 반드시 일치해야 한다.
const LOGICAL_H = 932;

// 데스크톱: 왼쪽 랜딩 카피 + 오른쪽 폰 프레임 안의 실제 앱.
// 앱은 항상 390×844 로 레이아웃되고 프레임 크기에 맞춰 스케일된다(비율·글자 크기 균일).
// 모바일: 프레임 없이 앱이 화면을 꽉 채움(요소들은 display:contents 로 통과).
export function DesktopFrame({ children }: { children: ReactNode }) {
  const deviceRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = deviceRef.current;
    if (!el) return;
    const apply = () => {
      // display:contents(모바일)면 크기가 0 — 스케일 미적용
      if (el.clientHeight > 0) {
        el.style.setProperty('--frame-scale', String(el.clientHeight / LOGICAL_H));
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={styles.root}>
      <aside className={styles.pitch} aria-hidden>
        <img className={styles.brand} src="/logo.png" alt="" />
        <h1 className={styles.headline}>
          설문은 설문으로,
          <br />
          대학생 <span className={styles.accent}>설문 품앗이</span>
        </h1>
        <p className={styles.lead}>
          서로가 서로의 설문을 도와줘요.
          <br />
          함께 응답을 모으는 상호성 기반 설문 교환.
        </p>

        <ul className={styles.features}>
          <Feature
            title="설문은 설문으로"
            desc="비싼 설문 대행 플랫폼 대신 무료로 설문이 가능해요."
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
        <div className={styles.device} ref={deviceRef}>
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

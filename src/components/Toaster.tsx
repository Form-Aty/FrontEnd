import { useToast } from '@/store/ui';
import styles from './Toaster.module.css';

// design_system.md §5 + karrot §14 — 토스트는 톤과 무관하게 gray-900 단일 스타일.
// 아이콘 없음, 한 문장, 이모지 금지.
export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

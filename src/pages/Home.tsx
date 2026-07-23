import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/Bits';
import { ReciprocityGauge } from '@/components/ReciprocityGauge';
import { Skeleton } from '@/components/Skeleton';
import { IconPlus, IconChevronRight, IconTeam, IconSparkle } from '@/components/icons';
import { useMe, useReciprocity, useTeams } from '@/api/queries';
import styles from './Home.module.css';

// 홈 (mockup 4).
export function Home() {
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { given, received } = useReciprocity();

  return (
    <AppShell brand>
      <Card className={styles.gaugeCard}>
        <div className={styles.gaugeHead}>
          <span className="h3">내 상호성 게이지</span>
          <span className={styles.help} title="받은 응답과 갚은 응답의 균형이에요." aria-hidden>
            ?
          </span>
        </div>
        <ReciprocityGauge given={given} received={received} />
      </Card>

      <button className={styles.creditCard} onClick={() => navigate('/credits')}>
        <div>
          <p className="caption muted">보유 크레딧</p>
          {isLoading ? (
            <Skeleton height={32} width={72} style={{ marginTop: 4 }} />
          ) : (
            <p className={styles.creditValue}>
              <span className="num">{me?.responseCredit ?? 0}</span>
              <span className={styles.creditUnit}>개</span>
            </p>
          )}
        </div>
        <span className={styles.plus} aria-hidden>
          <IconPlus size={20} />
        </span>
      </button>

      <button className={styles.teamCard} onClick={() => navigate('/teams')}>
        <span className={styles.teamIcon} aria-hidden>
          <IconTeam size={22} />
        </span>
        <span className={styles.teamText}>
          <span className="h3">팀 프로젝트</span>
          <span className="sm muted">
            {teamsLoading
              ? '팀 정보를 불러오는 중'
              : teams?.length
                ? `${teams.length}개 팀 관리`
                : '팀 만들기 또는 초대코드로 가입'}
          </span>
        </span>
        <IconChevronRight size={18} />
      </button>

      <button className={styles.aiCard} onClick={() => navigate('/ai')}>
        <span className={styles.aiIcon} aria-hidden>
          <IconSparkle size={22} />
        </span>
        <span className={styles.aiText}>
          <span className="h3">AI 설문 설계</span>
          <span className="sm muted">유도질문·이중질문을 짚어드려요</span>
        </span>
        <IconChevronRight size={18} />
      </button>
    </AppShell>
  );
}

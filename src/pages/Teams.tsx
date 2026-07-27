import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { Card, EmptyState } from '@/components/Bits';
import { ErrorState, SkeletonList } from '@/components/Skeleton';
import { IconChevronRight, IconPlus, IconTeam } from '@/components/icons';
import { api } from '@/api/api';
import { useInvalidateAll, useTeams } from '@/api/queries';
import { ApiError } from '@/api/errors';
import { useToast } from '@/store/ui';
import type { Team } from '@/types/domain';
import styles from './Teams.module.css';

export function Teams() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const inviteParam = params.get('invite') ?? '';
  const { data: teams, isLoading, isError, refetch } = useTeams();
  const invalidate = useInvalidateAll();
  const push = useToast((s) => s.push);

  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(inviteParam);
  const [mode, setMode] = useState<'create' | 'join'>(inviteParam ? 'join' : 'create');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (inviteParam) {
      setJoinCode(inviteParam);
      setMode('join');
    }
  }, [inviteParam]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      push('팀 이름을 입력해 주세요.', 'warning');
      return;
    }
    setCreating(true);
    try {
      const created = await api.createTeam({
        name: name.trim(),
      });
      invalidate();
      push('팀을 만들었어요.', 'positive');
      navigate(`/teams/${created.team.id}`);
    } catch (err) {
      if (err instanceof ApiError) push(err.message, 'warning');
    } finally {
      setCreating(false);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      push('초대코드를 입력해 주세요.', 'warning');
      return;
    }
    setJoining(true);
    try {
      const joined = await api.joinTeam(joinCode.trim());
      invalidate();
      setParams({});
      push('팀에 가입했어요.', 'positive');
      navigate(`/teams/${joined.team.id}`);
    } catch (err) {
      if (err instanceof ApiError) push(err.message, 'warning');
    } finally {
      setJoining(false);
    }
  };

  return (
    <AppShell title="팀 관리">
      <Card as="section" className={styles.panel}>
        <div className={styles.modeTabs} role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'create'}
            className={`${styles.modeTab} ${mode === 'create' ? styles.modeTabOn : ''}`}
            onClick={() => setMode('create')}
          >
            팀 만들기
          </button>
          <button
            role="tab"
            aria-selected={mode === 'join'}
            className={`${styles.modeTab} ${mode === 'join' ? styles.modeTabOn : ''}`}
            onClick={() => setMode('join')}
          >
            초대 가입
          </button>
        </div>

        {mode === 'create' ? (
          <form className={styles.form} onSubmit={create}>
            <div className={styles.panelHead}>
              <IconPlus size={20} />
              <h2 className="h3">새 팀</h2>
            </div>
            <label className={styles.field}>
              <span>팀 이름</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
            <Button full loading={creating}>
              만들기
            </Button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={join}>
            <div className={styles.panelHead}>
              <IconTeam size={20} />
              <h2 className="h3">초대코드 입력</h2>
            </div>
            <label className={styles.field}>
              <span>초대코드</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <Button full variant="secondary" loading={joining}>
              가입하기
            </Button>
          </form>
        )}
      </Card>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="h3">내 팀</h2>
          <span className="caption muted">{teams?.length ?? 0}개</span>
        </div>
        {isLoading ? (
          <SkeletonList count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !teams?.length ? (
          <EmptyState title="아직 속한 팀이 없어요." />
        ) : (
          <ul className={styles.list}>
            {teams.map((team) => (
              <TeamRow key={team.id} team={team} onOpen={() => navigate(`/teams/${team.id}`)} />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function TeamRow({ team, onOpen }: { team: Team; onOpen: () => void }) {
  return (
    <li>
      <button className={styles.teamRow} onClick={onOpen}>
        <span className={styles.teamIcon} aria-hidden>
          <IconTeam size={20} />
        </span>
        <span className={styles.teamBody}>
          <span className={styles.teamName}>{team.name}</span>
          <span className={styles.teamMeta}>
            <span>{team.memberCount}명</span>
            <span>{team.role}</span>
            <span className={styles.credit}>
              <span className="num">{team.responseCredit}</span>개
            </span>
          </span>
        </span>
        <IconChevronRight size={18} />
      </button>
    </li>
  );
}

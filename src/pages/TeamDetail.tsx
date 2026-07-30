import { FormEvent, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { Card, CreditAmount, EmptyState } from '@/components/Bits';
import { ErrorState, Skeleton } from '@/components/Skeleton';
import { Sheet } from '@/components/Sheet';
import { IconCopy, IconCredit, IconPlus, IconTeam } from '@/components/icons';
import { api } from '@/api/api';
import { useInvalidateAll, useTeam, useTeamCredit, useTeamInvites } from '@/api/queries';
import { ApiError } from '@/api/errors';
import { dateLabel } from '@/lib/format';
import { useToast } from '@/store/ui';
import { confirmDialog } from '@/store/confirm';
import type { TeamCreditReason, TeamInvite, TeamMember, TeamRole } from '@/types/domain';
import styles from './TeamDetail.module.css';

const ROLE_LABEL: Record<TeamRole, string> = {
  OWNER: '소유자',
  ADMIN: '관리자',
  MEMBER: '팀원',
};

const TEAM_CREDIT_REASON: Record<TeamCreditReason, string> = {
  DEPOSIT_FROM_USER: '팀 크레딧 입금',
  SPEND_COLLECT: '팀 설문 응답 수집',
  ADJUSTMENT: '관리자 조정',
  REFUND: '환불',
};

const DEPOSIT_PRESETS = [10, 30, 50];

type TabKey = 'members' | 'ledger';
type SheetKey = 'invite' | 'deposit' | null;

export function TeamDetail() {
  const teamId = Number(useParams().id);
  const { data, isLoading, isError, refetch } = useTeam(teamId);
  const team = data?.team;
  const isAdmin = team?.role === 'OWNER' || team?.role === 'ADMIN';
  const isOwner = team?.role === 'OWNER';
  const invites = useTeamInvites(teamId, !!isAdmin);
  const credit = useTeamCredit(teamId);
  const invalidate = useInvalidateAll();
  const push = useToast((s) => s.push);

  const [tab, setTab] = useState<TabKey>('members');
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [depositAmount, setDepositAmount] = useState(10);
  const [depositing, setDepositing] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const activeInvite = useMemo(
    () => invites.data?.find((invite) => isInviteActive(invite)) ?? null,
    [invites.data],
  );

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      push(message, 'default');
    } catch {
      push('복사에 실패했어요.', 'warning');
    }
  };

  const copyInvite = (invite: TeamInvite) => {
    const url = `${window.location.origin}/teams?invite=${invite.code}`;
    copyText(url, '초대 링크를 복사했어요.');
  };

  const createInvite = async () => {
    setCreatingInvite(true);
    try {
      const invite = await api.createTeamInvite(teamId, { maxUses: 30, expiresInDays: 14 });
      invalidate();
      copyInvite(invite);
    } catch (err) {
      if (err instanceof ApiError) push(err.message, 'warning');
    } finally {
      setCreatingInvite(false);
    }
  };

  const revokeInvite = async (invite: TeamInvite) => {
    if (
      !(await confirmDialog({
        title: '초대코드를 폐기할까요?',
        body: '폐기한 코드는 다시 사용할 수 없어요.',
        confirmLabel: '폐기',
        tone: 'danger',
      }))
    ) {
      return;
    }
    try {
      await api.revokeTeamInvite(teamId, invite.id);
      invalidate();
      push('초대코드를 폐기했어요.', 'positive');
    } catch (err) {
      if (err instanceof ApiError) push(err.message, 'warning');
    }
  };

  const deposit = async (e: FormEvent) => {
    e.preventDefault();
    setDepositing(true);
    try {
      await api.depositTeamCredit(teamId, depositAmount);
      invalidate();
      push('팀 크레딧을 추가했어요.', 'positive');
      setSheet(null);
    } catch (err) {
      if (err instanceof ApiError) push(err.message, 'warning');
    } finally {
      setDepositing(false);
    }
  };

  const changeRole = async (member: TeamMember, role: Exclude<TeamRole, 'OWNER'>) => {
    try {
      await api.updateTeamMemberRole(teamId, member.userId, role);
      invalidate();
      push('역할을 변경했어요.', 'positive');
    } catch (err) {
      if (err instanceof ApiError) push(err.message, 'warning');
    }
  };

  if (isError) {
    return (
      <AppShell back title="팀 상세">
        <ErrorState onRetry={() => refetch()} message="팀 정보를 불러오지 못했어요." />
      </AppShell>
    );
  }

  if (isLoading || !data || !team) {
    return (
      <AppShell back title="팀 상세">
        <div className={styles.loading}>
          <Skeleton height={160} radius="var(--radius-lg)" />
          <Skeleton height={44} radius="var(--radius-md)" />
          <Skeleton height={220} radius="var(--radius-lg)" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell back title="팀 상세">
      <Card as="section" className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.teamIcon} aria-hidden>
            <IconTeam size={22} />
          </span>
          <div className={styles.heroBody}>
            <h1 className={styles.title}>{team.name}</h1>
          </div>
          <span className={styles.role}>{ROLE_LABEL[team.role]}</span>
        </div>

        <div className={styles.stats}>
          <Stat label="팀 크레딧" value={team.responseCredit} suffix="개" />
          <span className={styles.statDivider} aria-hidden />
          <Stat label="팀원" value={team.memberCount} suffix="명" />
        </div>

        <div className={styles.actions}>
          {isAdmin && (
            <Button variant="secondary" type="button" onClick={() => setSheet('invite')}>
              <span className={styles.btnInner}>
                <IconPlus size={16} /> 팀원 초대
              </span>
            </Button>
          )}
          <Button type="button" onClick={() => setSheet('deposit')}>
            <span className={styles.btnInner}>
              <IconCredit size={16} /> 크레딧 추가
            </span>
          </Button>
        </div>
      </Card>

      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'members'}
          className={`${styles.tab} ${tab === 'members' ? styles.tabOn : ''}`}
          onClick={() => setTab('members')}
        >
          팀원 <span className="num">{team.memberCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'ledger'}
          className={`${styles.tab} ${tab === 'ledger' ? styles.tabOn : ''}`}
          onClick={() => setTab('ledger')}
        >
          크레딧 내역
        </button>
      </div>

      {tab === 'members' ? (
        <Card as="section" className={styles.listCard}>
          <ul className={styles.members}>
            {data.members.map((member) => (
              <li key={member.userId} className={styles.member}>
                <div className={styles.avatar} aria-hidden>
                  {member.nickname[0]}
                </div>
                <div className={styles.memberBody}>
                  <p className={styles.memberName}>{member.nickname}</p>
                  <p className="caption muted">{member.email}</p>
                </div>
                {isOwner && member.role !== 'OWNER' ? (
                  <select
                    className={styles.roleSelect}
                    value={member.role}
                    onChange={(e) => changeRole(member, e.target.value as Exclude<TeamRole, 'OWNER'>)}
                    aria-label={`${member.nickname} 역할`}
                  >
                    <option value="ADMIN">관리자</option>
                    <option value="MEMBER">팀원</option>
                  </select>
                ) : (
                  <span className={styles.memberRole}>{ROLE_LABEL[member.role]}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card as="section" className={styles.listCard}>
          {credit.isLoading ? (
            <Skeleton height={120} radius="var(--radius-lg)" />
          ) : !credit.data?.ledger.length ? (
            <EmptyState title="아직 팀 거래 내역이 없어요." />
          ) : (
            <ul className={styles.ledger}>
              {credit.data.ledger.map((entry) => (
                <li key={entry.id} className={styles.ledgerRow}>
                  <div>
                    <p className="sm">{TEAM_CREDIT_REASON[entry.reason] ?? entry.reason}</p>
                    <p className="caption muted">
                      {entry.actorNickname ? `${entry.actorNickname} · ` : ''}
                      {dateLabel(entry.createdAt)}
                    </p>
                  </div>
                  <CreditAmount value={entry.delta} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {sheet === 'invite' && isAdmin && (
        <Sheet label="팀원 초대" onClose={() => setSheet(null)}>
          <h2 className="h2">팀원 초대</h2>
          <p className="sm muted">초대 링크를 공유하면 바로 팀에 가입할 수 있어요.</p>

          {activeInvite ? (
            <>
              <div className={styles.codeBox}>
                <span className={`num ${styles.codeText}`}>{activeInvite.code}</span>
                <span className="caption muted">
                  {activeInvite.usedCount}/{activeInvite.maxUses}회 사용 · {dateLabel(activeInvite.expiresAt)} 만료
                </span>
              </div>
              <div className={styles.sheetActions}>
                <Button variant="danger" type="button" onClick={() => revokeInvite(activeInvite)}>
                  폐기
                </Button>
                <Button full type="button" onClick={() => copyInvite(activeInvite)}>
                  <span className={styles.btnInner}>
                    <IconCopy size={16} /> 초대 링크 복사
                  </span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.codeBox}>
                <span className="sm muted">사용 가능한 초대코드가 없어요.</span>
              </div>
              <Button full type="button" loading={creatingInvite} onClick={createInvite}>
                코드 발급
              </Button>
            </>
          )}

          {invites.data && invites.data.length > 0 && (
            <div className={styles.inviteHistory}>
              <p className="caption muted">최근 발급 내역</p>
              <ul>
                {invites.data.slice(0, 5).map((invite) => (
                  <li key={invite.id} className={styles.inviteMini}>
                    <span className="num">{invite.code}</span>
                    <span className="caption muted">
                      {invite.usedCount}/{invite.maxUses} · {invite.revokedAt ? '폐기됨' : dateLabel(invite.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Sheet>
      )}

      {sheet === 'deposit' && (
        <Sheet label="팀 크레딧 추가" onClose={() => setSheet(null)}>
          <h2 className="h2">팀 크레딧 추가</h2>
          <p className="sm muted">내 크레딧에서 팀 크레딧으로 입금돼요.</p>
          <form className={styles.depositForm} onSubmit={deposit}>
            <div className={styles.quickAmounts}>
              {DEPOSIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.quickAmount} ${depositAmount === preset ? styles.quickAmountOn : ''}`}
                  onClick={() => setDepositAmount(preset)}
                >
                  <span className="num">{preset}</span>개
                </button>
              ))}
            </div>
            <label className={styles.sheetField}>
              <span>입금할 크레딧</span>
              <input
                type="number"
                min={1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <div className={styles.sheetActions}>
              <Button variant="secondary" full type="button" onClick={() => setSheet(null)}>
                취소
              </Button>
              <Button full loading={depositing}>
                추가하기
              </Button>
            </div>
          </form>
        </Sheet>
      )}
    </AppShell>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>
        <span className="num">{value}</span>
        {suffix}
      </span>
      <span className="caption muted">{label}</span>
    </div>
  );
}

function isInviteActive(invite: TeamInvite) {
  return !invite.revokedAt && invite.usedCount < invite.maxUses && new Date(invite.expiresAt).getTime() > Date.now();
}

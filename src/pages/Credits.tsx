import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Card, CreditAmount, EmptyState } from '@/components/Bits';
import { Skeleton } from '@/components/Skeleton';
import { useAiCredit, useResponseCredit } from '@/api/queries';
import { dateLabel } from '@/lib/format';
import type { AiCreditReason, CreditReason } from '@/types/domain';
import styles from './Credits.module.css';

const RESPONSE_REASON: Record<CreditReason, string> = {
  EARN_RESPONSE: '설문 응답 적립',
  SPEND_COLLECT: '내 설문 응답 수집',
  SEED: '가입 시드 크레딧',
  TRANSFER_TO_TEAM: '팀 크레딧 입금',
  PENALTY: '패널티 차감',
};
const AI_REASON: Record<AiCreditReason, string> = {
  PURCHASE: 'AI 크레딧 충전',
  SPEND_DESIGN: '문항 생성 사용',
  SPEND_AUDIT: '편향 감수 사용',
  BRIDGE: '품앗이 브릿지 적립',
  REFUND_AI_FAILURE: 'AI 요청 실패 환불',
};

export function Credits() {
  const [tab, setTab] = useState<'response' | 'ai'>('response');
  const resp = useResponseCredit();
  const ai = useAiCredit();

  const isResp = tab === 'response';
  const balance = isResp ? resp.data?.balance ?? 0 : ai.data?.balance ?? 0;
  const ledger = isResp ? resp.data?.ledger ?? [] : ai.data?.ledger ?? [];
  const loading = isResp ? resp.isLoading : ai.isLoading;

  return (
    <AppShell back title="크레딧 내역">
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={isResp}
          className={`${styles.tab} ${isResp ? styles.tabOn : ''}`}
          onClick={() => setTab('response')}
        >
          응답 크레딧
        </button>
        <button
          role="tab"
          aria-selected={!isResp}
          className={`${styles.tab} ${!isResp ? styles.tabOn : ''}`}
          onClick={() => setTab('ai')}
        >
          AI 크레딧
        </button>
      </div>

      <Card className={styles.balanceCard}>
        <p className="caption muted">{isResp ? '응답 크레딧 잔액' : 'AI 크레딧 잔액'}</p>
        <p className={styles.balance}>
          <span className="num">{balance}</span>
          <span className={styles.unit}>크레딧</span>
        </p>
        <p className={styles.balanceNote}>
          {isResp
            ? '남의 설문에 응답하면 쌓이고, 내 설문이 응답을 받으면 차감돼요. 현금화는 할 수 없어요.'
            : 'AI 설계·감수는 무료 베타로 운영 중이에요. 안정적인 운영을 위해 사용자별 호출 한도가 적용돼요.'}
        </p>
      </Card>

      <h2 className={`h3 ${styles.ledgerHead}`}>거래 내역</h2>
      {loading ? (
        <div className={styles.skeleton}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skRow}>
              <Skeleton height={14} width="50%" />
              <Skeleton height={14} width={32} />
            </div>
          ))}
        </div>
      ) : ledger.length === 0 ? (
        <EmptyState title="아직 거래 내역이 없어요." />
      ) : (
        <ul className={styles.ledger}>
          {ledger.map((e) => (
            <li key={e.id} className={styles.entry}>
              <div>
                <p className="sm">
                  {isResp
                    ? RESPONSE_REASON[(e as { reason: CreditReason }).reason]
                    : AI_REASON[(e as { reason: AiCreditReason }).reason]}
                </p>
                <p className="caption muted">{dateLabel(e.createdAt)}</p>
              </div>
              <CreditAmount value={e.delta} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBack } from '@/components/icons';
import { IllustShield, IconLock } from '@/components/Illust';
import { Button } from '@/components/Button';
import { ApiError } from '@/api/errors';
import type { VerificationWindow } from '@/api/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/ui';
import styles from './Onboard.module.css';

const VERIFICATION_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const parseDeadline = (value: string, fallback: number) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// 가입 + 학교 인증 (mockup 2). service.md §6 대학 이메일 인증.
// 실 백엔드 흐름: signup(email,nickname,password) → verify(email,code) → login.
export function VerifySchool() {
  const navigate = useNavigate();
  const signup = useAuth((s) => s.signup);
  const verifyEmail = useAuth((s) => s.verify);
  const resendVerification = useAuth((s) => s.resendVerification);
  const login = useAuth((s) => s.login);
  const push = useToast((s) => s.push);

  const [phase, setPhase] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fullEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fullEmail);
  const formValid = emailValid && nickname.trim().length >= 2 && password.length >= 8;
  const remainingSeconds =
    verificationExpiresAt === null
      ? 0
      : Math.max(0, Math.ceil((verificationExpiresAt - now) / 1000));
  const resendRemainingSeconds =
    resendAvailableAt === null ? 0 : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const expired = phase === 'code' && remainingSeconds === 0;
  const timerUrgent = !expired && remainingSeconds <= 60;
  const timerProgress = Math.min(100, Math.max(0, (remainingSeconds / 300) * 100));

  useEffect(() => {
    if (phase !== 'code') return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [phase, verificationExpiresAt, resendAvailableAt]);

  const applyVerificationWindow = (windowInfo: VerificationWindow) => {
    const receivedAt = Date.now();
    setNow(receivedAt);
    setVerificationExpiresAt(
      parseDeadline(windowInfo.verificationExpiresAt, receivedAt + VERIFICATION_TTL_MS),
    );
    setResendAvailableAt(
      parseDeadline(windowInfo.resendAvailableAt, receivedAt + RESEND_COOLDOWN_MS),
    );
  };

  const sendCode = async () => {
    if (!formValid) return;
    setBusy(true);
    try {
      const response = await signup({ email: fullEmail, nickname: nickname.trim(), password });
      applyVerificationWindow(response);
      setCode('');
      setPhase('code');
      push('인증 메일을 보냈어요. 코드는 5분 동안 유효해요.', 'default');
    } catch (e) {
      if (e instanceof ApiError) push(e.message, 'warning');
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!emailValid || resending) return;
    setResending(true);
    try {
      const response = await resendVerification({ email: fullEmail });
      applyVerificationWindow(response);
      setCode('');
      push('새 인증 메일을 보냈어요. 제한시간이 다시 시작됐어요.', 'default');
    } catch (e) {
      if (e instanceof ApiError) push(e.message, 'warning');
    } finally {
      setResending(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await verifyEmail({ email: fullEmail, code });
      await login({ email: fullEmail, password });
      navigate('/welcome');
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'CODE_EXPIRED') {
          const expiredAt = Date.now();
          setNow(expiredAt);
          setVerificationExpiresAt(expiredAt);
        }
        push(e.message, 'warning');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">
        <IconBack />
      </button>
      <p className={styles.headerTitle}>학교 인증</p>

      <div className={styles.center}>
        <IllustShield size={120} />
        <h1 className={styles.title}>
          학교 이메일로
          <br />
          인증해주세요
        </h1>
        <p className={styles.sub}>인증된 학교 구성원만 이용할 수 있어요.</p>

        <input
          className={styles.textInput}
          type="email"
          placeholder="학교 이메일 (you@univ.ac.kr)"
          inputMode="email"
          autoComplete="email"
          value={email}
          disabled={phase === 'code'}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="학교 이메일"
        />

        {phase === 'form' && (
          <>
            <input
              className={styles.textInput}
              placeholder="닉네임 (2자 이상)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              aria-label="닉네임"
            />
            <input
              className={styles.textInput}
              type="password"
              placeholder="비밀번호 (8자 이상)"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="비밀번호"
            />
          </>
        )}

        {phase === 'code' && (
          <>
            <div
              className={`${styles.verificationStatus} ${expired ? styles.verificationExpired : ''}`}
            >
              <p className={styles.deliveryTarget}>
                <strong>{fullEmail}</strong>로 보낸 인증코드를 입력해 주세요.
              </p>
              <div className={styles.timerRow}>
                <span>{expired ? '유효시간 만료' : '남은 시간'}</span>
                <strong
                  className={`${styles.timerValue} ${
                    expired ? styles.timerExpired : timerUrgent ? styles.timerUrgent : ''
                  }`}
                >
                  {formatDuration(remainingSeconds)}
                </strong>
              </div>
              <div
                className={styles.timerTrack}
                role="progressbar"
                aria-label="인증코드 남은 시간"
                aria-valuemin={0}
                aria-valuemax={300}
                aria-valuenow={remainingSeconds}
              >
                <span
                  className={`${styles.timerBar} ${
                    expired ? styles.timerBarExpired : timerUrgent ? styles.timerBarUrgent : ''
                  }`}
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
              <p
                className={styles.codeHint}
                id="verification-code-hint"
                aria-live="polite"
              >
                {expired
                  ? '새 인증 메일을 받으면 5분 제한시간이 다시 시작돼요.'
                  : '코드는 발송 후 5분 동안 유효해요. 메일이 없다면 스팸함도 확인해 주세요.'}
              </p>
            </div>
            <input
              className={styles.codeInput}
              placeholder={expired ? '새 인증 메일을 받아 주세요' : '인증 코드 6자리'}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              disabled={expired || busy}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-label="인증 코드"
              aria-describedby="verification-code-hint"
            />
          </>
        )}
      </div>

      <div className={styles.actions}>
        {phase === 'form' ? (
          <Button size="lg" full loading={busy} disabled={!formValid} onClick={sendCode}>
            인증 메일 보내기
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              full
              loading={busy}
              disabled={code.length !== 6 || expired}
              onClick={verify}
            >
              인증하고 시작하기
            </Button>
            <Button
              variant="secondary"
              size="sm"
              full
              loading={resending}
              disabled={busy || resending || resendRemainingSeconds > 0}
              onClick={resendCode}
            >
              {resendRemainingSeconds > 0
                ? `다시 보내기 (${formatDuration(resendRemainingSeconds)})`
                : expired
                  ? '새 인증 메일 받기'
                  : '인증 메일 다시 보내기'}
            </Button>
          </>
        )}
        <p className={styles.lockNote}>
          <IconLock size={14} /> 개인 정보는 안전하게 보호돼요.
        </p>
      </div>
    </div>
  );
}

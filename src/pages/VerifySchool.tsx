import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBack } from '@/components/icons';
import { IllustShield, IconLock } from '@/components/Illust';
import { Button } from '@/components/Button';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/ui';
import styles from './Onboard.module.css';

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

  const fullEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fullEmail);
  const formValid = emailValid && nickname.trim().length >= 2 && password.length >= 8;

  const sendCode = async () => {
    if (!formValid) return;
    setBusy(true);
    try {
      await signup({ email: fullEmail, nickname: nickname.trim(), password });
      setPhase('code');
      push('인증 메일을 보냈어요.', 'default');
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
      await resendVerification({ email: fullEmail });
      push('인증 메일을 다시 보냈어요.', 'default');
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
      if (e instanceof ApiError) push(e.message, 'warning');
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
          <input
            className={styles.codeInput}
            placeholder="인증 코드 6자리"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="인증 코드"
          />
        )}
      </div>

      <div className={styles.actions}>
        {phase === 'form' ? (
          <Button size="lg" full loading={busy} disabled={!formValid} onClick={sendCode}>
            인증 메일 보내기
          </Button>
        ) : (
          <>
            <Button size="lg" full loading={busy} disabled={code.length !== 6} onClick={verify}>
              인증하고 시작하기
            </Button>
            <Button
              variant="secondary"
              size="sm"
              full
              loading={resending}
              disabled={busy || resending}
              onClick={resendCode}
            >
              인증 메일 다시 보내기
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

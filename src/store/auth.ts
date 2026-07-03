import { create } from 'zustand';
import { api } from '@/api/api';
import { setUnauthorizedHandler, tokenStore } from '@/api/tokenStore';
import type { User } from '@/types/domain';

// 인증 스토어 — 토큰은 tokenStore(localStorage)에, 사용자/로그인여부는 여기에.
// authed 는 새로고침 시 저장된 토큰 유무로 복원된다(라우트 가드 기준).
interface AuthState {
  user: User | null;
  authed: boolean;
  signup: (input: { email: string; nickname: string; password: string }) => Promise<{ userId: number }>;
  verify: (input: { email: string; code: string }) => Promise<void>;
  resendVerification: (input: { email: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  authed: tokenStore.hasSession(),

  signup: (input) => api.signup(input),

  verify: async (input) => {
    await api.verify(input);
  },

  resendVerification: async (input) => {
    await api.resendVerification(input);
  },

  login: async (input) => {
    const res = await api.login(input);
    tokenStore.setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, authed: true });
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null, authed: false });
  },
}));

// http 계층이 리프레시까지 실패해 강제 로그아웃할 때 상태를 정리한다.
setUnauthorizedHandler(() => useAuth.setState({ user: null, authed: false }));

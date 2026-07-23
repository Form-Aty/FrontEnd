// HTTP 클라이언트 — 백엔드 ApiResponse 엔벨로프 위의 얇은 fetch 래퍼.
// - { success, data, error } 를 언래핑: 실패면 ApiError throw, 성공이면 data 반환.
// - Authorization: Bearer <accessToken> 자동 첨부.
// - 401 → refresh → 원요청 1회 재시도(단일 비행). refresh 실패 시 강제 로그아웃.
// - 타임아웃(AbortController).
import { ApiError } from './errors';
import { fireUnauthorized, tokenStore } from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const TIMEOUT_MS = 15_000;

interface RequestOptions {
  method?: string;
  body?: unknown;
  // 인증 헤더를 붙이지 않는다(로그인/회원가입/리프레시 등).
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

// 동시 다발 401 이 하나의 refresh 만 트리거하도록 공유 promise.
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const env = (await res.json()) as Envelope<{
      accessToken: string;
      refreshToken: string;
    }>;
    if (!res.ok || !env.success || !env.data) return false;
    tokenStore.setTokens(env.data.accessToken, env.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function send<T>(path: string, options: RequestOptions, retried: boolean): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    signal,
    headers: customHeaders = {},
    timeoutMs = TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();
  if (signal) signal.addEventListener('abort', abortFromParent, { once: true });

  const headers: Record<string, string> = { ...customHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const accessToken = tokenStore.getAccess();
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', abortFromParent);
    if (controller.signal.aborted) {
      throw new ApiError('TIMEOUT', '요청이 시간 초과됐어요. 잠시 후 다시 시도해 주세요.');
    }
    throw new ApiError('NETWORK', '네트워크 연결을 확인해 주세요.');
  }
  clearTimeout(timeout);
  if (signal) signal.removeEventListener('abort', abortFromParent);

  // 401/403 → refresh 후 1회 재시도.
  // 403은 SW가 auth 헤더를 유실했을 때도 발생하므로 refresh로 복구 시도.
  // 재시도에서도 실패하면 강제 로그아웃.
  if ((res.status === 401 || res.status === 403) && auth && !retried) {
    const ok = await refreshOnce();
    if (ok) return send<T>(path, options, true);
    fireUnauthorized();
    throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.');
  }

  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    /* 본문이 JSON 이 아닐 수 있음(빈 응답 등) */
  }

  if (env && env.success) return env.data;

  if (env && env.error) throw new ApiError(env.error.code, env.error.message);

  if (res.status === 401) {
    fireUnauthorized();
    throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.');
  }
  throw new ApiError('HTTP_' + res.status, '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

export const http = {
  get: <T>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    send<T>(path, { ...opts, method: 'GET' }, false),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    send<T>(path, { ...opts, method: 'POST', body }, false),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    send<T>(path, { ...opts, method: 'PUT', body }, false),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    send<T>(path, { ...opts, method: 'PATCH', body }, false),
};

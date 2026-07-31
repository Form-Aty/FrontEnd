import { test, expect, type Page } from '@playwright/test';

const TIME_RE = /^\d{1,2}:\d{2}$/; // 상태바 시계 (예: 9:41)

const isDesktop = (page: Page) => page.viewportSize()!.width >= 768;

test.describe('랜딩', () => {
  test('첫 화면이 렌더되고 CTA 가 동작한다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /대학생 품앗이/ })).toBeVisible();

    await page.getByRole('button', { name: '시작하기' }).click();
    await expect(page).toHaveURL(/\/verify$/);
  });

  test('로그인 버튼이 로그인 화면으로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /다시 만나서/ })).toBeVisible();
  });

  test('콘솔 에러 없이 로드된다', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      // 백엔드 미기동 등 네트워크 실패는 스모크 범위 밖
      if (msg.type() === 'error' && !/fetch|network|ERR_|404|500/i.test(msg.text())) {
        errors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('모바일에서 문서 스크롤이 잠기지 않는다', async ({ page }) => {
    test.skip(isDesktop(page), '모바일 문서 스크롤 회귀 테스트');
    await page.goto('/');

    // 페이지 길이와 무관하게 전역 body 스크롤 잠금 여부를 검증한다.
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '1200px';
      spacer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(spacer);
    });

    expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe('hidden');
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

test.describe('로그인 / 회원가입', () => {
  test('로그인 폼 요소가 모두 보인다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /다시 만나서/ })).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('가입하기 링크가 학교 인증으로 이동한다', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: '가입하기' }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByText('학교 인증')).toBeVisible();
  });

  test('로그인·회원가입의 뒤로가기 화살표 위치가 같다', async ({ page }) => {
    await page.goto('/login');
    const loginBack = await page.getByRole('button', { name: '뒤로' }).boundingBox();
    await page.goto('/verify');
    const verifyBack = await page.getByRole('button', { name: '뒤로' }).boundingBox();
    expect(loginBack).not.toBeNull();
    expect(verifyBack).not.toBeNull();
    expect(Math.abs(loginBack!.x - verifyBack!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(loginBack!.y - verifyBack!.y)).toBeLessThanOrEqual(2);
  });
});

test.describe('보호 라우트', () => {
  test('비로그인 접근은 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/teams');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('PC 폰 프레임', () => {
  test('상태바는 데스크톱에서만 보인다', async ({ page }) => {
    await page.goto('/');
    const clock = page.getByText(TIME_RE).first();
    if (isDesktop(page)) {
      await expect(clock).toBeVisible();
    } else {
      await expect(clock).not.toBeVisible(); // DOM 에는 있지만 CSS 로 숨김
    }
  });

  test('데스크톱에는 랜딩 카피(pitch)가 함께 보인다', async ({ page }) => {
    test.skip(!isDesktop(page), '모바일에는 pitch 가 없다');
    await page.goto('/');
    await expect(page.getByText('설문은 설문으로,', { exact: false }).first()).toBeVisible();
  });
});

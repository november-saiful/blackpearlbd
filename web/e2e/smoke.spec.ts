import { test, expect } from '@playwright/test';

test.describe('Smoke tests — public pages', () => {
  test('home page loads with BlackPearl branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BlackPearl/i);
    // AppTopbar is a <header>, not <nav>
    await expect(page.locator('header')).toBeVisible();
  });

  test('deals page loads', async ({ page }) => {
    await page.goto('/deals');
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Smoke tests — admin protection', () => {
  test('unauthenticated user is redirected from /admin to home', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/');
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated user is redirected from /profile to home', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL('**/');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Smoke tests — OAuth callback', () => {
  test('/auth/callback renders the signing-in state', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page.locator('text=Signing you in')).toBeVisible({ timeout: 10_000 });
  });

  test('/auth/callback with hash params redirects to home', async ({ page }) => {
    await page.goto('/auth/callback#access_token=test&refresh_token=test&token_type=bearer&expires_in=3600');
    await page.waitForURL('**/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });
});

test.describe('Smoke tests — responsive layout', () => {
  test('mobile viewport shows the mobile dock', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    // MobileDock is a <nav> fixed at the bottom, visible only on mobile
    const mobileDock = page.locator('nav.fixed');
    await expect(mobileDock).toBeVisible();
  });

  test('desktop viewport shows the topbar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });
});

test.describe('Smoke tests — deal detail', () => {
  test('deal detail page loads for a valid slug', async ({ page }) => {
    await page.goto('/deals');
    await page.waitForLoadState('networkidle');

    // Try clicking the first deal card link if any exist
    const dealLink = page.locator('a[href^="/deals/"]').first();
    if (await dealLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dealLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

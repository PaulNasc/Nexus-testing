import { test, expect, request } from '@playwright/test';

// Smoke tests do Nexus TCMS
// Pré-requisitos: servidor (porta 4000) e frontend (porta 5173) rodando
// Execução: npx playwright test

const FRONTEND = 'http://localhost:5173';
const API = 'http://localhost:4000';

test.describe('Backend health', () => {
  test('GET /api/health retorna ok: true', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    await ctx.dispose();
  });
});

test.describe('Frontend smoke', () => {
  test('pagina de login carrega e tem formulario', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('rota raiz redireciona para login quando nao autenticado', async ({ page }) => {
    await page.goto(FRONTEND);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Auth API', () => {
  test('login com credenciais invalidas retorna 401', async () => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${API}/api/auth/login`, {
      data: { email: 'naoexiste@nexus.local', password: 'senhaerrada' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error?.message).toBeTruthy();
    await ctx.dispose();
  });
});

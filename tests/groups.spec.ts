import { test, expect } from '@playwright/test';

test.describe('Gerenciamento de Grupos (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // Timeout estendido
    test.setTimeout(60000);

    // Navegar para a raiz (forçar login se necessário)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Se estiver no login
    if (page.url().includes('/login') || await page.locator('input[type="email"]').isVisible()) {
      await page.fill('input[type="email"]', 'paulo.santos@teste');
      await page.fill('input[type="password"]', '050200@Pa');
      await page.click('button[type="submit"]');
      
      // Aguardar carregar o Dashboard
      await page.waitForURL('**/', { timeout: 20000 });
      await page.waitForLoadState('networkidle');
    }

    // Agora navegar para User Management
    await page.goto('/user-management');
    await page.waitForSelector('[role="tablist"]', { state: 'visible', timeout: 15000 });
  });

  test('deve renderizar a aba de grupos com o novo design premium', async ({ page }) => {
    // Clicar na aba de Grupos
    const groupsTab = page.locator('button[role="tab"]', { hasText: 'Grupos' });
    await expect(groupsTab).toBeVisible();
    await groupsTab.click();

    // Validar se o título da seção de grupos aparece
    await expect(page.locator('text=Estrutura de Times')).toBeVisible({ timeout: 10000 });

    // Validar se o banner de pendências aparece
    await expect(page.locator('text=Pendências de Alocação')).toBeVisible();

    // Validar se os cards de grupos padrão estão presentes
    await expect(page.locator('h3', { hasText: 'Desenvolvimento' })).toBeVisible();
  });

  test('deve permitir interagir com a alocação de usuários pendentes', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Grupos")');
    
    // Validar presença de elementos de gestão
    const notifyBtn = page.locator('button:has-text("Solicitar Onboarding")');
    if (await notifyBtn.isVisible()) {
      await notifyBtn.click();
      await expect(page.locator('text=Notificações Enviadas')).toBeVisible();
    }

    const allocateTrigger = page.locator('button:has-text("Alocar agora...")').first();
    if (await allocateTrigger.isVisible()) {
      await allocateTrigger.click();
      await page.locator('[role="option"]').first().click();
      await expect(page.locator('text=Membro adicionado com sucesso')).toBeVisible();
    }
  });
});

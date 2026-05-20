
import { test, expect } from '@playwright/test';

test.describe('Fase T03: Fluxo Unificado de Criação', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'paulo.santos@teste');
    await page.fill('input[type="password"]', '050200@Pa');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('deve criar um plano e casos em conjunto via fluxo unificado', async ({ page }) => {
    // Navegar para Planos
    await page.click('nav >> text=Planos');
    await expect(page).toHaveURL(/\/plans/);

    // Abrir Fluxo Unificado
    await page.click('button:has-text("Novo Plano de Teste")');
    await expect(page.locator('text=Fluxo Unificado de Criação')).toBeVisible();

    // Passo 1: Definição
    const planTitle = `Plano Unificado ${Date.now()}`;
    await page.fill('input[placeholder*="Ex: Testes de Regressão"]', planTitle);
    await page.fill('textarea[placeholder*="O que será testado?"]', 'Teste automatizado do fluxo T03.');
    await page.fill('input[placeholder*="Ex: Garantir estabilidade"]', 'Objetivo T03');
    await page.click('button:has-text("Próximo")');

    // Passo 2: Casos (Adicionar Manual)
    await page.click('button:has-text("Adicionar Manual")');
    await expect(page.locator('input[value="Novo Caso de Teste"]')).toBeVisible();
    await page.fill('textarea[placeholder="Descrição do cenário..."]', 'Cenário manual do teste T03');
    await page.click('button:has-text("Revisar")');

    // Passo 3: Revisão
    await expect(page.locator('text=Tudo pronto para salvar?')).toBeVisible();
    await expect(page.locator(`text="${planTitle}"`)).toBeVisible();

    // Salvar
    await page.click('button:has-text("Confirmar e Criar Tudo")');

    // Verificar sucesso
    await expect(page.locator('text=Sucesso!')).toBeVisible();
    await expect(page.locator('text=Fluxo Unificado de Criação')).not.toBeVisible();

    // Verificar se o plano aparece na lista
    await expect(page.locator(`text=${planTitle}`)).toBeVisible();
  });
});

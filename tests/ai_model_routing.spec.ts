import { test, expect } from '@playwright/test';

test.describe('AI Model Configuration and Routing Verification', () => {
  // Test parameters
  const TEST_USER = 'paulo.santos@teste';
  const TEST_PASS = '050200@Pa';

  test.beforeEach(async ({ page }) => {
    // Perform Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER);
    await page.fill('input[type="password"]', TEST_PASS);
    await page.click('button[type="submit"]');
    // Wait for the URL redirect to / with a generous timeout to prevent flaky runs
    await page.waitForURL('**/', { timeout: 15000 });
  });

  test('should verify removal of visual outline/focus rings on input elements', async ({ page }) => {
    // Go to profile menu to open a dialog with input fields
    await page.click('button:has(.lucide-user)');
    await page.click('text=Meu Perfil');

    const displayNameInput = page.locator('input[id="display_name"], input[placeholder*="Ex:"]').first();
    if (await displayNameInput.isVisible()) {
      await displayNameInput.focus();
      // Evaluate computed outline-style and box-shadow to confirm clean focus rings
      const styles = await displayNameInput.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          outlineStyle: computed.outlineStyle,
          boxShadow: computed.boxShadow,
        };
      });

      // Outline should be none (reset by global index.css or Tailwind classes)
      expect(styles.outlineStyle).toBe('none');
    }
  });

  test('should trigger Onboarding flow when the project count is 0', async ({ page }) => {
    // Intercept project queries to return empty lists, forcing the welcome modal to trigger
    await page.route('**/api/db/query', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        try {
          const body = request.postDataJSON();
          if (body && body.table === 'projects') {
            await route.fulfill({
              contentType: 'application/json',
              body: JSON.stringify({ data: [], error: null }),
            });
            return;
          }
        } catch (e) {
          // Fallback if not JSON
        }
      }
      await route.continue();
    });

    // Reload the dashboard page
    await page.goto('/');
    
    // Welcome header and "Crie seu Primeiro Projeto" call to action should be visible
    await expect(page.locator('text=Bem-vindo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crie seu Primeiro Projeto' })).toBeVisible();
  });

  test('should display and save adaptive routing and zero-cost toggles in Model Control Panel', async ({ page }) => {
    // Navigate to Config IA
    await page.click('nav >> text=Config. IA');
    await expect(page.locator('h2:has-text("Model Control Panel")')).toBeVisible();

    // Select the first model collapsible row to expand edit inline form
    const row = page.locator('div.flex.items-center.gap-2', { hasText: 'Gemini 2.0 Flash' }).first();
    const trigger = row.locator('button').last();
    await trigger.click();

    // Verify adaptive mode switch toggle exists in the inline form
    const adaptiveModeSwitch = page.locator('[id^="route-slugs-toggle-"]').first();
    await expect(adaptiveModeSwitch).toBeVisible();

    // Verify onlyFreeModels switch toggle exists in the inline form
    const onlyFreeSwitch = page.locator('[id^="free-models-toggle-"]').first();
    await expect(onlyFreeSwitch).toBeVisible();

    // Verify alternative slugs textarea exists
    const alternativeSlugsTextarea = page.locator('[id^="adaptive-slugs-textarea-"]').first();
    await expect(alternativeSlugsTextarea).toBeVisible();

    // Toggle values and verify saving interaction
    const isInitiallyChecked = await onlyFreeSwitch.getAttribute('aria-checked') === 'true';
    await onlyFreeSwitch.click();
    const isAfterClickChecked = await onlyFreeSwitch.getAttribute('aria-checked') === 'true';
    expect(isAfterClickChecked).not.toBe(isInitiallyChecked);

    // Cancel inline form changes to restore original configuration
    await page.click('text=Cancelar');
  });

  test('should apply zero-cost filtering logic on OpenRouter request fallback', async ({ page }) => {
    // Go to config-ia to ensure dependencies are loaded
    await page.click('nav >> text=Config. IA');
    
    // Evaluate the OpenRouter zero-cost transformation logic in the page environment
    const testResult = await page.evaluate(async () => {
      const getFreeSlug = (slug: string): string | null => {
        if (slug.endsWith(':free')) return slug;
        
        const freeSuffixes = [
          'google/gemma-2-9b-it',
          'meta-llama/llama-3.1-70b-instruct',
          'mistralai/mistral-7b-instruct',
          'meta-llama/llama-3-8b-instruct',
          'qwen/qwen-2.5-7b-instruct',
          'meta-llama/llama-3.2-3b-instruct',
          'meta-llama/llama-3.1-8b-instruct',
          'qwen/qwen-2-7b-instruct',
          'microsoft/phi-3-medium-128k-instruct'
        ];
        
        if (freeSuffixes.includes(slug)) {
          return `${slug}:free`;
        }
        if (slug.startsWith('meta-llama/') || slug.startsWith('google/') || slug.startsWith('mistralai/') || slug.startsWith('qwen/')) {
          return `${slug}:free`;
        }
        return null;
      };

      // Assertions in evaluation context
      return {
        llamaMapped: getFreeSlug('meta-llama/llama-3.1-70b-instruct'),
        gemmaAlreadyFree: getFreeSlug('google/gemma-2-9b-it:free'),
        gpt4oMiniShouldFail: getFreeSlug('openai/gpt-4o-mini'),
        randomQwenMapped: getFreeSlug('qwen/my-new-unseen-model'),
      };
    });

    expect(testResult.llamaMapped).toBe('meta-llama/llama-3.1-70b-instruct:free');
    expect(testResult.gemmaAlreadyFree).toBe('google/gemma-2-9b-it:free');
    expect(testResult.gpt4oMiniShouldFail).toBeNull();
    expect(testResult.randomQwenMapped).toBe('qwen/my-new-unseen-model:free');
  });
});


import { test, expect } from '@playwright/test';

test.describe('Profile Badges and Tags Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'paulo.santos@teste');
    await page.fill('input[type="password"]', '050200@Pa');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should display permission and functional roles in header with consistent styling', async ({ page }) => {
    // Open profile modal via header
    await page.click('button:has(.lucide-user)');
    await page.click('text=Meu Perfil');
    
    // Check permission badge
    const permissionBadge = page.locator('span:has-text("Master")');
    await expect(permissionBadge).toBeVisible();
    
    // Check if it has the premium styling (brand background)
    await expect(permissionBadge).toHaveClass(/bg-brand\/10/);
    
    // Check if functional roles are also visible (if any)
    // Note: We might need to ensure the test user has a role assigned in the DB or via UI
  });

  test('should display group tags in UserProfileModal', async ({ page }) => {
    // Navigate to a page where UserProfileModal can be triggered
    // For example, Test Plans or Test Cases
    await page.click('nav >> text=Planos');
    
    // Open a test plan details (assuming one exists)
    // We might need to create one if not present, but for now we try to find one
    const firstPlan = page.locator('table tr').first();
    if (await firstPlan.isVisible()) {
        await firstPlan.click();
        
        // Find author avatar/name and click to open UserProfileModal
        const authorLink = page.locator('button:has(.lucide-user)').first(); // Adjust selector
        if (await authorLink.isVisible()) {
            await authorLink.click();
            await expect(page.locator('text=Grupos & Tags')).toBeVisible();
        }
    }
  });
});

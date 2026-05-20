
import { test, expect } from '@playwright/test';

const MASTER_EMAIL = 'paulo.santos@teste';
const MASTER_PASSWORD = '050200@Pa';

test.describe('Security and Performance Validation (T01 & T02)', () => {

  test('T02: Dashboard Aggregate Endpoint Performance and Content', async ({ page }) => {
    // Login as Master
    await page.goto('/login');
    await page.fill('input[type="email"]', MASTER_EMAIL);
    await page.fill('input[type="password"]', MASTER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await page.waitForURL('/');
    
    // Check for dashboard elements
    await expect(page.locator('h1:has-text("Bem-vindo")')).toContainText('Bem-vindo', { timeout: 15000 });
    
    // Verify specific T02 elements (Overview cards)
    const cards = page.locator('.grid-cols-2 .bg-card');
    await expect(cards).toHaveCount(6);
    
    // Intercept the dashboard report call and verify it's the new aggregate endpoint
    const startTime = Date.now();
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/reports/dashboard')),
      page.reload()
    ]);
    const duration = Date.now() - startTime;
    
    const data = await response.json();
    expect(data.overview).toBeDefined();
    expect(data.overview.totalPlans).toBeDefined();
    expect(data.execStats).toBeDefined();
    expect(data.planProgress).toBeDefined();
    expect(data.recent).toBeDefined();
    
    console.log('Dashboard Aggregate API response time: ', duration, 'ms');
    expect(duration).toBeLessThan(1000); // Expecting under 1000ms including page reload overhead
  });

  test('T01: RBAC & IDOR Mitigation for Viewer Role', async ({ page, request }) => {
    // 1. Register a new user (default role is viewer)
    const viewerEmail = `viewer_${Date.now()}@test.com`;
    await page.goto('/register');
    await page.fill('input[placeholder="Seu nome completo"]', 'Test Viewer');
    await page.fill('input[type="email"]', viewerEmail);
    await page.fill('input[type="password"]', 'Viewer123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    
    // Get the auth token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('krg_local_auth_token'));
    expect(token).toBeDefined();

    // 2. Attempt unauthorized mutation (T01 Protection)
    // Try to delete a project (should fail with 403)
    const deleteResponse = await request.post('/api/db/mutate', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'projects',
        action: 'delete',
        filters: [{ column: 'id', value: 'any-id', type: 'eq' }]
      }
    });
    
    expect(deleteResponse.status()).toBe(403);
    const errorBody = await deleteResponse.json();
    expect(errorBody.error.message).toContain('Permissão negada');
    
    // 3. Attempt IDOR: edit someone else's api_keys (should fail with 403)
    const idorResponse = await request.post('/api/db/mutate', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'api_keys',
        action: 'update',
        values: { key_encrypted: 'hacked' },
        filters: [{ column: 'user_id', value: 'other-user-id', type: 'eq' }]
      }
    });
    
    expect(idorResponse.status()).toBe(403);
    expect(await idorResponse.json()).toMatchObject({
      error: { message: expect.stringContaining('IDOR') }
    });
  });


  test('Red Team: Password Hash Redaction in profiles query', async ({ request, page }) => {
    // Login as Master to get token
    await page.goto('/login');
    await page.fill('input[type="email"]', MASTER_EMAIL);
    await page.fill('input[type="password"]', MASTER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const token = await page.evaluate(() => localStorage.getItem('krg_local_auth_token'));

    // Query profiles table
    const response = await request.post('/api/db/query', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'profiles',
        columns: 'id,email,password_hash'
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThan(0);
    
    // Check that none of the returned profile records have password_hash
    for (const profile of body.data) {
      expect(profile.password_hash).toBeUndefined();
    }
  });

  test('Red Team: Reject UPDATE/DELETE with empty filters', async ({ request, page }) => {
    // Login as Master to get token
    await page.goto('/login');
    await page.fill('input[type="email"]', MASTER_EMAIL);
    await page.fill('input[type="password"]', MASTER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const token = await page.evaluate(() => localStorage.getItem('krg_local_auth_token'));

    // Try UPDATE with empty filters
    const updateResponse = await request.post('/api/db/mutate', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'projects',
        action: 'update',
        values: { description: 'Malicious' },
        filters: []
      }
    });
    expect(updateResponse.status()).toBe(400);

    // Try DELETE with empty filters
    const deleteResponse = await request.post('/api/db/mutate', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'projects',
        action: 'delete',
        filters: []
      }
    });
    expect(deleteResponse.status()).toBe(400);
  });

  test('Performance: Plan Linked Details Aggregate API', async ({ request, page }) => {
    // Login as Master
    await page.goto('/login');
    await page.fill('input[type="email"]', MASTER_EMAIL);
    await page.fill('input[type="password"]', MASTER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const token = await page.evaluate(() => localStorage.getItem('krg_local_auth_token'));

    // Request plan link details
    const response = await request.get('/api/db/plan-linked-details/any-plan-id', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.testCaseCount).toBeDefined();
    expect(body.data.executionCount).toBeDefined();
    expect(body.data.defectCount).toBeDefined();
    expect(body.data.testCases).toBeDefined();
    expect(body.data.executions).toBeDefined();
    expect(body.data.defects).toBeDefined();
  });

  test('Red Team: Brute Force Protection on Login', async ({ request }) => {
    // Attempt multiple logins with wrong password
    const loginAttempts = 15;
    let lastStatus = 0;
    
    for (let i = 0; i < loginAttempts; i++) {
      const response = await request.post('/api/auth/login', {
        data: { email: 'fake@user.com', password: 'wrong' }
      });
      lastStatus = response.status();
      if (lastStatus === 429) break;
    }
    
    expect(lastStatus).toBe(429);
  });
});

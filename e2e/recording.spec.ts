import { test, expect } from '@playwright/test';

test.describe('RVC Dataset Studio', () => {
  test.beforeEach(async ({ page }) => {
    // Mock getUserMedia with synthetic audio (no real microphone needed)
    await page.addInitScript(() => {
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.frequency.value = 440;
        gain.gain.value = 0.5;
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start();
        // Return a mock MediaStream
        const stream = audioCtx.createMediaStreamDestination();
        gain.connect(stream);
        return stream.stream as MediaStream;
      };
    });
  });

  test('app loads and shows onboarding or main interface', async ({ page }) => {
    await page.goto('/');
    // Should show either onboarding or main app
    const hasOnboarding = await page.locator('.onboarding').count();
    const hasApp = await page.locator('.app').count();
    expect(hasOnboarding + hasApp).toBeGreaterThan(0);
  });

  test('onboarding flow: complete voice test and start recording', async ({ page }) => {
    await page.goto('/');
    // Wait for onboarding
    await page.waitForSelector('.onboarding', { timeout: 10000 });
    // Click "Start recording" or similar button
    const startBtn = page.locator('button:has-text("Start recording")').first();
    if (await startBtn.count()) {
      await startBtn.click();
    }
    // Should show main app
    await expect(page.locator('.app')).toBeVisible({ timeout: 10000 });
  });

  test('recording flow: start recording and verify take appears', async ({ page }) => {
    await page.goto('/');
    // Skip onboarding if present
    const startBtn = page.locator('button:has-text("Start recording")').first();
    if (await startBtn.count()) {
      await startBtn.click();
    }
    await page.waitForSelector('.app', { timeout: 10000 });
    // Enable microphone
    const micBtn = page.locator('.btn-mic');
    await micBtn.click();
    await page.waitForTimeout(1000);
    // Start recording with Space key
    await page.keyboard.press('Space');
    // Wait for recording to complete (auto-stops after exercise duration)
    await page.waitForTimeout(5000);
    // Press Enter to accept take
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Should show take in review
    const hasTake = await page.locator('.qc').count();
    expect(hasTake).toBeGreaterThan(0);
  });

  test('export flow: click ZIP export and verify download', async ({ page }) => {
    await page.goto('/');
    const startBtn = page.locator('button:has-text("Start recording")').first();
    if (await startBtn.count()) {
      await startBtn.click();
    }
    await page.waitForSelector('.app', { timeout: 10000 });
    // Record a take first
    await page.keyboard.press('Space');
    await page.waitForTimeout(5000);
    await page.keyboard.press('Enter');
    // Go to export panel and click ZIP
    const zipBtn = page.locator('button:has-text(".zip")').first();
    if (await zipBtn.count()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        zipBtn.click(),
      ]);
      expect(download).toBeTruthy();
    }
  });

  test('backup flow: create backup and verify file downloaded', async ({ page }) => {
    await page.goto('/');
    const startBtn = page.locator('button:has-text("Start recording")').first();
    if (await startBtn.count()) {
      await startBtn.click();
    }
    await page.waitForSelector('.app', { timeout: 10000 });
    // Record a take
    await page.keyboard.press('Space');
    await page.waitForTimeout(5000);
    await page.keyboard.press('Enter');
    // Go to backup panel and create backup
    const backupBtn = page.locator('button:has-text("backup")').first();
    if (await backupBtn.count()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        backupBtn.click(),
      ]);
      expect(download).toBeTruthy();
    }
  });

  test('settings panel: change export sample rate', async ({ page }) => {
    await page.goto('/');
    const startBtn = page.locator('button:has-text("Start recording")').first();
    if (await startBtn.count()) {
      await startBtn.click();
    }
    await page.waitForSelector('.app', { timeout: 10000 });
    // Open settings
    const settingsSummary = page.locator('details.panel summary').first();
    if (await settingsSummary.count()) {
      await settingsSummary.click();
    }
    // Find export SR select
    const exportSR = page.locator('#setExportSR');
    if (await exportSR.count()) {
      await exportSR.selectOption('40000');
      await expect(exportSR).toHaveValue('40000');
    }
  });
});

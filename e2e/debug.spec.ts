import { test } from '@playwright/test';

test('debug: recording flow', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // Skip onboarding
  const startBtn = page.locator('button:has-text("Start recording")').first();
  if (await startBtn.count()) {
    await startBtn.click();
  }
  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForTimeout(1000);
  
  // Check mic status
  const micBtn = page.locator('.btn-mic');
  const micText = await micBtn.textContent();
  console.log('Mic button text:', micText);
  
  // Start recording
  await page.keyboard.press('Space');
  await page.waitForTimeout(1000);
  
  // Check phase
  const phase = await page.locator('.phase').textContent();
  console.log('Phase after Space:', phase);
  
  // Wait for recording to complete
  await page.waitForTimeout(6000);
  
  // Check phase again
  const phase2 = await page.locator('.phase').textContent();
  console.log('Phase after wait:', phase2);
  
  // Check if review panel has content
  const reviewText = await page.locator('#h-review').textContent().catch(() => 'NOT FOUND');
  console.log('Review heading:', reviewText);
  
  // Check for QC items
  const qcCount = await page.locator('.qc').count();
  console.log('QC items:', qcCount);
  
  // Check for pending take
  const pendingText = await page.locator('.pbody').textContent();
  console.log('Panel body text (first 500):', pendingText?.substring(0, 500));
  
  // Try pressing Enter
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  const qcCount2 = await page.locator('.qc').count();
  console.log('QC items after Enter:', qcCount2);
});

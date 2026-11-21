import { test, expect } from '@playwright/test';

test('shows the student login flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '每天背一点，到了考试不慌。' })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入今日任务' })).toBeVisible();
  await expect(page.getByText('不收集真实姓名、学校、班级或手机号。')).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('桌面工作台的研究、证据、报告、Agent、资料与订阅流程', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  const selector = page.getByRole('button', { name: '切换研究 Agent' });
  await selector.click();
  await expect(page.getByRole('menuitemradio', { name: /研究 Agent/ })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: /竞品分析团队/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(selector).toBeFocused();
  await page.getByRole('button', { name: '定价分析', exact: true }).click();
  const input = page.getByRole('textbox', { name: '研究问题' });
  await expect(input).toBeFocused();
  await input.press('Shift+Enter');
  await expect(page).not.toHaveURL(/chat=/);
  await input.press('Enter');
  await expect(page).toHaveURL(/chat=/);
  await expect(page.getByTitle('导出 Markdown 报告')).toBeVisible();
  await expect(page.locator('.assistant-answer')).toContainText('684');
  await page.reload();
  await expect(page.locator('.assistant-answer')).toContainText('684');
  await page.locator('.evidence-link').first().click();
  await expect(page.getByRole('dialog', { name: '来源证据' })).toContainText('已保存的原文');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '来源证据' })).toBeHidden();
  await page.locator('.history-item').first().hover();
  await page.getByRole('button', { name: '重命名', exact: false }).first().click();
  await page.getByRole('dialog').getByRole('textbox').fill('重构回归研究');
  await page.getByRole('dialog').getByRole('button', { name: 'confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: '重构回归研究' })).toBeVisible();

  await page.getByRole('button', { name: '研究报告', exact: true }).click();
  await page.locator('.report-list-item').first().click();
  await expect(page.locator('.report-document')).toContainText('684');
  await page.getByRole('button', { name: '数字员工', exact: true }).click();
  await page.getByRole('button', { name: '配置与发布' }).first().click();
  const prompt = page.getByRole('dialog').getByRole('textbox');
  await prompt.fill((await prompt.inputValue()) + '\n保持可验证的证据引用。');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: '来源资料', exact: true }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  const importDialog = page.getByRole('dialog');
  await importDialog.getByRole('textbox', { name: '产品 / 资料归属' }).fill('回归产品');
  await importDialog.getByRole('textbox', { name: '资料标题' }).fill('回归资料');
  await importDialog
    .getByRole('textbox', { name: '原始内容' })
    .fill('每月套餐 50 美元，权益需要核实。');
  await importDialog.getByRole('button', { name: '保存资料', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索来源资料' }).fill('回归资料');
  await page.locator('.source-item').click();
  await expect(page.getByRole('dialog', { name: '来源证据' })).toContainText('本地导入');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '任务与订阅', exact: true }).click();
  await page.getByRole('button', { name: '新建模板', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: '任务模板名称' })
    .fill('回归任务模板');
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: '任务要求' })
    .fill('核对竞品商业化变化，提供前后证据。');
  await page.getByRole('button', { name: '发布任务版本', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page
    .locator('.template-card')
    .filter({ hasText: '回归任务模板' })
    .getByRole('button', { name: '订阅此任务' })
    .click();
  await page.getByRole('button', { name: '创建并启用', exact: true }).click();
  await expect(page.locator('.subscription-card')).toHaveCount(1);
  await page.getByTitle('切换虚构资料快照以验证变化').click();
  await page.getByRole('button', { name: '立即检查', exact: true }).click();
  await expect(page.getByTitle('导出 Markdown 报告')).toBeVisible();
  await page.getByRole('button', { name: '研究通知', exact: true }).click();
  await expect(page.locator('.notification-item').first()).toContainText('商业化变化');
  await page.getByRole('button', { name: '标为已读', exact: true }).first().click();
  await expect(page.locator('.notification-item').first()).toHaveClass(/read/);
  expect(errors).toEqual([]);
});

test('移动端侧栏、输入、附件与任务停止', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '展开侧栏' })).toBeVisible();
  await page.getByRole('button', { name: '展开侧栏' }).click();
  await expect(page.getByRole('button', { name: '来源资料', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收起侧栏' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('用户研究资料：仅核对套餐价格。'),
  });
  await expect(page.locator('.attachment-chip')).toContainText('notes.md');
  await page.getByRole('button', { name: '移除附件' }).click();
  await expect(page.locator('.attachment-chip')).toBeHidden();
  await page
    .getByRole('textbox', { name: '研究问题' })
    .fill('比较三个竞品的商业化策略、价格和产品能力');
  await page.getByRole('button', { name: '发送研究问题' }).click();
  await page.getByRole('button', { name: '停止任务' }).click();
  await expect(page.getByRole('button', { name: '发送研究问题' })).toBeVisible();
  await expect(page.locator('.answer-footer')).toContainText('已停止');
});

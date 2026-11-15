import { expect, test, type Page } from '@playwright/test';

const basePath = process.env.DEMO_BASE_PATH || '';
async function approach(page: Page) {
  const card = page.getByRole('link', { name: /Atlas/ });
  const box = (await card.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x - 340, y);
  // Remain outside the card throughout. Spaced samples model a steady approach.
  for (let i = 0; i < 9; i++) {
    await page.mouse.move(box.x - 300 + i * 27, y);
    await page.waitForTimeout(20);
  }
  return card;
}

test('requests the route before hover in both prediction modes', async ({
  page,
}) => {
  for (const mode of ['Simple', 'Smart']) {
    await page.goto(basePath + '/');
    await page.getByRole('radio', { name: mode, exact: true }).check();
    const request = page.waitForRequest(
      (request) =>
        request.url().includes(basePath + '/destination/atlas') &&
        request.headers()['rsc'] === '1',
    );
    const card = await approach(page);
    await request;
    expect(await card.evaluate((element) => element.matches(':hover'))).toBe(
      false,
    );
    await expect(
      page.getByRole('cell', { name: 'trajectory', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Yes', exact: true }),
    ).toBeVisible();
  }
});

test('does not request untouched routes merely because they are visible', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.headers()['rsc'] === '1') requests.push(request.url());
  });
  await page.goto(basePath + '/');
  await page.waitForTimeout(500);
  expect(requests.filter((url) => url.includes('/destination/'))).toEqual([]);
});

test('keeps Next.js navigation working after prefetch', async ({ page }) => {
  await page.goto(basePath + '/');
  const card = await approach(page);
  await expect(
    page.getByRole('cell', { name: 'trajectory', exact: true }),
  ).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(basePath + '/destination/atlas$'));
  await expect(
    page.getByRole('heading', { name: 'Atlas', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Back to the playground/ }).click();
  await expect(
    page.getByRole('heading', { name: /A head start/ }),
  ).toBeVisible();
});

test('supports keyboard focus', async ({ page }) => {
  await page.goto(basePath + '/');
  await page.getByRole('link', { name: /Studio/ }).focus();
  await expect(
    page.getByRole('cell', { name: 'focus', exact: true }),
  ).toBeVisible();
});

test('can disable prediction', async ({ page }) => {
  await page.goto(basePath + '/');
  await page.getByRole('checkbox', { name: 'Prediction enabled' }).uncheck();
  await approach(page);
  await expect(page.getByText('0 requests', { exact: true })).toBeVisible();
});

test('hydrates without runtime errors and fits a phone viewport', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(basePath + '/');
  await expect(
    page.getByRole('heading', { name: /A head start/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

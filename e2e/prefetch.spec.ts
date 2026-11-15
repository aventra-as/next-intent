import { expect, test, type Page } from '@playwright/test';

const basePath = process.env.DEMO_BASE_PATH || '';
async function approach(page: Page) {
  const card = page.getByRole('link', { name: /Atlas/ });
  const box = (await card.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x - 340, y);
  // Small real mouse steps leave time for conservative intent to settle.
  // End six pixels before the link, without hovering it.
  for (let i = 0; i < 50; i++) {
    await page.mouse.move(box.x - 300 + i * 6, y);
    await page.waitForTimeout(20);
  }
  return card;
}
async function showDetails(page: Page) {
  await page.getByText('Request details', { exact: true }).click();
}
for (const mode of ['Conservative', 'Balanced', 'Aggressive']) {
  test(`requests the route before hover in ${mode.toLowerCase()} mode`, async ({
    page,
  }) => {
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
    await expect(page.getByRole('status')).toHaveText(
      'atlas requested before hover',
    );
    await showDetails(page);
    await expect(
      page.getByRole('cell', { name: 'trajectory', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Yes', exact: true }),
    ).toBeVisible();
  });
}

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
  await expect(page.getByRole('status')).toHaveText(
    'atlas requested before hover',
  );
  await card.click();
  await expect(page).toHaveURL(new RegExp(basePath + '/destination/atlas$'));
  await expect(
    page.getByRole('heading', { name: 'Atlas', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Back to the playground/ }).click();
  await expect(
    page.getByRole('heading', { name: 'A head start on your next click.' }),
  ).toBeVisible();
});

test('supports keyboard focus', async ({ page }) => {
  await page.goto(basePath + '/');
  await page.getByRole('link', { name: /Studio/ }).focus();
  await expect(page.getByRole('status')).toHaveText('studio requested');
  await showDetails(page);
  await expect(
    page.getByRole('cell', { name: 'focus', exact: true }),
  ).toBeVisible();
});

test('can disable prediction', async ({ page }) => {
  await page.goto(basePath + '/');
  await showDetails(page);
  await page.getByRole('checkbox', { name: 'Prediction enabled' }).uncheck();
  await approach(page);
  await expect(page.getByText('0 requests', { exact: true })).toBeVisible();
});

test('switching modes resets the request history', async ({ page }) => {
  await page.goto(basePath + '/');
  await approach(page);
  await expect(page.getByRole('status')).toHaveText(
    'atlas requested before hover',
  );
  await page.getByRole('radio', { name: 'Aggressive', exact: true }).check();
  await expect(page.getByText('0 requests', { exact: true })).toBeVisible();
  await approach(page);
  await expect(page.getByRole('status')).toHaveText(
    'atlas requested before hover',
  );
});

test('reset permits the same link to be predicted again', async ({ page }) => {
  await page.goto(basePath + '/');
  await approach(page);
  await expect(page.getByRole('status')).toHaveText(
    'atlas requested before hover',
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('0 requests', { exact: true })).toBeVisible();
  await approach(page);
  await expect(page.getByRole('status')).toHaveText(
    'atlas requested before hover',
  );
});

test('hydrates without runtime errors and fits a phone viewport', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(basePath + '/');
  await expect(
    page.getByRole('heading', { name: 'A head start on your next click.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

for (const mode of ['Conservative', 'Balanced', 'Aggressive']) {
  test(`shows a live path and target before hover in ${mode.toLowerCase()} mode`, async ({
    page,
  }) => {
    await page.goto(basePath + '/');
    await page.getByRole('radio', { name: mode, exact: true }).check();
    const card = page.getByRole('link', { name: /Atlas/ });
    const box = (await card.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x - 340, y);
    let sawPrediction = false;
    for (let i = 0; i < 50; i++) {
      await page.mouse.move(box.x - 300 + i * 6, y);
      await page.waitForTimeout(20);
      const live = await card.evaluate((element) => {
        const overlay = document.querySelector('.prediction-overlay')!;
        const path = overlay.querySelector('line')!;
        return {
          predicted: element.getAttribute('data-predicted') === 'true',
          hovered: element.matches(':hover'),
          active: overlay.getAttribute('data-active') === 'true',
          forward:
            Number(path.getAttribute('x2')) > Number(path.getAttribute('x1')),
          landing: overlay
            .querySelector('.landing-point')
            ?.getAttribute('visibility'),
        };
      });
      if (live.predicted) {
        expect(live.hovered).toBe(false);
        expect(live.active).toBe(true);
        expect(live.forward).toBe(true);
        expect(live.landing).toBe('visible');
        if (
          !sawPrediction &&
          mode === 'Balanced' &&
          process.env.DEMO_SCREENSHOT
        ) {
          await page.screenshot({
            path: process.env.DEMO_SCREENSHOT,
            fullPage: true,
            animations: 'disabled',
          });
        }
        sawPrediction = true;
      }
    }
    expect(sawPrediction).toBe(true);
    // A stationary cursor must not leave the previous guess looking live.
    await expect(page.locator('.prediction-overlay')).toHaveAttribute(
      'data-active',
      'false',
    );
    await expect(card).not.toHaveAttribute('data-predicted', 'true');
    // A live candidate can clear before the conservative stable-target delay.
    // Actual pre-hover requests are verified separately for every mode.
  });
}

test('keeps showing predictions for an already requested route, and clears on reset', async ({
  page,
}) => {
  await page.goto(basePath + '/');
  const card = await approach(page);
  await expect(card).toHaveAttribute('data-requested', 'true');
  await approach(page);
  await expect(card).toHaveAttribute('data-predicted', 'true');
  await expect(page.getByText('1 request', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(card).not.toHaveAttribute('data-predicted', 'true');
  await expect(page.locator('.prediction-overlay')).toHaveAttribute(
    'data-active',
    'false',
  );
});

test('shows a neutral projection when moving away from the links', async ({
  page,
}) => {
  await page.goto(basePath + '/');
  const arena = (await page
    .getByRole('region', { name: 'Prediction playground' })
    .boundingBox())!;
  const x = arena.x + 160;
  const y = arena.y + 100;
  await page.mouse.move(x, y);
  await page.waitForTimeout(20);
  await page.mouse.move(x - 20, y);
  await expect(page.locator('.prediction-overlay')).toHaveAttribute(
    'data-active',
    'true',
  );
  await expect(page.locator('.prediction-overlay')).toHaveAttribute(
    'data-target',
    'false',
  );
  await expect(page.locator('[data-predicted="true"]')).toHaveCount(0);
  await page.mouse.move(10, 10);
  await expect(page.locator('.prediction-overlay')).toHaveAttribute(
    'data-active',
    'false',
  );
});

test('navigates the documentation and returns to the playground', async ({
  page,
}) => {
  await page.goto(basePath + '/');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Docs', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Getting started', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('npm install next-intent', { exact: true }),
  ).toBeVisible();
  for (const [label, heading] of [
    ['Prediction & modes', 'Prediction & modes'],
    ['Configuration', 'Configuration'],
    ['API reference', 'API reference'],
    ['Recipes & troubleshooting', 'Recipes & troubleshooting'],
  ]) {
    const link = page
      .getByRole('navigation', { name: 'Documentation', exact: true })
      .getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Playground', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'A head start on your next click.' }),
  ).toBeVisible();
  await expect(page.locator('.wordmark')).toHaveCSS('font-weight', '400');
});

test('copies a documentation code example', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(basePath + '/docs');
  await page
    .getByRole('button', { name: 'Copy Terminal', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Copy Terminal', exact: true }).first(),
  ).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'npm install next-intent',
  );
});

test('documentation fits mobile and supports direct section links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(basePath + '/docs/configuration#options');
  await expect(
    page.getByRole('heading', { name: 'Options', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('navigation', { name: 'Documentation', exact: true }),
  ).toBeVisible();
});

test('renders highlighted code and the Aventra footer', async ({ page }) => {
  await page.goto(basePath + '/docs');
  await expect(page.locator('pre.shiki')).not.toHaveCount(0);
  const colors = await page
    .locator('pre.shiki span[style]')
    .evaluateAll((elements) => [
      ...new Set(
        elements.map((element) => (element as HTMLElement).style.color),
      ),
    ]);
  expect(colors.length).toBeGreaterThan(2);
  await expect(page.locator('.site-footer')).toContainText('Made with');
  await expect(
    page.locator('.site-footer').getByRole('link', { name: 'Aventra AS' }),
  ).toHaveAttribute('href', 'https://aventra.no');
});

test('serves route-specific SEO metadata and a focused sitemap', async ({
  page,
  request,
}) => {
  await page.goto(basePath + '/docs/configuration');
  await expect(page).toHaveTitle('Configuration | next-intent');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(basePath + '/docs/configuration$'),
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Configuration | next-intent',
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  const breadcrumb = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(breadcrumb!)['@type']).toBe('BreadcrumbList');
  const sitemap = await request.get(basePath + '/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain(basePath + '/docs/configuration');
  expect(xml).not.toContain('/destination/');
  await page.goto(basePath + '/destination/atlas');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  const image = await request.get(basePath + '/opengraph-image');
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/png');
});

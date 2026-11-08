import { expect, test, type Page, type Route } from '@playwright/test';

// The build has no Supabase settings, so each test points the app at an in-memory fake.
const URL_BASE = 'https://plandomtest.supabase.co';
const KEY = 'sb_publishable_' + 'playwright'.repeat(3);
const TOKEN = '0123456789abcdef0123456789abcdef';
const USER = { id: '00000000-0000-0000-0000-00000000000a', email: 'owner@example.test' };
const PASSWORD = 'test-password-1';

interface Fake {
  admin: boolean;
  upserts: any[];
  shares: any[];
  comments: any[];
  added: any[];
  calls: string[];
}

function sharedProject() {
  const now = new Date().toISOString();
  const floor = (id: string, name: string, level: number) => ({
    id, name, level, walls: [], rooms: [], doors: [], windows: [], furniture: [], stairs: [], columns: [],
    guides: [], measurements: [], annotations: [], textAnnotations: [], groups: [],
  });
  return { id: 'local1', name: 'Dom Kowalskich', floors: [floor('f1', 'Parter', 0), floor('f2', 'Piętro', 1)], activeFloorId: 'f1', createdAt: now, updatedAt: now };
}

async function fakeSupabase(page: Page, fake: Fake) {
  await page.addInitScript(({ url, key }) => {
    (globalThis as any).__PLANDOM_SUPABASE__ = { url, key };
    localStorage.setItem('hasSeenWelcome', 'true');
  }, { url: URL_BASE, key: KEY });

  const session = () => ({
    access_token: 'header.' + btoa(JSON.stringify({ sub: USER.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })) + '.sig',
    token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh',
    user: { ...USER, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [{ id: USER.id }], created_at: new Date().toISOString() },
  });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(body),
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' },
  });

  await page.route(`${URL_BASE}/**`, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return json(route, {});
    const url = new URL(request.url());
    const path = url.pathname;
    const body = request.postDataJSON?.() ?? null;
    const single = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    fake.calls.push(`${request.method()} ${path}`);

    if (path === '/auth/v1/token') {
      if (body?.password !== PASSWORD) return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return json(route, session());
    }
    if (path === '/auth/v1/user') return json(route, session().user);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });

    if (path === '/rest/v1/rpc/is_admin') return json(route, fake.admin);
    if (path === '/rest/v1/rpc/admin_overview') {
      if (!fake.admin) return json(route, { code: '42501', message: 'forbidden' }, 403);
      return json(route, {
        users: [{ email: USER.email, created_at: '2026-11-01T10:00:00Z', last_sign_in_at: '2026-11-08T09:00:00Z', confirmed: true, projects: 2, admin: true }],
        projects: 2, active_shares: 1, comments: 3,
        recent_comments: [{ author_name: 'Anna', body: 'Za mała kuchnia', created_at: '2026-11-07T12:00:00Z', project: 'Dom Kowalskich' }],
      });
    }
    if (path === '/rest/v1/rpc/get_shared_project') {
      if (body?.share_token !== TOKEN) return json(route, []);
      return json(route, [{ name: 'Dom Kowalskich', data: sharedProject(), updated_at: '2026-11-08T10:00:00Z', allow_comments: true, label: 'Dla architekta' }]);
    }
    if (path === '/rest/v1/rpc/get_share_comments') return json(route, body?.share_token === TOKEN ? fake.comments : []);
    if (path === '/rest/v1/rpc/add_share_comment') {
      fake.added.push(body);
      fake.comments.push({ id: `c${fake.comments.length + 1}`, author_name: body.author_name, body: body.body, floor_id: body.floor_id, x: body.x, y: body.y, resolved: false, created_at: new Date().toISOString() });
      return json(route, fake.comments.at(-1).id);
    }

    if (path === '/rest/v1/projects') {
      if (request.method() === 'POST') { fake.upserts.push(body); return json(route, single ? { id: 'row1' } : [{ id: 'row1' }], 201); }
      const row = fake.upserts.length ? { id: 'row1', updated_at: '2026-11-08T10:00:00Z' } : null;
      return json(route, single ? row : row ? [row] : []);
    }
    if (path === '/rest/v1/project_shares') {
      if (request.method() === 'POST') {
        const share = { token: TOKEN, label: body.label, allow_comments: body.allow_comments, expires_at: body.expires_at, revoked_at: null, created_at: new Date().toISOString() };
        fake.shares.unshift(share);
        return json(route, single ? share : [share], 201);
      }
      if (request.method() === 'PATCH') { Object.assign(fake.shares[0], body); return json(route, [], 200); }
      return json(route, fake.shares);
    }
    if (path === '/rest/v1/share_comments') {
      if (request.method() === 'PATCH') { const id = url.searchParams.get('id')?.replace('eq.', ''); Object.assign(fake.comments.find(c => c.id === id), body); return json(route, []); }
      return json(route, fake.comments.map(c => ({ ...c, token: TOKEN })));
    }
    return json(route, { message: `unexpected ${request.method()} ${path}` }, 404);
  });
}

const newFake = (over: Partial<Fake> = {}): Fake => ({ admin: false, upserts: [], shares: [], comments: [], added: [], calls: [], ...over });

test('signing in shows the account and, for an administrator, the admin panel', async ({ page }) => {
  const fake = newFake({ admin: true });
  await fakeSupabase(page, fake);
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Email' }).fill(USER.email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.');

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/konto$/);
  await expect(page.getByText(USER.email)).toBeVisible();
  await expect(page.getByText('Administrator')).toBeVisible();
  // The password never ends up in the address bar or in storage.
  expect(page.url()).not.toContain(PASSWORD);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(PASSWORD);

  await page.getByRole('link', { name: 'Admin panel' }).click();
  await expect(page.getByRole('heading', { name: 'Admin panel' })).toBeVisible();
  await expect(page.getByRole('cell', { name: USER.email })).toBeVisible();
  await expect(page.getByText('Za mała kuchnia')).toBeVisible();
});

test('a signed-in user who is not an administrator is turned away from the admin panel', async ({ page }) => {
  await fakeSupabase(page, newFake({ admin: false }));
  await page.goto('/logowanie?next=%2Fadmin');
  await page.getByRole('textbox', { name: 'Email' }).fill(USER.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('alert')).toHaveText('This account is not an administrator.');
});

test('the owner creates a review link from the editor and sees comments', async ({ page }) => {
  const fake = newFake({ comments: [{ id: 'c1', author_name: 'Anna', body: 'Okno w kuchni za małe', floor_id: 'f1', x: 100, y: 50, resolved: false, created_at: '2026-11-08T11:00:00Z' }] });
  await fakeSupabase(page, fake);
  await page.goto('/editor');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share' });
  await expect(dialog.getByRole('link', { name: 'Sign in' })).toBeVisible();

  // Sign in from the dialog and come back to the same project.
  await dialog.getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(USER.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/editor\?id=/);

  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByText(/Not shared yet/)).toBeVisible();
  await dialog.getByRole('textbox', { name: /For whom/ }).fill('Dla architekta');
  await dialog.getByRole('button', { name: 'Create link and copy' }).click();
  const links = dialog.getByRole('list', { name: 'Links' });
  await expect(links.getByRole('listitem')).toContainText('Dla architekta');
  await expect(links.getByRole('link', { name: 'Open' })).toHaveAttribute('href', new RegExp(`/podglad#${TOKEN}$`));
  expect(fake.upserts[0]).toMatchObject({ name: expect.any(String), data: { floors: expect.any(Array) } });
  expect(fake.upserts[0].local_id).toBe(new URL(page.url()).searchParams.get('id'));

  // Reopening reads the links and the reviewers' comments from the cloud.
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByText(/Reviewers see the version from/)).toBeVisible();
  await expect(dialog.getByRole('list', { name: 'Comments' })).toContainText('Okno w kuchni za małe');
  await dialog.getByRole('checkbox', { name: 'Done' }).check();
  await expect.poll(() => fake.comments[0].resolved).toBe(true);
});

test('a reviewer opens the link, cannot edit, and pins a comment to the plan', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const fake = newFake();
  await fakeSupabase(page, fake);
  await page.goto(`/podglad#${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Dom Kowalskich' })).toBeVisible();
  await expect(page.getByText('View only')).toBeVisible();
  await expect(page.getByRole('button', { name: /Draw Wall/ })).toHaveCount(0);

  const form = page.getByRole('form', { name: 'Add a comment' });
  await form.getByRole('button', { name: 'Add comment' }).click();
  await expect(form.getByRole('alert')).toHaveText('Enter your name and the comment.');

  await page.getByRole('combobox', { name: /floor/i }).selectOption('f2');
  await form.getByRole('textbox', { name: 'Your name' }).fill('Jan');
  await form.getByRole('textbox', { name: 'Comment' }).fill('Tu dałbym okno dachowe');
  await form.getByRole('button', { name: /Point at a place/ }).click();
  const canvas = page.locator('canvas[aria-label]').first();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(form.getByText(/Place chosen · Piętro/)).toBeVisible();
  await form.getByRole('button', { name: 'Add comment' }).click();
  await expect(form.getByRole('status')).toHaveText('Thanks, the comment was added.');

  expect(fake.added).toHaveLength(1);
  expect(fake.added[0]).toMatchObject({ share_token: TOKEN, author_name: 'Jan', body: 'Tu dałbym okno dachowe', floor_id: 'f2' });
  expect(typeof fake.added[0].x).toBe('number');
  await expect(page.getByRole('list', { name: 'Comments' }).getByRole('listitem')).toContainText('Tu dałbym okno dachowe');

  // Keyboard shortcuts and dragging on the plan change nothing, and nothing is ever saved.
  await canvas.focus();
  await page.keyboard.press('w');
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 260);
  await page.mouse.up();
  expect(fake.calls.filter(c => !c.startsWith('POST /rest/v1/rpc/'))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => !['hasSeenWelcome', 'plandom-reviewer-name', 'o3d_locale'].includes(k)))).toEqual([]);

  // The reviewer's name is remembered for the next comment.
  await page.reload();
  await expect(page.getByRole('form', { name: 'Add a comment' }).getByRole('textbox', { name: 'Your name' })).toHaveValue('Jan');
  expect(errors).toEqual([]);
});

test('a broken or revoked link explains what happened', async ({ page }) => {
  await fakeSupabase(page, newFake());
  await page.goto('/podglad#nope');
  await expect(page.getByRole('alert')).toContainText('This link does not work');
  await page.goto(`/podglad#${'f'.repeat(32)}`);
  await expect(page.getByRole('alert')).toContainText('This link does not work');
});

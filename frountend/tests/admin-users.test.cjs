const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function loadSource(relative, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')
    .replaceAll('import.meta.env', '{}');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, console, FormData, ...globals,
  });
  return exports;
}

function usersService(get) {
  return loadSource('src/services/admin-users.service.ts', { '@/lib/axios': { get } });
}

test('loads the full backend directory, including email and OTP accounts', async () => {
  const service = usersService(async (url, config) => {
    assert.equal(url, '/api/v1/admin/auth-users');
    assert.equal(config.timeout, 60000);
    return { data: [
      { id: 'email-user', email: 'reporter@example.test', full_name: 'Reporter', role: 'reporter', total_generations: 52 },
      { id: 'phone-user', phone_number: '+910000000000', name: 'Mobile Reporter', is_active_today: true },
    ] };
  });
  const users = await service.getAdminUsers();
  assert.equal(users.length, 2);
  assert.equal(users[0].full_name, 'Reporter');
  assert.equal(users[0].total_generations, 52);
  assert.equal(users[1].full_name, 'Mobile Reporter');
  assert.equal(users[1].is_active_today, true);
});

test('an empty backend list is authoritative, with no profile fallback', async () => {
  let requests = 0;
  const service = usersService(async () => { requests++; return { data: [] }; });
  assert.equal((await service.getAdminUsers()).length, 0);
  assert.equal(requests, 1);
});

for (const status of [401, 403, 404, 500]) {
  test(`HTTP ${status} is surfaced instead of returning partial users`, async () => {
    const error = Object.assign(new Error('Request failed'), { response: { status } });
    const service = usersService(async () => { throw error; });
    await assert.rejects(service.getAdminUsers(), err => err === error);
  });
}

test('rejects malformed responses', async () => {
  await assert.rejects(usersService(async () => ({ data: { error: 'unavailable' } })).getAdminUsers(), /invalid user list/);
});

test('expired bans are not displayed as currently blocked', async () => {
  const users = await usersService(async () => ({ data: [{ id: '1', banned_until: '2000-01-01T00:00:00Z' }] })).getAdminUsers();
  assert.equal(users[0].is_banned, false);
});

function apiHarness({ sessionId = 'admin', refreshError = null } = {}) {
  let state = { user: { id: 'admin' }, token: 'expired', logout() { state.user = null; } };
  let refreshes = 0;
  const store = { getState: () => state, setState: patch => { state = { ...state, ...patch }; } };
  const supabase = { auth: {
    getSession: async () => ({ data: { session: { user: { id: sessionId } } } }),
    refreshSession: async () => {
      refreshes++;
      return { data: { session: { user: { id: sessionId }, access_token: 'fresh' } }, error: refreshError };
    },
  } };
  const { default: api } = loadSource('src/lib/axios.ts', {
    axios, '@/store': { useAuthStore: store }, '@/lib/supabase': { supabase },
  }, {
    window: { location: { pathname: '/admin' } },
    localStorage: { getItem: () => JSON.stringify({ state }) },
  });
  const reject = (config, status) => Promise.reject(new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, config }));
  return { api, reject, store, refreshes: () => refreshes };
}

test('expired admin session refreshes and retries with the new token', async () => {
  const h = apiHarness();
  let calls = 0;
  h.api.defaults.adapter = config => {
    calls++;
    if (config.headers.Authorization === 'Bearer expired') return h.reject(config, 401);
    assert.equal(config.headers.Authorization, 'Bearer fresh');
    return Promise.resolve({ status: 200, data: [], config });
  };
  await h.api.get('/api/v1/admin/auth-users');
  assert.equal(calls, 2);
  assert.equal(h.refreshes(), 1);
  assert.equal(h.store.getState().token, 'fresh');
});

test('simultaneous unauthorized dashboard requests share one refresh', async () => {
  const h = apiHarness();
  h.api.defaults.adapter = config => config.headers.Authorization === 'Bearer expired'
    ? h.reject(config, 401) : Promise.resolve({ status: 200, data: [], config });
  await Promise.all([h.api.get('/api/v1/admin/auth-users'), h.api.get('/api/v1/admin/stats')]);
  assert.equal(h.refreshes(), 1);
});

test('OTP account is never replaced with a different Supabase identity', async () => {
  const h = apiHarness({ sessionId: 'other-account' });
  h.api.defaults.adapter = config => h.reject(config, 401);
  await assert.rejects(h.api.get('/api/v1/admin/auth-users'));
  assert.equal(h.refreshes(), 0);
  assert.equal(h.store.getState().token, 'expired');
});

test('forbidden requests do not refresh credentials or retry', async () => {
  const h = apiHarness();
  h.api.defaults.adapter = config => h.reject(config, 403);
  await assert.rejects(h.api.get('/api/v1/admin/auth-users'));
  assert.equal(h.refreshes(), 0);
});

test('rejected refreshed credentials do not cause a retry loop', async () => {
  const h = apiHarness();
  let calls = 0;
  h.api.defaults.adapter = config => { calls++; return h.reject(config, 401); };
  await assert.rejects(h.api.get('/api/v1/admin/auth-users'));
  assert.equal(calls, 2);
  assert.equal(h.refreshes(), 1);
});

test('invalid admin session is cleared instead of remaining persisted', async () => {
  const h = apiHarness();
  h.api.defaults.adapter = config => h.reject(config, 401);
  await assert.rejects(h.api.get('/api/v1/admin/auth-users'));
  assert.equal(h.store.getState().user, null);
});

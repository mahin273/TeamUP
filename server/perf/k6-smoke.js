import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export function setup() {
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({
      email: __ENV.EMAIL || 'demo@example.com',
      password: __ENV.PASSWORD || 'Str0ng!Pass123',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const json = res.json();
  const token = json?.accessToken || json?.data?.accessToken;
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const list = http.get(`${BASE}/projects?page=1&limit=20`, params);
  check(list, { 'projects 200': (r) => r.status === 200 });

  const search = http.get(`${BASE}/projects/search?domain=AI`, params);
  check(search, { 'search 200': (r) => r.status === 200 });

  const project = __ENV.PROJECT_ID;
  if (project) {
    const recs = http.get(`${BASE}/projects/${project}/recommendations`, params);
    check(recs, { 'recommendations 200': (r) => r.status === 200 });
    const tasks = http.get(`${BASE}/projects/${project}/tasks`, params);
    check(tasks, { 'tasks 200': (r) => r.status === 200 });
  }

  sleep(1);
}

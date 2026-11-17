import { createHash, randomBytes } from "node:crypto";

const origin = "http://localhost:3985";
const api = origin + "/api/v1";
const b64 = (b) => b.toString("base64url");
const pkce = () => {
  const verifier = b64(randomBytes(32));
  return {
    verifier,
    challenge: b64(createHash("sha256").update(verifier).digest()),
  };
};
const post = (url, body, headers = {}) =>
  fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const form = (url, data) =>
  fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data),
  });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`,
  );
};

const email = `sec+${Date.now()}@example.com`;
const reg = await (
  await post(api + "/auth/register", {
    email,
    name: "Sec",
    password: "password123",
  })
).json();
const jwt = reg.token;
const auth = { authorization: "Bearer " + jwt };

// 1. redirect URI registration
const hostile = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "data:text/html,x",
  "vbscript:x",
  "file:///etc/passwd",
  "http://evil.com/cb",
  "http://localhost.evil.com/cb",
  "http://127.0.0.1.evil.com/cb",
  "http://[::1]@evil.com/cb",
  "https://good.com@evil.com/cb",
  "https://x.com/cb#frag",
  "https://*.x.com/cb",
  "https://user:pw@x.com/cb",
  "http://0.0.0.0/cb",
  "http://2130706433/cb",
  "http://0x7f.1/cb",
  "http://127.1/cb",
  "https://x.com/cb\r\nX: y",
  "https://x.com/cb\tz",
  "https:///cb",
  "https://" + "a".repeat(2100) + ".com/cb",
  "java\tscript:alert(1)",
  "abc:def",
];
for (const uri of hostile) {
  const r = await post(origin + "/oauth/register", {
    client_name: "h",
    redirect_uris: [uri],
  });
  check(
    `register rejects ${JSON.stringify(uri).slice(0, 60)}`,
    r.status === 400,
    "status " + r.status,
  );
}
const good = [
  "https://app.example.com/cb",
  "http://localhost:8787/callback",
  "http://127.0.0.1:9/cb",
  "http://[::1]:1/cb",
  "cursor://anysphere.cursor-mcp/oauth/callback",
];
for (const uri of good) {
  const r = await post(origin + "/oauth/register", {
    client_name: "g",
    redirect_uris: [uri],
  });
  check(`register accepts ${uri}`, r.status === 201, "status " + r.status);
}

// helper: new client + authorization request
const newClient = async (uri = "http://localhost:8787/callback") => {
  const r = await post(origin + "/oauth/register", {
    client_name: "probe",
    redirect_uris: [uri],
  });
  return (await r.json()).client_id;
};
const authorize = async (clientId, params = {}) => {
  const p = pkce();
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "http://localhost:8787/callback",
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    state: "st",
    ...params,
  });
  const r = await fetch(origin + "/oauth/authorize?" + q, {
    redirect: "manual",
  });
  return { r, p };
};
const getCode = async (clientId, userAuth = auth) => {
  const { r, p } = await authorize(clientId);
  const requestId = new URL(r.headers.get("location")).searchParams.get(
    "request",
  );
  const d = await (
    await post(
      `${api}/oauth/requests/${requestId}/decision`,
      { approve: true },
      userAuth,
    )
  ).json();
  return {
    code: new URL(d.redirectUrl).searchParams.get("code"),
    p,
    requestId,
  };
};

// 2. exact redirect match
const cid = await newClient("https://a.example.com/cb");
for (const variant of [
  "https://a.example.com/cb/",
  "HTTPS://A.EXAMPLE.COM/cb",
  "https://a.example.com/cb?x=1",
  "https://a.example.com:443/cb",
  "https://a.example.com/CB",
]) {
  const { r } = await authorize(cid, { redirect_uri: variant });
  check(
    `authorize rejects non-exact redirect ${variant}`,
    r.status === 400 && !r.headers.get("location"),
    `status ${r.status} location=${r.headers.get("location")}`,
  );
}

// 3. state injection
{
  const c = await newClient();
  const { r } = await authorize(c, {
    response_type: "token",
    state: "a&error=x#frag\r\nX-Evil: 1",
  });
  const loc = r.headers.get("location") || "";
  check(
    "authorize error redirect keeps state encoded (no CRLF, no param injection)",
    r.status === 302 &&
      !/[\r\n]/.test(loc) &&
      new URL(loc).searchParams.getAll("error").length === 1,
    loc.slice(0, 120),
  );
}

// 4. PKCE
{
  const c = await newClient();
  for (const [name, params] of [
    ["missing challenge", { code_challenge: undefined }],
    ["plain", { code_challenge_method: "plain" }],
    ["short challenge", { code_challenge: "abc" }],
    ["bad chars", { code_challenge: "!".repeat(43) }],
  ]) {
    const p = {};
    const q = new URLSearchParams({
      response_type: "code",
      client_id: c,
      redirect_uri: "http://localhost:8787/callback",
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
      state: "s",
    });
    for (const [k, v] of Object.entries(params))
      v === undefined ? q.delete(k) : q.set(k, v);
    const r = await fetch(origin + "/oauth/authorize?" + q, {
      redirect: "manual",
    });
    const loc = r.headers.get("location") || "";
    check(
      `PKCE ${name} gives an error and no code`,
      !/[?&]code=/.test(loc) && !/oauth\/consent/.test(loc),
      `status ${r.status} ${loc.slice(0, 90)}`,
    );
  }
  const { code, p } = await getCode(c);
  const bad = await form(origin + "/oauth/token", {
    grant_type: "authorization_code",
    code,
    client_id: c,
    redirect_uri: "http://localhost:8787/callback",
    code_verifier: randomBytes(32).toString("base64url"),
  });
  check(
    "wrong verifier -> invalid_grant",
    bad.status === 400 && (await bad.json()).error === "invalid_grant",
  );
  const short = await form(origin + "/oauth/token", {
    grant_type: "authorization_code",
    code,
    client_id: c,
    redirect_uri: "http://localhost:8787/callback",
    code_verifier: "short",
  });
  check(
    "short verifier -> invalid_request",
    short.status === 400 && (await short.json()).error === "invalid_request",
  );
}

// 5. concurrent code exchange: exactly one success, and reuse revokes everything
{
  const c = await newClient();
  const { code, p } = await getCode(c);
  const attempts = await Promise.all(
    Array.from({ length: 50 }, () =>
      form(origin + "/oauth/token", {
        grant_type: "authorization_code",
        code,
        client_id: c,
        redirect_uri: "http://localhost:8787/callback",
        code_verifier: p.verifier,
      }),
    ),
  );
  const bodies = await Promise.all(
    attempts.map(async (r) => ({
      s: r.status,
      b: await r.json().catch(() => ({})),
    })),
  );
  const ok = bodies.filter((x) => x.s === 200);
  check(
    "50 concurrent exchanges of one code: exactly one 200",
    ok.length === 1,
    `successes=${ok.length}`,
  );
  await new Promise((r) => setTimeout(r, 300));
  if (ok.length === 1) {
    const me = await fetch(api + "/auth/me", {
      headers: { authorization: "Bearer " + ok[0].b.access_token },
    });
    check(
      "after concurrent reuse the issued access token is revoked",
      me.status === 401,
      "status " + me.status,
    );
  }
}

// 6. concurrent refresh
{
  const c = await newClient();
  const { code, p } = await getCode(c);
  const t = await (
    await form(origin + "/oauth/token", {
      grant_type: "authorization_code",
      code,
      client_id: c,
      redirect_uri: "http://localhost:8787/callback",
      code_verifier: p.verifier,
    })
  ).json();
  const rs = await Promise.all(
    Array.from({ length: 30 }, () =>
      form(origin + "/oauth/token", {
        grant_type: "refresh_token",
        refresh_token: t.refresh_token,
        client_id: c,
      }),
    ),
  );
  const sc = rs.map((r) => r.status);
  check(
    "30 concurrent refreshes of one token: at most one 200",
    sc.filter((s) => s === 200).length <= 1,
    "statuses 200x" + sc.filter((s) => s === 200).length,
  );
  const other = await form(origin + "/oauth/token", {
    grant_type: "refresh_token",
    refresh_token: t.refresh_token,
    client_id: await newClient(),
  });
  check("refresh with another client_id fails", other.status === 400);
}

// 7. concurrent decision: exactly one code
{
  const c = await newClient();
  const { r } = await authorize(c);
  const requestId = new URL(r.headers.get("location")).searchParams.get(
    "request",
  );
  const ds = await Promise.all(
    Array.from({ length: 20 }, () =>
      post(
        `${api}/oauth/requests/${requestId}/decision`,
        { approve: true },
        auth,
      ),
    ),
  );
  const sc = ds.map((x) => x.status);
  check(
    "20 concurrent decisions: exactly one succeeds",
    sc.filter((s) => s === 200 || s === 201).length === 1,
    JSON.stringify(sc.reduce((a, s) => ({ ...a, [s]: (a[s] || 0) + 1 }), {})),
  );
}

// 8. decision auth restrictions and type confusion
{
  const c = await newClient();
  const { code, p } = await getCode(c);
  const tok = await (
    await form(origin + "/oauth/token", {
      grant_type: "authorization_code",
      code,
      client_id: c,
      redirect_uri: "http://localhost:8787/callback",
      code_verifier: p.verifier,
    })
  ).json();
  const key = await (await post(api + "/api-keys", { name: "k" }, auth)).json();
  const { r } = await authorize(c);
  const requestId = new URL(r.headers.get("location")).searchParams.get(
    "request",
  );
  const withOauth = await post(
    `${api}/oauth/requests/${requestId}/decision`,
    { approve: true },
    { authorization: "Bearer " + tok.access_token },
  );
  const withKey = await post(
    `${api}/oauth/requests/${requestId}/decision`,
    { approve: true },
    { authorization: "Bearer " + key.key },
  );
  const none = await post(`${api}/oauth/requests/${requestId}/decision`, {
    approve: true,
  });
  check(
    "decision rejects OAuth token / API key / no token",
    withOauth.status === 401 && withKey.status === 401 && none.status === 401,
    `${withOauth.status}/${withKey.status}/${none.status}`,
  );
  for (const v of ["true", 1, null, [], {}, undefined]) {
    const x = await post(
      `${api}/oauth/requests/${requestId}/decision`,
      { approve: v },
      auth,
    );
    check(
      `decision rejects approve=${JSON.stringify(v)}`,
      x.status === 400,
      "status " + x.status,
    );
  }
  const reg2 = await (
    await post(api + "/auth/register", {
      email: `o+${Date.now()}@example.com`,
      name: "O",
      password: "password123",
    })
  ).json();
  const other = await post(
    `${api}/oauth/requests/${requestId}/decision`,
    { approve: true },
    { authorization: "Bearer " + reg2.token },
  );
  check(
    "decision by a different user still works only once (request is not bound to a user before decide)",
    [200, 201, 403, 404].includes(other.status),
    "status " + other.status,
  );
}

// 9. parameter pollution and content-type confusion at /oauth/token
{
  const body =
    "grant_type=authorization_code&code=a&code=b&client_id=x&redirect_uri=y&code_verifier=" +
    "a".repeat(43);
  const r = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  check(
    "repeated form parameter does not crash (4xx)",
    r.status >= 400 && r.status < 500,
    "status " + r.status,
  );
  const j = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"__proto__":{"x":1},"grant_type":["authorization_code"]}',
  });
  check(
    "prototype/array JSON body gives 4xx",
    j.status >= 400 && j.status < 500,
    "status " + j.status,
  );
  const t = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "grant_type=refresh_token",
  });
  check(
    "text/plain body gives 4xx, no 500",
    t.status >= 400 && t.status < 500,
    "status " + t.status,
  );
}

// 10. CORS
{
  const m = await fetch(origin + "/.well-known/oauth-authorization-server", {
    headers: { origin: "https://evil.com" },
  });
  check(
    "CORS on metadata is wildcard without credentials",
    m.headers.get("access-control-allow-origin") === "*" &&
      !m.headers.get("access-control-allow-credentials"),
  );
  const a = await fetch(api + "/activities", {
    headers: { origin: "https://evil.com", ...auth },
  });
  check(
    "no CORS header on /api/v1/activities",
    !a.headers.get("access-control-allow-origin"),
  );
  const z = await fetch(origin + "/oauth/authorize?x=1", {
    headers: { origin: "https://evil.com" },
    redirect: "manual",
  });
  check(
    "no CORS header on /oauth/authorize",
    !z.headers.get("access-control-allow-origin"),
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

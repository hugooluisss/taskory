// Run after `docker compose up -d --build --wait` with .env configured; cleans up with `docker compose down -v`.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const port = process.env.WEB_PORT ?? "8080";
const BASE = process.env.BASE ?? `http://localhost:${port}`;
const ISSUER = process.env.PUBLIC_URL;
const MCP_PATH = process.env.MCP_PATH ?? "/mcp";
const RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH === "/mcp" ? "" : MCP_PATH}`;
assert.ok(ISSUER, "PUBLIC_URL must be set");

async function request(path, options = {}) {
  const response = await fetch(new URL(path, BASE), {
    redirect: "manual",
    ...options,
  });
  return response;
}

async function json(response, status = 200) {
  assert.equal(
    response.status,
    status,
    `${response.url}: ${await response.clone().text()}`,
  );
  return response.json();
}

async function rpc(id, method, params, token) {
  const response = await request(MCP_PATH, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.text();
  const dataLine = body.split("\n").find((line) => line.startsWith("data: "));
  const data = dataLine ? dataLine.slice(6) : body;
  const result = JSON.parse(data);
  assert.equal(result.id, id);
  assert.ok(!result.error, JSON.stringify(result.error));
  return result.result;
}

const email = `compose-${randomBytes(6).toString("hex")}@example.com`;
const password = `Compose-${randomBytes(12).toString("hex")}`;
const user = await json(
  await request("/api/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name: "Compose E2E" }),
  }),
  201,
);
assert.ok(user.token);
const jwt = user.token;

const unauthenticated = await request(MCP_PATH, { method: "POST" });
assert.equal(unauthenticated.status, 401);
const challenge = unauthenticated.headers.get("www-authenticate");
assert.ok(challenge?.includes(`${ISSUER}${RESOURCE_METADATA_PATH}`), challenge);

const resourceMetadata = await json(await request(RESOURCE_METADATA_PATH));
assert.equal(resourceMetadata.resource, `${ISSUER}${MCP_PATH}`);
assert.ok(resourceMetadata.authorization_servers.includes(ISSUER));
const serverMetadata = await json(
  await request("/.well-known/oauth-authorization-server"),
);
assert.equal(serverMetadata.issuer, ISSUER);

const redirectUri = "http://127.0.0.1:8765/callback";
const client = await json(
  await request("/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Taskory Compose E2E",
      redirect_uris: [redirectUri],
    }),
  }),
  201,
);
assert.ok(client.client_id);

const verifier = randomBytes(32).toString("base64url");
const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(16).toString("hex");
const authorize = new URL("/oauth/authorize", BASE);
for (const [key, value] of Object.entries({
  response_type: "code",
  client_id: client.client_id,
  redirect_uri: redirectUri,
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
  state,
  resource: `${ISSUER}${MCP_PATH}`,
}))
  authorize.searchParams.set(key, value);
const authorization = await request(authorize);
assert.equal(authorization.status, 302);
const consentUrl = new URL(authorization.headers.get("location"));
assert.equal(consentUrl.origin, ISSUER);
assert.equal(consentUrl.pathname, "/oauth/consent");
const requestId = consentUrl.searchParams.get("request");
assert.ok(requestId);

const consent = await json(
  await request(`/api/v1/oauth/requests/${encodeURIComponent(requestId)}`, {
    headers: { authorization: `Bearer ${jwt}` },
  }),
);
assert.equal(consent.clientId, client.client_id);
const decision = await json(
  await request(
    `/api/v1/oauth/requests/${encodeURIComponent(requestId)}/decision`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ approve: true }),
    },
  ),
  201,
);
const callback = new URL(decision.redirectUrl);
assert.equal(callback.origin + callback.pathname, redirectUri);
assert.equal(callback.searchParams.get("state"), state);
assert.ok(
  callback.searchParams.get("iss"),
  "authorization response must contain issuer",
);

const tokenBody = new URLSearchParams({
  grant_type: "authorization_code",
  code: callback.searchParams.get("code"),
  code_verifier: verifier,
  client_id: client.client_id,
  redirect_uri: redirectUri,
  resource: `${ISSUER}${MCP_PATH}`,
});
const tokens = await json(
  await request("/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  }),
);
assert.ok(tokens.access_token?.startsWith("to_"));

const initialized = await rpc(
  1,
  "initialize",
  {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "taskory-compose-e2e", version: "1.0.0" },
  },
  tokens.access_token,
);
assert.ok(initialized.protocolVersion);
const listedTools = await rpc(2, "tools/list", {}, tokens.access_token);
assert.equal(listedTools.tools.length, 6);
assert.deepEqual(
  listedTools.tools.map((tool) => tool.name).sort(),
  [
    "delete_activity",
    "generate_report",
    "get_report",
    "list_activities",
    "log_activity",
    "update_activity",
  ].sort(),
);

const date = new Date().toISOString().slice(0, 10);
const referenceUrls = ["https://example.com/one", "https://example.org/two"];
const logged = await rpc(
  3,
  "tools/call",
  {
    name: "log_activity",
    arguments: { date, title: "Compose OAuth MCP E2E", referenceUrls },
  },
  tokens.access_token,
);
assert.ok(!logged.isError, JSON.stringify(logged));
const listed = await rpc(
  4,
  "tools/call",
  {
    name: "list_activities",
    arguments: { from: date, to: date },
  },
  tokens.access_token,
);
assert.ok(!listed.isError, JSON.stringify(listed));
assert.match(JSON.stringify(listed), /Compose OAuth MCP E2E/);

const activities = await json(
  await request("/api/v1/activities", {
    headers: { authorization: `Bearer ${jwt}` },
  }),
);
const activity = activities.items.find(
  (item) => item.title === "Compose OAuth MCP E2E",
);
assert.ok(activity, "logged activity must appear in the user's API list");
assert.deepEqual(activity.referenceUrls, referenceUrls);
const consentPage = await request(process.env.CONSENT_PATH ?? "/oauth/consent");
assert.equal(consentPage.status, 200);
assert.match(consentPage.headers.get("content-type"), /text\/html/);
assert.match(
  consentPage.headers.get("content-security-policy"),
  /frame-ancestors 'none'/,
);
assert.equal(consentPage.headers.get("x-frame-options"), "DENY");

console.log("PASS: register user and protected resource challenge");
console.log(
  "PASS: OAuth discovery, DCR, PKCE authorization, consent and token exchange",
);
console.log(
  "PASS: MCP initialize, tools/list (6 tools), log_activity and list_activities",
);
console.log(
  "PASS: API activity has both reference URLs; /oauth/consent serves SPA HTML",
);

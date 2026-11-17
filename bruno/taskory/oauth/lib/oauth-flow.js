const CryptoJS = require("crypto-js");
const axios = require("axios");

const redirectUri = "http://localhost:8787/callback";

function urls(bru) {
  const api = bru.getEnvVar("baseUrl").replace(/\/$/, "");
  return { api, origin: api.replace(/\/api\/v1$/, "") };
}

async function registerUser(bru, api) {
  const suffix = Date.now() + "-" + Math.random().toString(36).slice(2);
  const response = await bru.sendRequest({
    method: "POST",
    url: api + "/auth/register",
    headers: { "Content-Type": "application/json" },
    data: { email: "oauth+" + suffix + "@example.com", name: "OAuth test user", password: bru.getEnvVar("password") || "strong-password-123" }
  });
  return { token: response.data.token, suffix };
}

async function registerClient(bru, origin, suffix) {
  const response = await bru.sendRequest({
    method: "POST",
    url: origin + "/oauth/register",
    headers: { "Content-Type": "application/json" },
    data: { client_name: "Bruno OAuth " + suffix, redirect_uris: [redirectUri] }
  });
  return { id: response.data.client_id, name: "Bruno OAuth " + suffix };
}

function setFormBody(request, values) {
  // Bruno CLI 4.2.0 sends empty form-urlencoded blocks, so set the raw encoded body.
  request.setBody(formBody(values), { raw: true });
}

function queryParam(url, name) {
  const query = url.split("?")[1]?.split("#")[0] || "";
  const entry = query.split("&").find((part) => part.split("=")[0] === encodeURIComponent(name));
  return entry ? decodeURIComponent(entry.slice(entry.indexOf("=") + 1).replace(/\+/g, " ")) : null;
}

function formBody(values) {
  return Object.keys(values)
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(values[key]))
    .join("&");
}

function pkcePair() {
  const verifier = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64)
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const challenge = CryptoJS.SHA256(verifier).toString(CryptoJS.enc.Base64)
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return { verifier, challenge };
}

async function createRequest(bru, origin, client, pair, state) {
  const query = formBody({
    response_type: "code",
    client_id: client.id,
    redirect_uri: redirectUri,
    code_challenge: pair.challenge,
    code_challenge_method: "S256",
    state
  });
  const response = await axios.get(origin + "/oauth/authorize?" + query, {
    maxRedirects: 0,
    validateStatus: null
  });
  const requestId = queryParam(response.headers.location, "request");
  return { id: requestId, state };
}

async function decide(bru, api, user, request, approve) {
  const response = await bru.sendRequest({
    method: "POST",
    url: api + "/oauth/requests/" + request.id + "/decision",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + user.token },
    data: { approve }
  });
  return response.data.redirectUrl;
}

async function exchangeCode(bru, origin, client, request, pair, code) {
  const response = await bru.sendRequest({
    method: "POST",
    url: origin + "/oauth/token",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: formBody({
      grant_type: "authorization_code",
      code,
      client_id: client.id,
      redirect_uri: redirectUri,
      code_verifier: pair.verifier
    })
  });
  return response.data;
}

async function refresh(bru, origin, client, token) {
  const response = await bru.sendRequest({
    method: "POST",
    url: origin + "/oauth/token",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: formBody({ grant_type: "refresh_token", refresh_token: token, client_id: client.id })
  });
  return response;
}

async function checkAccess(bru, api, token) {
  try {
    return await axios.get(api + "/auth/me", { headers: { Authorization: "Bearer " + token }, validateStatus: null });
  } catch (error) {
    if (!error.response) throw error;
    return error.response;
  }
}

async function revoke(bru, origin, client, token) {
  return bru.sendRequest({
    method: "POST",
    url: origin + "/oauth/revoke",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: formBody({ token, client_id: client.id })
  });
}

async function prepare(bru, mode) {
  const { api, origin } = urls(bru);
  const user = await registerUser(bru, api);
  const client = await registerClient(bru, origin, user.suffix);
  const pair = pkcePair();
  if (mode === "client") return { api, origin, user, client, pair };
  const request = await createRequest(bru, origin, client, pair, "bruno-" + user.suffix);
  if (mode === "request") return { api, origin, user, client, pair, request };
  const redirect = await decide(bru, api, user, request, true);
  const code = queryParam(redirect, "code");
  if (mode === "code") return { api, origin, user, client, pair, request, code };
  const tokens = await exchangeCode(bru, origin, client, request, pair, code);
  return { api, origin, user, client, pair, request, code, tokens };
}

module.exports = { redirectUri, urls, registerUser, registerClient, pkcePair, formBody, queryParam, setFormBody, createRequest, decide, exchangeCode, refresh, revoke, checkAccess, prepare };

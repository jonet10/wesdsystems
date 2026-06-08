const MONCASH_MODE_RAW = (process.env.MONCASH_MODE || process.env.MONCASH_ENVIRONMENT || "live").toLowerCase();
const MONCASH_MODE = MONCASH_MODE_RAW.startsWith("san") ? "sandbox" : MONCASH_MODE_RAW;

const MONCASH_HOST_REST_API = MONCASH_MODE === "sandbox"
  ? "https://sandbox.moncashbutton.digicelgroup.com/Api"
  : "https://moncashbutton.digicelgroup.com/Api";

const MONCASH_GATEWAY_BASE = MONCASH_MODE === "sandbox"
  ? "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware"
  : "https://moncashbutton.digicelgroup.com/Moncash-middleware";

const MONCASH_CLIENT_ID = process.env.MONCASH_CLIENT_ID || "";
const MONCASH_CLIENT_SECRET = process.env.MONCASH_CLIENT_SECRET || "";
const MONCASH_BUSINESS_KEY = process.env.MONCASH_BUSINESS_KEY || "";

const MONCASH_FETCH_TIMEOUT = 30000;

let cachedToken: { value: string; expiresAt: number } | null = null;

const requireCredentials = () => {
  if (!MONCASH_CLIENT_ID || !MONCASH_CLIENT_SECRET || !MONCASH_BUSINESS_KEY) {
    throw new Error("Les identifiants MonCash ne sont pas configurés.");
  }
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = MONCASH_FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const toJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export async function getMonCashAccessToken() {
  requireCredentials();
  console.log(`[MonCash] Starting OAuth request in ${MONCASH_MODE} mode...`);

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    console.log(`[MonCash] Using cached OAuth token.`);
    return cachedToken.value;
  }

  const auth = Buffer.from(`${MONCASH_CLIENT_ID}:${MONCASH_CLIENT_SECRET}`).toString("base64");
  const response = await fetchWithTimeout(`${MONCASH_HOST_REST_API}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      scope: "read,write",
      grant_type: "client_credentials",
    }),
  });

  const payload = await toJson(response);
  if (!response.ok) {
    console.error(`[MonCash] OAuth error HTTP ${response.status}:`, payload);
    throw new Error(payload?.message || payload?.error_description || "Impossible d'obtenir le token MonCash.");
  }

  const token = String(payload?.access_token || "");
  const expiresIn = Number(payload?.expires_in || 0);
  if (!token) {
    console.error(`[MonCash] OAuth failed, no token in payload:`, payload);
    throw new Error("Token MonCash introuvable.");
  }

  console.log(`[MonCash] OAuth token successfully obtained.`);

  cachedToken = {
    value: token,
    expiresAt: Date.now() + Math.max(0, expiresIn - 30) * 1000,
  };

  return token;
}

export async function createMonCashPayment(orderId: string, amount: number) {
  const accessToken = await getMonCashAccessToken();

  console.log(`[MonCash] Sending CreatePayment request for orderId: ${orderId}, amount: ${amount}`);
  const response = await fetchWithTimeout(`${MONCASH_HOST_REST_API}/v1/CreatePayment`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      orderId,
    }),
  });

  const payload = await toJson(response);
  if (!response.ok && response.status !== 202) {
    console.error(`[MonCash] CreatePayment error HTTP ${response.status}:`, payload);
    throw new Error(payload?.message || payload?.error || "Impossible de créer le paiement MonCash.");
  }

  const token = payload?.payment_token?.token;
  if (!token) {
    console.error(`[MonCash] CreatePayment failed, no token in payload:`, payload);
    throw new Error("MonCash n'a pas renvoyé de jeton de paiement.");
  }

  console.log(`[MonCash] CreatePayment successful, payment_token received.`);

  return {
    raw: payload,
    redirectUrl: `${MONCASH_GATEWAY_BASE}/Payment/Redirect?token=${encodeURIComponent(token)}`,
  };
}

export async function retrieveMonCashTransaction(input: { transactionId?: string | null; orderId?: string | null }) {
  const accessToken = await getMonCashAccessToken();

  const hasTransactionId = Boolean(input.transactionId);
  const endpoint = hasTransactionId ? "/v1/RetrieveTransactionPayment" : "/v1/RetrieveOrderPayment";
  const body = hasTransactionId ? { transactionId: input.transactionId } : { orderId: input.orderId };

  console.log(`[MonCash] Sending ${hasTransactionId ? "RetrieveTransaction" : "RetrieveOrder"} request...`);

  const response = await fetchWithTimeout(`${MONCASH_HOST_REST_API}${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await toJson(response);
  if (!response.ok) {
    console.error(`[MonCash] Retrieve request error HTTP ${response.status}:`, payload);
    throw new Error(payload?.message || payload?.error || "Impossible de récupérer les détails du paiement MonCash.");
  }

  console.log(`[MonCash] Retrieve request successful, status:`, payload?.status);

  return payload;
}

export function getMonCashBusinessKey() {
  requireCredentials();
  return MONCASH_BUSINESS_KEY;
}

export function getMonCashEnvironment() {
  return MONCASH_MODE;
}


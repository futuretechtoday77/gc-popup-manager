// Shopify Admin API client (client-credentials grant).
//
// Secrets are read ONLY from process.env and are never returned to callers,
// logged in full, or placed in any public payload. Every external call is
// bounded by an AbortController timeout. On THROTTLED we surface the error and
// never retry inside the request path.
import { randomInt, createHash } from "crypto";
import { getRedis } from "./redis";
import type { DiscountOffer } from "./types";

const DEFAULT_API_VERSION = "2026-10";
const TOKEN_KEY = "gcpm:shopify:token";

// Every discount GCPM creates carries this title prefix. Cleanup requires it
// before deleting anything (so we never touch the store's ~400 other codes).
export const GCPM_TITLE_PREFIX = "GCPM · ";

// Timeouts (ms).
const TOKEN_TIMEOUT_MS = 4000;
const CREATE_TIMEOUT_MS = 4000;
const QUERY_TIMEOUT_MS = 4000;

interface ShopifyEnv {
  domain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
}

export function shopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
      process.env.SHOPIFY_CLIENT_ID &&
      process.env.SHOPIFY_CLIENT_SECRET,
  );
}

function env(): ShopifyEnv {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) {
    throw new Error("Shopify is not configured (missing SHOPIFY_* env vars)");
  }
  return {
    domain,
    clientId,
    clientSecret,
    apiVersion: process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---- Access token (client credentials grant) ----

let memToken: { token: string; exp: number } | null = null;

async function fetchNewToken(
  e: ShopifyEnv,
): Promise<{ token: string; ttl: number }> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: e.clientId,
    client_secret: e.clientSecret,
  });
  const res = await fetchWithTimeout(
    `https://${e.domain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    },
    TOKEN_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new Error(`Shopify token request failed (${res.status})`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("Shopify token response missing access_token");
  }
  const expiresIn =
    typeof json.expires_in === "number" && json.expires_in > 0
      ? json.expires_in
      : 86399;
  // Refresh 10 minutes before expiry.
  return { token: json.access_token, ttl: Math.max(60, expiresIn - 600) };
}

async function getAccessToken(opts?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const e = env();
  const now = Date.now();
  if (!opts?.forceRefresh && memToken && memToken.exp > now + 5000) {
    return memToken.token;
  }
  const redis = getRedis();
  if (!opts?.forceRefresh) {
    const cached = await redis.get<string>(TOKEN_KEY);
    if (cached && typeof cached === "string") {
      // We don't know the exact remaining TTL from a bare GET; keep the module
      // cache short so we re-check Redis periodically.
      memToken = { token: cached, exp: now + 60_000 };
      return cached;
    }
  }
  const { token, ttl } = await fetchNewToken(e);
  memToken = { token, exp: now + ttl * 1000 };
  await redis.set(TOKEN_KEY, token, { ex: ttl });
  return token;
}

// ---- GraphQL ----

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  extensions?: {
    cost?: { throttleStatus?: { currentlyAvailable?: number } };
  };
}

function isThrottled(body: GraphQLResponse<unknown>): boolean {
  return Boolean(
    body.errors?.some((err) => err?.extensions?.code === "THROTTLED"),
  );
}

async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  timeoutMs: number,
): Promise<GraphQLResponse<T>> {
  const e = env();
  const url = `https://${e.domain}/admin/api/${e.apiVersion}/graphql.json`;
  const run = (token: string) =>
    fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
      },
      timeoutMs,
    );

  let token = await getAccessToken();
  let res = await run(token);
  // On a 401 drop the cached token, refetch once, retry once.
  if (res.status === 401) {
    memToken = null;
    token = await getAccessToken({ forceRefresh: true });
    res = await run(token);
  }
  if (!res.ok) {
    throw new Error(`Shopify GraphQL HTTP ${res.status}`);
  }
  const body = (await res.json()) as GraphQLResponse<T>;
  if (isThrottled(body)) {
    // Do not retry inside the request path.
    throw new Error("Shopify GraphQL throttled");
  }
  if (body.errors && body.errors.length > 0) {
    throw new Error(
      `Shopify GraphQL errors: ${body.errors
        .map((err) => err?.message || "unknown")
        .join("; ")}`,
    );
  }
  return body;
}

// ---- Code generation ----

// Unambiguous character set (no O/0, I/1, L, etc.).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Generate a code: validated/uppercased prefix + 6 chars from the unambiguous
// set using crypto.randomInt.
export function generateCode(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${prefix}${suffix}`;
}

export function emailHash8(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 8);
}

// ---- Discount create ----

function money(n: number): string {
  return n.toFixed(2);
}

function buildDiscountInput(params: {
  popupId: string;
  emailHash: string;
  code: string;
  startsAt: string;
  endsAt: string;
  offer: DiscountOffer;
}): Record<string, unknown> {
  const { offer } = params;

  const customerValue =
    offer.type === "percent"
      ? { percentage: offer.value / 100 }
      : {
          discountAmount: {
            amount: money(offer.value),
            appliesOnEachItem: offer.appliesOnEachItem,
          },
        };

  let items: Record<string, unknown>;
  if (offer.appliesTo === "all") {
    items = { all: true };
  } else if (offer.appliesTo === "collections") {
    items = { collections: { add: offer.collectionIds } };
  } else {
    const productsToAdd = offer.productIds.filter(
      (id) => id.includes("/Product/") && !id.includes("/ProductVariant/"),
    );
    const productVariantsToAdd = offer.productIds.filter((id) =>
      id.includes("/ProductVariant/"),
    );
    items = { products: { productsToAdd, productVariantsToAdd } };
  }

  const minimumRequirement =
    offer.minSubtotal != null
      ? {
          subtotal: {
            greaterThanOrEqualToSubtotal: money(offer.minSubtotal),
          },
        }
      : null;

  return {
    title: `${GCPM_TITLE_PREFIX}${params.popupId} · ${params.emailHash}`,
    code: params.code,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    customerSelection: { all: true },
    customerGets: { value: customerValue, items },
    minimumRequirement,
    usageLimit: 1,
    appliesOncePerCustomer: true,
    combinesWith: {
      productDiscounts: offer.combinesWithProduct,
      orderDiscounts: true,
      shippingDiscounts: true,
    },
  };
}

const CREATE_MUTATION = `
mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
    codeDiscountNode { id }
    userErrors { field code message }
  }
}`;

interface CreateResult {
  ok: boolean;
  discountId?: string;
  collision?: boolean;
  error?: string;
}

function isCollision(
  userErrors: Array<{ code?: string | null; message?: string | null }>,
): boolean {
  return userErrors.some((err) => {
    const code = (err.code || "").toUpperCase();
    const msg = (err.message || "").toLowerCase();
    return (
      code === "TAKEN" ||
      code === "DUPLICATE" ||
      msg.includes("already") ||
      msg.includes("taken")
    );
  });
}

// Create a single-use discount code. Returns collision:true when the code was
// already taken so the caller can regenerate and retry once.
export async function createDiscountCode(params: {
  popupId: string;
  emailHash: string;
  code: string;
  startsAt: string;
  endsAt: string;
  offer: DiscountOffer;
}): Promise<CreateResult> {
  try {
    const input = buildDiscountInput(params);
    const body = await shopifyGraphQL<{
      discountCodeBasicCreate: {
        codeDiscountNode: { id: string } | null;
        userErrors: Array<{
          field?: string[] | null;
          code?: string | null;
          message?: string | null;
        }>;
      };
    }>(CREATE_MUTATION, { basicCodeDiscount: input }, CREATE_TIMEOUT_MS);

    const payload = body.data?.discountCodeBasicCreate;
    const userErrors = payload?.userErrors ?? [];
    if (userErrors.length > 0) {
      if (isCollision(userErrors)) return { ok: false, collision: true };
      return {
        ok: false,
        error: userErrors
          .map((err) => err.message || err.code || "unknown")
          .join("; "),
      };
    }
    const id = payload?.codeDiscountNode?.id;
    if (!id) return { ok: false, error: "No discount node id returned" };
    return { ok: true, discountId: id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---- First-order check ----

const CUSTOMER_QUERY = `
query customerOrders($q: String!) {
  customers(first: 1, query: $q) {
    nodes { id numberOfOrders }
  }
}`;

// Returns the customer's order count, or null when the check itself fails or
// times out (caller fails open and issues the code anyway).
export async function countCustomerOrders(email: string): Promise<number | null> {
  try {
    const q = `email:"${email.replace(/"/g, '\\"')}"`;
    const body = await shopifyGraphQL<{
      customers: { nodes: Array<{ id: string; numberOfOrders: string }> };
    }>(CUSTOMER_QUERY, { q }, QUERY_TIMEOUT_MS);
    const node = body.data?.customers?.nodes?.[0];
    if (!node) return 0;
    const n = Number(node.numberOfOrders);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

// ---- Title lookup + delete (cleanup) ----

const NODE_TITLE_QUERY = `
query discountTitle($id: ID!) {
  codeDiscountNode(id: $id) {
    codeDiscount {
      ... on DiscountCodeBasic { title }
    }
  }
}`;

// Returns { exists, title }. exists=false means Shopify no longer has it.
export async function getDiscountTitle(
  id: string,
): Promise<{ exists: boolean; title: string | null }> {
  const body = await shopifyGraphQL<{
    codeDiscountNode: { codeDiscount: { title?: string } | null } | null;
  }>(NODE_TITLE_QUERY, { id }, QUERY_TIMEOUT_MS);
  const node = body.data?.codeDiscountNode;
  if (!node) return { exists: false, title: null };
  const title = node.codeDiscount?.title ?? null;
  return { exists: true, title };
}

const DELETE_MUTATION = `
mutation discountCodeDelete($id: ID!) {
  discountCodeDelete(id: $id) {
    deletedCodeDiscountId
    userErrors { field code message }
  }
}`;

export async function deleteDiscount(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const body = await shopifyGraphQL<{
    discountCodeDelete: {
      deletedCodeDiscountId: string | null;
      userErrors: Array<{ message?: string | null; code?: string | null }>;
    };
  }>(DELETE_MUTATION, { id }, QUERY_TIMEOUT_MS);
  const payload = body.data?.discountCodeDelete;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0) {
    return {
      ok: false,
      error: userErrors.map((e) => e.message || e.code || "unknown").join("; "),
    };
  }
  return { ok: Boolean(payload?.deletedCodeDiscountId) };
}

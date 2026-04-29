import type { IncomingMessage, ServerResponse } from "node:http";

type HuntProxyPayload = {
  endpoint?: string;
  token?: string;
  payload?: string;
};

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/g, "");
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function readJsonBody(req: IncomingMessage): Promise<HuntProxyPayload> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as HuntProxyPayload;
}

function writeJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function validateSharedInput(input: HuntProxyPayload): { endpoint: string; token: string } {
  const endpoint = input.endpoint?.trim();
  const token = input.token?.trim();

  if (!endpoint || !token) {
    throw new Error("Missing endpoint or token");
  }

  return {
    endpoint: normalizeEndpoint(endpoint),
    token,
  };
}

export async function proxyHuntHealthCheck(endpoint: string, token: string): Promise<void> {
  const response = await fetch(`${normalizeEndpoint(endpoint)}/api/health`, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Endpoint returned ${response.status}`);
  }
}

export async function proxyHuntForward(
  endpoint: string,
  token: string,
  payload: string,
): Promise<void> {
  const response = await fetch(`${normalizeEndpoint(endpoint)}/api/mobile`, {
    method: "POST",
    headers: authHeaders(token),
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Hunt forward failed: ${response.status}`);
  }
}

export async function handleHuntHealthProxy(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const { endpoint, token } = validateSharedInput(await readJsonBody(req));
    await proxyHuntHealthCheck(endpoint, token);
    writeJson(res, 200, { ok: true });
  } catch (error) {
    writeJson(res, 400, {
      error: error instanceof Error ? error.message : "Unknown hunt health proxy error",
    });
  }
}

export async function handleHuntForwardProxy(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const { endpoint, token } = validateSharedInput(input);

    if (!input.payload?.trim()) {
      throw new Error("Missing hunt payload");
    }

    await proxyHuntForward(endpoint, token, input.payload);
    writeJson(res, 200, { ok: true });
  } catch (error) {
    writeJson(res, 400, {
      error: error instanceof Error ? error.message : "Unknown hunt forward proxy error",
    });
  }
}

import { normalizeHuntEndpoint } from "./utils.ts";

type HuntProxyResponse = {
  error?: string;
};

async function readProxyResponse(response: Response): Promise<HuntProxyResponse> {
  try {
    return (await response.json()) as HuntProxyResponse;
  } catch {
    return {};
  }
}

export async function validateHuntEndpoint(endpoint: string, token: string): Promise<void> {
  const response = await fetch("/api/hunt/health", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: normalizeHuntEndpoint(endpoint),
      token,
    }),
  });

  if (!response.ok) {
    const body = await readProxyResponse(response);
    throw new Error(body.error ?? `Endpoint returned ${response.status}`);
  }
}

export async function forwardHuntPayload(
  endpoint: string,
  token: string,
  payload: string,
): Promise<void> {
  const response = await fetch("/api/hunt/forward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: normalizeHuntEndpoint(endpoint),
      token,
      payload,
    }),
  });

  if (!response.ok) {
    const body = await readProxyResponse(response);
    throw new Error(body.error ?? `Hunt forward failed: ${response.status}`);
  }
}

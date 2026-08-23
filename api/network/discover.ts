import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNetworkDiscoveryProxy } from "../../packages/web/server/networkDiscovery";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleNetworkDiscoveryProxy(req, res);
}

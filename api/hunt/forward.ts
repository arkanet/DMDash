import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHuntForwardProxy } from "../../packages/web/server/huntProxy";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHuntForwardProxy(req, res);
}

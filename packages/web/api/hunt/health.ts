import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHuntHealthProxy } from "../../server/huntProxy";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHuntHealthProxy(req, res);
}

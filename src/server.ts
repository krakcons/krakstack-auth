import "./instrumentation";

import { paraglideMiddleware } from "./paraglide/server.js";
import handler from "@tanstack/react-start/server-entry";
import { initializeApi, disposeApi } from "./api-handler.server";

await initializeApi();

export default {
  dispose: disposeApi,
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
};

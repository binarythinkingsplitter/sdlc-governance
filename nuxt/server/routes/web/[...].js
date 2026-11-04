/**
 * =========================================================================
 * module: nuxt/server/routes/web/[...].js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: nuxt nitro catch-all route mounting all @mastra/factory /web/* endpoints
 * verbose: forwards /web/config/features, /web/factory/projects, /web/factory/projects/:id/boards,
 * /web/factory/projects/:id/work-items, /web/workspace/*, and /web/fs/* to MastraFactory.
 *
 * section: arguments
 * - event (object): nuxt h3 event
 *
 * section: return value
 * - response (promise<any>): mastra software factory route response
 *
 * section: example
 * // GET /web/config/features -> { factory: true }
 * =========================================================================
 */

import { use_sdlc_mastra_runtime } from '../../utils/harness.js';

export default async function nuxt_mastra_factory_web_route(event) {
  const { api_handler } = await use_sdlc_mastra_runtime();
  return api_handler(event);
}

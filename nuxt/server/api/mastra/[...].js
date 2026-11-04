/**
 * =========================================================================
 * module: nuxt/server/api/mastra/[...].js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: nuxt nitro catch-all route mounting all 428 @mastra/server routes and /sdlc/* governance endpoints
 * verbose: forwards all /api/mastra/** requests to the standalone dual-engine mastra server adapter.
 *
 * section: arguments
 * - event (object): nuxt h3 event
 *
 * section: return value
 * - response (promise<any>): mastra server route response
 *
 * section: example
 * // GET /api/mastra/agents -> returns all 8 registered dual-engine agents
 * =========================================================================
 */

import { use_sdlc_mastra_runtime } from '../../utils/harness.js';

export default async function nuxt_mastra_api_route(event) {
  const { api_handler } = await use_sdlc_mastra_runtime();
  return api_handler(event);
}

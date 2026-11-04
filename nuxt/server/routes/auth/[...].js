/**
 * =========================================================================
 * module: nuxt/server/routes/auth/[...].js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: nuxt nitro catch-all route mounting @mastra/factory /auth/* endpoints
 * verbose: forwards /auth/me and related authentication probes to the MastraFactory server adapter.
 *
 * section: arguments
 * - event (object): nuxt h3 event
 *
 * section: return value
 * - response (promise<any>): mastra software factory auth response
 *
 * section: example
 * // GET /auth/me -> returns authenticated sdlc operator profile
 * =========================================================================
 */

import { use_sdlc_mastra_runtime } from '../../utils/harness.js';

export default async function nuxt_mastra_factory_auth_route(event) {
  const { api_handler } = await use_sdlc_mastra_runtime();
  return api_handler(event);
}

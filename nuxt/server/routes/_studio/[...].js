/**
 * =========================================================================
 * module: nuxt/server/routes/_studio/[...].js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: nuxt nitro route serving the Mastra Studio SPA and static assets under /_studio
 * verbose: serves hydrated index.html, static js/css/svg bundles from mastra/dist/studio,
 * and /_studio/refresh-events sse stream.
 *
 * section: arguments
 * - event (object): nuxt h3 event
 *
 * section: return value
 * - response (promise<string|Buffer>): studio html or asset buffer
 *
 * section: example
 * // GET /_studio -> returns Mastra Studio SPA
 * =========================================================================
 */

import { use_sdlc_mastra_runtime } from '../../utils/harness.js';

export default async function nuxt_mastra_studio_route(event) {
  const { asset_handler } = await use_sdlc_mastra_runtime();
  return asset_handler.handle_nuxt_event(event);
}

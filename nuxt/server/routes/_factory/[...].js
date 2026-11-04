/**
 * =========================================================================
 * module: nuxt/server/routes/_factory/[...].js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: nuxt nitro route serving the Mastra Software Factory SPA and static assets under /_factory
 * verbose: serves hydrated index.html and static js/css/svg bundles from mastra/dist/factory.
 *
 * section: arguments
 * - event (object): nuxt h3 event
 *
 * section: return value
 * - response (promise<string|Buffer>): factory html or asset buffer
 *
 * section: example
 * // GET /_factory -> returns Mastra Software Factory SPA
 * =========================================================================
 */

import { use_sdlc_mastra_runtime } from '../../utils/harness.js';

export default async function nuxt_mastra_factory_spa_route(event) {
  const { asset_handler } = await use_sdlc_mastra_runtime();
  return asset_handler.handle_nuxt_event(event);
}

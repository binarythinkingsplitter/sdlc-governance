/**
 * =========================================================================
 * module: nuxt/module.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: standalone nuxt 4 module entrypoint for @thing/sdlc-dual_engine_harness
 * verbose: exports the nuxt 4 module registered by create_nuxt_mastra_module, mounting
 * /api/mastra/**, /web/**, /auth/**, /_studio/**, and /_factory/** plus devtools tabs.
 *
 * section: arguments
 * - inline_options (object, optional): nuxt module options
 * - nuxt (object, optional): nuxt instance
 *
 * section: return value
 * - module_meta (object): configured nuxt module descriptor
 *
 * section: example
 * // in nuxt.config.js:
 * export default { modules: ['./nuxt/module.js'] };
 * =========================================================================
 */

import { create_nuxt_mastra_module } from '../src/NuxtMastraStudio.js';

export const sdlc_mastra_nuxt_module = create_nuxt_mastra_module();

export default sdlc_mastra_nuxt_module;

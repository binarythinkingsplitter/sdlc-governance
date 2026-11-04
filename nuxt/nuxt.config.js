/**
 * =========================================================================
 * module: nuxt/nuxt.config.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: standalone nuxt 4 configuration for the dual-engine harness, mastra studio, and software factory
 * verbose: configures nuxt 4 with the standalone @thing/sdlc-dual_engine_harness module, mounting
 * all 428 @mastra/server routes (/api/mastra/**), 100 @mastra/factory routes (/web/**, /auth/**),
 * mastra studio spa (/_studio), and mastra software factory spa (/_factory).
 *
 * section: arguments
 * none
 *
 * section: return value
 * - config (object): nuxt 4 configuration object
 *
 * section: example
 * import config from './nuxt/nuxt.config.js';
 * =========================================================================
 */

import { create_nuxt_mastra_module } from '../src/NuxtMastraStudio.js';

export default {
  compatibilityDate: '2026-01-01',
  devtools: { enabled: true },
  modules: [
    create_nuxt_mastra_module({
      api_prefix: '/api/mastra',
      studio_base_path: '/_studio',
      factory_base_path: '/_factory',
      enable_studio: true,
      enable_factory: true
    })
  ],
  runtimeConfig: {
    mastra: {
      session_id: 'nuxt-sdlc-studio',
      api_prefix: '/api/mastra',
      studio_base_path: '/_studio',
      factory_base_path: '/_factory'
    },
    public: {
      mastra: {
        api_prefix: '/api/mastra',
        studio_base_path: '/_studio',
        factory_base_path: '/_factory'
      }
    }
  }
};

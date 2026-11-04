/**
 * =========================================================================
 * module: nuxt/server/utils/harness.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: singleton dual-engine harness, mastra server handler, and studio/factory asset handler for nuxt nitro
 * verbose: lazily initialises the coupled xstate v5 + mastra v1 dual-engine harness alongside
 * MastraFactory (@mastra/factory), the 528-route Nuxt Nitro handler, and the Studio/Factory SPA
 * asset server.
 *
 * section: arguments
 * - options (object, optional): custom runtime configuration overrides
 *
 * section: return value
 * - runtime (promise<object>): { harness, factory_bundle, api_handler, asset_handler }
 *
 * section: example
 * const { api_handler } = await use_sdlc_mastra_runtime();
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let cached_runtime_promise = null;

function resolve_sdlc_src_entry() {
  const candidates = [];
  if (process.env.SDLC_PACKAGE_ROOT) {
    candidates.push(path.resolve(process.env.SDLC_PACKAGE_ROOT, 'src', 'index.js'));
  }
  const cwd = process.cwd();
  candidates.push(
    path.resolve(cwd, 'src', 'index.js'),
    path.resolve(cwd, '..', 'src', 'index.js')
  );
  try {
    let dir = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i += 1) {
      candidates.push(path.resolve(dir, 'src', 'index.js'));
      dir = path.dirname(dir);
    }
  } catch (_err) {
    // ignore URL resolution fallback
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (fs.existsSync(candidates[i])) {
      return candidates[i];
    }
  }
  return path.resolve(cwd, 'src', 'index.js');
}

export async function use_sdlc_mastra_runtime(options = {}) {
  if (!cached_runtime_promise) {
    cached_runtime_promise = (async () => {
      const entry_path = resolve_sdlc_src_entry();
      const {
        create_dual_engine_harness,
        create_nuxt_mastra_handler,
        create_nuxt_studio_asset_handler
      } = await import(pathToFileURL(entry_path).href);

      const harness = create_dual_engine_harness({
        session_id: options.session_id || 'nuxt-sdlc-studio',
        ...options
      });
      const factory_bundle = await harness.create_factory(options);
      const api_handler = create_nuxt_mastra_handler({
        harness,
        factory_bundle,
        prefix: options.api_prefix || '/api/mastra'
      });
      const asset_handler = create_nuxt_studio_asset_handler({
        studio_base_path: options.studio_base_path || '/_studio',
        factory_base_path: options.factory_base_path || '/_factory',
        api_prefix: options.api_prefix || '/api/mastra'
      });
      return {
        harness,
        factory_bundle,
        api_handler,
        asset_handler
      };
    })();
  }
  return cached_runtime_promise;
}

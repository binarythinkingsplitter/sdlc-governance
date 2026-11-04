/**
 * =========================================================================
 * module: NuxtMastraStudio.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: standalone nuxt 4 module and spa asset handler for mastra studio & mastra software factory
 * verbose: resolves and serves the pre-built mastra studio spa (mastra/dist/studio) and mastra
 * software factory spa (mastra/dist/factory) inside a nuxt 4 application. replaces all
 * %%MASTRA_*%% html runtime placeholders with live dual-engine configuration (apiPrefix,
 * studioBasePath, requestContext presets for xstate_phase and supervisor_token), serves static
 * js/css/svg assets and the /refresh-events sse stream, and exports a first-class nuxt 4 module
 * factory (create_nuxt_mastra_module) that mounts /api/mastra/**, /web/**, /auth/**, /_studio/**,
 * and /_factory/** plus nuxt devtools tabs.
 *
 * section: arguments
 * - options (object, optional): configuration for studio/factory paths, api prefix, and server host/port
 *
 * section: return value
 * - module exports (object): factory functions for nuxt studio/factory html rendering, asset serving, and nuxt module registration
 *
 * section: example
 * import { create_nuxt_mastra_module, create_nuxt_studio_asset_handler } from './NuxtMastraStudio.js';
 * export default create_nuxt_mastra_module({ studio_base_path: '/_studio', factory_base_path: '/_factory' });
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const current_dir = path.dirname(fileURLToPath(import.meta.url));
const default_package_root = path.resolve(current_dir, '..');

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg'
});

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: locates the installed mastra studio and factory spa asset directories
 * verbose: inspects local node_modules/mastra/dist for the pre-built studio and factory
 * single-page application bundles and their routes-manifest.json descriptors.
 *
 * section: arguments
 * - options (object, optional): { package_root, studio_dist_dir, factory_dist_dir }
 *
 * section: return value
 * - resolved (object): { studio_dir, factory_dir, studio_manifest, factory_manifest }
 *
 * section: example
 * const { studio_dir, factory_dir } = resolve_mastra_ui_directories();
 */
export function resolve_mastra_ui_directories(options = {}) {
  const pkg_root = options.package_root || default_package_root;
  const studio_dir =
    options.studio_dist_dir || path.join(pkg_root, 'node_modules', 'mastra', 'dist', 'studio');
  const factory_dir =
    options.factory_dist_dir || path.join(pkg_root, 'node_modules', 'mastra', 'dist', 'factory');

  let studio_manifest = null;
  let factory_manifest = null;

  const studio_manifest_path = path.join(studio_dir, 'routes-manifest.json');
  if (fs.existsSync(studio_manifest_path)) {
    try {
      studio_manifest = JSON.parse(fs.readFileSync(studio_manifest_path, 'utf-8'));
    } catch (_err) {
      studio_manifest = null;
    }
  }

  const factory_manifest_path = path.join(factory_dir, 'routes-manifest.json');
  if (fs.existsSync(factory_manifest_path)) {
    try {
      factory_manifest = JSON.parse(fs.readFileSync(factory_manifest_path, 'utf-8'));
    } catch (_err) {
      factory_manifest = null;
    }
  }

  return {
    studio_dir,
    factory_dir,
    studio_exists: fs.existsSync(studio_dir),
    factory_exists: fs.existsSync(factory_dir),
    studio_manifest,
    factory_manifest
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: renders the Mastra Studio index.html with all %%MASTRA_*%% placeholders hydrated
 * verbose: reads mastra/dist/studio/index.html and replaces all server host, port, protocol,
 * apiPrefix, studioBasePath, experimental features, and dual-engine requestContext presets
 * so Mastra Studio connects directly to the Nuxt Nitro /api/mastra endpoints.
 *
 * section: arguments
 * - options (object, optional): { host, port, protocol, api_prefix, studio_base_path, instance_id }
 *
 * section: return value
 * - html (string): hydrated Mastra Studio index.html string
 *
 * section: example
 * const html = render_mastra_studio_html({ studio_base_path: '/_studio', api_prefix: '/api/mastra' });
 */
export function render_mastra_studio_html(options = {}) {
  const { studio_dir } = resolve_mastra_ui_directories(options);
  const index_path = path.join(studio_dir, 'index.html');
  const raw_html = fs.existsSync(index_path)
    ? fs.readFileSync(index_path, 'utf-8')
    : '<!doctype html><html><head><title>Mastra Studio</title></head><body><div id="root"></div></body></html>';

  const studio_base_path = ('/' + String(options.studio_base_path || '/_studio').replace(/^\/+/, '')).replace(/\/+$/, '');
  const api_prefix = ('/' + String(options.api_prefix || '/api/mastra').replace(/^\/+/, '')).replace(/\/+$/, '');
  const host = options.host || 'localhost';
  const port = String(options.port || 3100);
  const protocol = options.protocol || 'http';
  const instance_id = options.instance_id || 'sdlc-nuxt-studio-instance';

  const default_presets = options.request_context_presets || {
    'phase 00: inception (product-manager)': {
      role: 'product-manager',
      xstate_phase: 'phase_00_inception',
      project_state: 'active_development'
    },
    'phase 02: architecture (system-architect)': {
      role: 'system-architect',
      xstate_phase: 'phase_02_architecture',
      project_state: 'active_development'
    },
    'phase 04: tdd green (software-engineer)': {
      role: 'software-engineer',
      xstate_phase: 'phase_04_tdd_green',
      project_state: 'active_development'
    },
    'tier 1 supervisor (sdlc-supervisor)': {
      role: 'sdlc-supervisor',
      xstate_phase: 'phase_00_inception',
      project_state: 'active_development'
    }
  };

  const replacements = {
    '%%MASTRA_TELEMETRY_DISABLED%%': 'true',
    '%%MASTRA_SERVER_HOST%%': host,
    '%%MASTRA_SERVER_PORT%%': port,
    '%%MASTRA_DEV_SERVER_INSTANCE_ID%%': instance_id,
    '%%MASTRA_API_PREFIX%%': api_prefix,
    '%%MASTRA_HIDE_CLOUD_CTA%%': 'true',
    '%%MASTRA_STUDIO_BASE_PATH%%': studio_base_path,
    '%%MASTRA_SERVER_PROTOCOL%%': protocol,
    '%%MASTRA_CLOUD_API_ENDPOINT%%': '',
    '%%MASTRA_EXPERIMENTAL_FEATURES%%': 'true',
    '%%MASTRA_TEMPLATES%%': 'false',
    '%%MASTRA_AUTO_DETECT_URL%%': 'true',
    '%%MASTRA_REQUEST_CONTEXT_PRESETS%%': JSON.stringify(default_presets),
    '%%MASTRA_EXPERIMENTAL_UI%%': 'true',
    '%%MASTRA_AGENT_SIGNALS%%': 'true',
    '%%MASTRA_SIGNALS_UI%%': 'true',
    '%%MASTRA_ORGANIZATION_ID%%': 'sdlc-org',
    '%%MASTRA_PLATFORM_PROJECT_ID%%': 'sdlc-dual-engine-project',
    '%%MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT%%': ''
  };

  let hydrated = raw_html;
  for (const [placeholder, val] of Object.entries(replacements)) {
    hydrated = hydrated.split(placeholder).join(val);
  }
  return hydrated;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: renders the Mastra Software Factory index.html hydrated for Nuxt mounting
 * verbose: reads mastra/dist/factory/index.html, injects Mastra server globals, and rewrites
 * root-relative asset urls so the Software Factory SPA loads cleanly under /_factory.
 *
 * section: arguments
 * - options (object, optional): { factory_base_path, api_prefix, host, port, protocol }
 *
 * section: return value
 * - html (string): hydrated Mastra Software Factory index.html string
 *
 * section: example
 * const html = render_mastra_factory_html({ factory_base_path: '/_factory' });
 */
export function render_mastra_factory_html(options = {}) {
  const { factory_dir } = resolve_mastra_ui_directories(options);
  const index_path = path.join(factory_dir, 'index.html');
  const raw_html = fs.existsSync(index_path)
    ? fs.readFileSync(index_path, 'utf-8')
    : '<!doctype html><html><head><title>Mastra Factory</title></head><body><div id="root"></div></body></html>';

  const factory_base_path = ('/' + String(options.factory_base_path || '/_factory').replace(/^\/+/, '')).replace(/\/+$/, '');
  const api_prefix = ('/' + String(options.api_prefix || '/api/mastra').replace(/^\/+/, '')).replace(/\/+$/, '');
  const host = options.host || 'localhost';
  const port = String(options.port || 3100);
  const protocol = options.protocol || 'http';

  const config_script = `<script>
      window.MASTRA_SERVER_HOST = '${host}';
      window.MASTRA_SERVER_PORT = '${port}';
      window.MASTRA_SERVER_PROTOCOL = '${protocol}';
      window.MASTRA_API_PREFIX = '${api_prefix}';
      window.MASTRA_FACTORY_BASE_PATH = '${factory_base_path}';
      window.MASTRA_ORGANIZATION_ID = 'sdlc-org';
      if (window.location.pathname === '${factory_base_path}' || window.location.pathname.startsWith('${factory_base_path}/')) {
        var sub = window.location.pathname.slice('${factory_base_path}'.length);
        window.history.replaceState(window.history.state, '', sub && sub !== '/' ? sub : '/factories');
      }
    </script>`;

  let hydrated = raw_html.replace('<head>', `<head>\n    ${config_script}`);
  if (factory_base_path && factory_base_path !== '/') {
    hydrated = hydrated
      .split('src="/assets/')
      .join(`src="${factory_base_path}/assets/`)
      .split('href="/assets/')
      .join(`href="${factory_base_path}/assets/`)
      .split('href="/mastra.svg"')
      .join(`href="${factory_base_path}/mastra.svg"`)
      .split('href="/manifest.webmanifest"')
      .join(`href="${factory_base_path}/manifest.webmanifest"`);
  }
  return hydrated;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a static asset and spa fallback handler for Mastra Studio and Mastra Factory
 * verbose: serves index.html, static js/css/svg bundles from mastra/dist/studio and
 * mastra/dist/factory, and the /refresh-events sse stream for hot-reload handshakes.
 *
 * section: arguments
 * - options (object, optional): { studio_base_path, factory_base_path, api_prefix, host, port }
 *
 * section: return value
 * - handler (object): { serve_request, handle_nuxt_event, studio_base_path, factory_base_path }
 *
 * section: example
 * const asset_handler = create_nuxt_studio_asset_handler();
 * const res = asset_handler.serve_request({ path: '/_studio' });
 */
export function create_nuxt_studio_asset_handler(options = {}) {
  const { studio_dir, factory_dir } = resolve_mastra_ui_directories(options);
  const studio_base_path = ('/' + String(options.studio_base_path || '/_studio').replace(/^\/+/, '')).replace(/\/+$/, '');
  const factory_base_path = ('/' + String(options.factory_base_path || '/_factory').replace(/^\/+/, '')).replace(/\/+$/, '');
  const instance_id = options.instance_id || 'sdlc-nuxt-studio-instance';

  function resolve_safe_asset(root_dir, sub_path) {
    const clean_sub = String(sub_path || '').replace(/^\/+/, '');
    if (!clean_sub) return null;
    const candidate = path.resolve(root_dir, clean_sub);
    if (!candidate.startsWith(path.resolve(root_dir))) {
      return null;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const ext = path.extname(candidate).toLowerCase();
      const content_type = MIME_TYPES[ext] || 'application/octet-stream';
      const is_text =
        content_type.startsWith('text/') ||
        content_type.includes('javascript') ||
        content_type.includes('json') ||
        content_type.includes('svg');
      return {
        status: 200,
        headers: {
          'content-type': content_type,
          'cache-control': clean_sub.startsWith('assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache'
        },
        body: is_text ? fs.readFileSync(candidate, 'utf-8') : fs.readFileSync(candidate)
      };
    }
    return null;
  }

  function serve_request(req = {}) {
    const raw_path = String(req.path || req.url || '/').split('?')[0];
    const host_header = req.headers?.host || req.host || null;
    let effective_options = options;
    if (host_header && (!options.host || !options.port)) {
      const [h, p] = String(host_header).split(':');
      effective_options = {
        ...options,
        host: options.host || h || 'localhost',
        port: options.port || p || 3000
      };
    }

    if (
      raw_path === `${studio_base_path}/refresh-events` ||
      raw_path === '/refresh-events'
    ) {
      return {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive'
        },
        body: `id: ${instance_id}\ndata: connected\n\n`
      };
    }

    if (raw_path === studio_base_path || raw_path.startsWith(`${studio_base_path}/`)) {
      const sub_path = raw_path.slice(studio_base_path.length).replace(/^\/+/, '');
      if (sub_path) {
        const asset = resolve_safe_asset(studio_dir, sub_path);
        if (asset) return asset;
      }
      return {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache'
        },
        body: render_mastra_studio_html({ ...effective_options, studio_base_path })
      };
    }

    if (raw_path === factory_base_path || raw_path.startsWith(`${factory_base_path}/`)) {
      const sub_path = raw_path.slice(factory_base_path.length).replace(/^\/+/, '');
      if (sub_path) {
        const asset = resolve_safe_asset(factory_dir, sub_path);
        if (asset) return asset;
      }
      return {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache'
        },
        body: render_mastra_factory_html({ ...effective_options, factory_base_path })
      };
    }

    return null;
  }

  async function handle_nuxt_event(event) {
    const raw_url = event?.path || event?.node?.req?.url || '/';
    const headers = event?.node?.req?.headers || event?.headers || {};
    const res = serve_request({ path: raw_url, headers });
    if (!res) {
      if (event?.node?.res) {
        event.node.res.statusCode = 404;
      }
      return { error: 'studio_or_factory_asset_not_found', path: raw_url };
    }
    if (event?.node?.res) {
      event.node.res.statusCode = res.status;
      if (typeof event.node.res.setHeader === 'function') {
        for (const [k, v] of Object.entries(res.headers || {})) {
          event.node.res.setHeader(k, v);
        }
      }
    }
    return res.body;
  }

  return {
    studio_base_path,
    factory_base_path,
    serve_request,
    handle_nuxt_event
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a standalone Nuxt 4 module integrating Mastra Server, Studio, Factory, and Dual-Engine Harness
 * verbose: returns a Nuxt module setup function `(inline_options, nuxt) => void` that configures
 * runtimeConfig.mastra, registers Nitro server handlers for /api/mastra/**, /web/**, /auth/**,
 * /_studio/**, and /_factory/**, and registers custom Nuxt DevTools tabs for Mastra Studio and
 * Mastra Software Factory.
 *
 * section: arguments
 * - default_options (object, optional): default module options
 *
 * section: return value
 * - nuxt_module (function): Nuxt 4 module function with meta descriptor
 *
 * section: example
 * // in nuxt.config.js:
 * import { create_nuxt_mastra_module } from '@thing/sdlc-dual_engine_harness/nuxt-studio';
 * export default { modules: [create_nuxt_mastra_module()] };
 */
export function create_nuxt_mastra_module(default_options = {}) {
  const nuxt_dir = path.resolve(default_package_root, 'nuxt');

  function sdlc_mastra_nuxt_module(inline_options = {}, nuxt = {}) {
    const merged = {
      api_prefix: '/api/mastra',
      studio_base_path: '/_studio',
      factory_base_path: '/_factory',
      enable_studio: true,
      enable_factory: true,
      ...default_options,
      ...(nuxt?.options?.mastra || {}),
      ...inline_options
    };

    if (nuxt && nuxt.options) {
      nuxt.options.runtimeConfig = nuxt.options.runtimeConfig || {};
      nuxt.options.runtimeConfig.mastra = {
        ...(nuxt.options.runtimeConfig.mastra || {}),
        ...merged
      };
      nuxt.options.runtimeConfig.public = nuxt.options.runtimeConfig.public || {};
      nuxt.options.runtimeConfig.public.mastra = {
        api_prefix: merged.api_prefix,
        studio_base_path: merged.studio_base_path,
        factory_base_path: merged.factory_base_path
      };
    }

    const registered_handlers = [
      {
        route: `${merged.api_prefix}/**`,
        handler: path.join(nuxt_dir, 'server', 'api', 'mastra', '[...].js')
      },
      {
        route: '/web/**',
        handler: path.join(nuxt_dir, 'server', 'routes', 'web', '[...].js')
      },
      {
        route: '/auth/**',
        handler: path.join(nuxt_dir, 'server', 'routes', 'auth', '[...].js')
      }
    ];

    if (merged.enable_studio !== false) {
      registered_handlers.push(
        {
          route: merged.studio_base_path,
          handler: path.join(nuxt_dir, 'server', 'routes', '_studio', '[...].js')
        },
        {
          route: `${merged.studio_base_path}/**`,
          handler: path.join(nuxt_dir, 'server', 'routes', '_studio', '[...].js')
        }
      );
    }

    if (merged.enable_factory !== false) {
      registered_handlers.push(
        {
          route: merged.factory_base_path,
          handler: path.join(nuxt_dir, 'server', 'routes', '_factory', '[...].js')
        },
        {
          route: `${merged.factory_base_path}/**`,
          handler: path.join(nuxt_dir, 'server', 'routes', '_factory', '[...].js')
        }
      );
    }

    if (nuxt && Array.isArray(nuxt.options?.serverHandlers)) {
      for (let i = 0; i < registered_handlers.length; i += 1) {
        nuxt.options.serverHandlers.push(registered_handlers[i]);
      }
    }

    if (nuxt && typeof nuxt.hook === 'function') {
      nuxt.hook('devtools:customTabs', (tabs) => {
        if (!Array.isArray(tabs)) return;
        tabs.push(
          {
            name: 'mastra-studio',
            title: 'Mastra Studio',
            icon: 'carbon:machine-learning-model',
            view: {
              type: 'iframe',
              src: merged.studio_base_path
            }
          },
          {
            name: 'mastra-factory',
            title: 'Mastra Factory',
            icon: 'carbon:flow-stream',
            view: {
              type: 'iframe',
              src: merged.factory_base_path
            }
          }
        );
      });
    }

    return {
      meta: {
        name: '@thing/sdlc-dual_engine_harness/nuxt-studio',
        configKey: 'mastra',
        version: '0.1.0'
      },
      options: merged,
      handlers: registered_handlers
    };
  }

  sdlc_mastra_nuxt_module.meta = {
    name: '@thing/sdlc-dual_engine_harness/nuxt-studio',
    configKey: 'mastra',
    version: '0.1.0'
  };

  return sdlc_mastra_nuxt_module;
}

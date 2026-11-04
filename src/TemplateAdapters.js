/**
 * =========================================================================
 * module: template adapters
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: adapter-based templating backends for handlebars and lightweight builtin engine
 * verbose: provides interchangeable template engine adapters allowing users to swap
 * between official npm handlebars and our zero-dependency builtin ast evaluator.
 * 
 * section: export catalog
 * - create_template_adapter: factory function creating configured template adapter
 * - create_handlebars_template_adapter: adapter wrapping official handlebars library
 * - create_builtin_template_adapter: adapter wrapping lightweight builtin ast engine
 * =========================================================================
 */

import handlebars from 'handlebars';
import { BUILTIN_HELPERS } from './TemplateEngine.js';

/**
 * transforms pipeline filter syntax ({{val | filter arg}}) to handlebars helper call ({{filter val arg}})
 * and normalises numeric path access ({{arr.0}} -> {{arr.[0]}})
 */
function preprocess_handlebars_filters(template_str) {
  return template_str
    .replace(/\{\{([^#\/>{}]+)\}\}/g, (match, content) => {
      // 1. normalise numeric array indexes in dot notation
      let normalised = content.replace(/\.(\d+)(?=[.\s|}]|$)/g, '.[$1]');

      if (!normalised.includes('|')) return `{{${normalised}}}`;
      const parts = normalised.split('|').map((s) => s.trim());
      let expr = parts[0];

      for (let i = 1; i < parts.length; i += 1) {
        const filter_tokens = parts[i].split(/\s+/);
        const filter_name = filter_tokens[0];
        const filter_args = filter_tokens.slice(1).join(' ');
        if (i === 1) {
          expr = filter_args ? `${filter_name} ${expr} ${filter_args}` : `${filter_name} ${expr}`;
        } else {
          expr = filter_args ? `${filter_name} (${expr}) ${filter_args}` : `${filter_name} (${expr})`;
        }
      }
      return `{{${expr}}}`;
    });
}

/**
 * =========================================================================
 * class: TemplateAdapter
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: abstract base class for pluggable template rendering backends
 * verbose: defines the adapter contract (register_helper, register_partial, compile, render).
 * subclasses implement register_helper, register_partial, and compile; render() is inherited.
 * =========================================================================
 */
export class TemplateAdapter {
  constructor(name) {
    this.name = name;
  }

  register_helper(_name, _fn) {
    throw new Error(`${this.constructor.name}.register_helper is not implemented`);
  }

  register_partial(_name, _template_str) {
    throw new Error(`${this.constructor.name}.register_partial is not implemented`);
  }

  compile(_template_str) {
    throw new Error(`${this.constructor.name}.compile is not implemented`);
  }

  render(template_str, context = {}) {
    return this.compile(template_str)(context);
  }
}

/**
 * =========================================================================
 * class: HandlebarsTemplateAdapter
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: handlebars-backed template adapter with built-in helpers and a custom each helper
 * verbose: wraps an isolated handlebars environment, registers BUILTIN_HELPERS (stripping the
 * trailing handlebars options argument), a custom `each` supporting @number alongside @index, and
 * any caller-supplied helpers and partials.
 *
 * section: arguments
 * - options (object, optional): { helpers, partials }
 *
 * section: example
 * const adapter = new HandlebarsTemplateAdapter({ helpers: { shout: (s) => s.toUpperCase() } });
 * adapter.render('{{shout name}}', { name: 'sdlc' });
 * =========================================================================
 */
export class HandlebarsTemplateAdapter extends TemplateAdapter {
  constructor(options = {}) {
    super('handlebars');
    this.env = handlebars.create();

    // 1. register built-in helpers
    for (const [name, fn] of Object.entries(BUILTIN_HELPERS)) {
      this.env.registerHelper(name, (...args) => {
        // handlebars passes an options object as the last argument
        return fn(...args.slice(0, -1));
      });
    }

    // 2. register custom each helper supporting @number alongside @index
    this.env.registerHelper('each', function (context, opts) {
      if (!context || (Array.isArray(context) && context.length === 0)) {
        return opts.inverse ? opts.inverse(this) : '';
      }

      const items = Array.isArray(context) ? context : Object.values(context);
      let ret = '';
      for (const [i, item] of items.entries()) {
        const data = opts.data ? handlebars.createFrame(opts.data) : { _parent: this };
        data.index = i;
        data.number = i + 1;
        data.first = i === 0;
        data.last = i === items.length - 1;
        ret += opts.fn(item, { data, blockParams: [item, i] });
      }
      return ret;
    });

    // 3. register custom helper and partial options
    for (const [h_name, h_fn] of Object.entries(options.helpers || {})) {
      this.env.registerHelper(h_name, (...args) => h_fn(...args.slice(0, -1)));
    }
    for (const [p_name, p_val] of Object.entries(options.partials || {})) {
      this.env.registerPartial(p_name, p_val);
    }
  }

  register_helper(name, fn) {
    this.env.registerHelper(name, (...args) => fn(...args.slice(0, -1)));
    return this;
  }

  register_partial(name, template_str) {
    this.env.registerPartial(name, preprocess_handlebars_filters(template_str));
    return this;
  }

  compile(template_str) {
    const processed = preprocess_handlebars_filters(template_str);
    const compiled_fn = this.env.compile(processed, { noEscape: true });
    return (context = {}) => compiled_fn(context);
  }
}

/**
 * =========================================================================
 * class: EngineTemplateAdapter
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: builtin template adapter delegating to a TemplateEngine instance
 * verbose: exposes the dependency-free builtin renderer of an engine through the adapter contract.
 *
 * section: arguments
 * - engine_instance (object): template engine exposing register_helper, register_partial, compile, render
 * =========================================================================
 */
export class EngineTemplateAdapter extends TemplateAdapter {
  constructor(engine_instance) {
    super('builtin');
    this.engine = engine_instance;
  }

  register_helper(name, fn) {
    this.engine.register_helper(name, fn);
    return this;
  }

  register_partial(name, template_str) {
    this.engine.register_partial(name, template_str);
    return this;
  }

  compile(template_str) {
    return this.engine.compile(template_str);
  }

  render(template_str, context = {}) {
    return this.engine.render(template_str, context);
  }
}

const adapter_classes = new Map([
  ['handlebars', (options) => new HandlebarsTemplateAdapter(options)],
  ['builtin', (options) => new EngineTemplateAdapter(options.engine)]
]);

/**
 * function: create_template_adapter
 * tldr: convenience constructor returning the adapter subclass for a backend type
 */
export function create_template_adapter(type = 'handlebars', options = {}) {
  const factory = adapter_classes.get(type);
  if (!factory) {
    throw new Error(`unknown template adapter type: "${type}" (supported: "handlebars", "builtin")`);
  }
  return factory(options);
}

export function create_handlebars_template_adapter(options = {}) {
  return new HandlebarsTemplateAdapter(options);
}

export function create_builtin_template_adapter(engine_instance) {
  return new EngineTemplateAdapter(engine_instance);
}

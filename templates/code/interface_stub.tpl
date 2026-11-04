/**
 * =========================================================================
 * module: {{slug}}_interface
 * =========================================================================
 * 
 * section: version number
 * version: {{version}}
 * 
 * section: documentation
 * tldr: interface contract specification for {{component}}
 * verbose: defines method signatures, input parameters, and validation guards.
 * 
 * section: export catalog
 * - validate_{{snake_case component}}_contract: function verifying implementation contract
 * =========================================================================
 */

/**
 * =========================================================================
 * function: validate_{{snake_case component}}_contract
 * =========================================================================
 * 
 * section: version number
 * version: {{version}}
 * 
 * section: documentation
 * tldr: validates that a candidate object implements {{component}} interface
 * verbose: checks presence and function type for each required interface method.
 * 
 * section: arguments
 * - target (object): candidate object instance
 * 
 * section: return value
 * - is_valid (boolean): true if all methods are present
 * 
 * section: example
 * const valid = validate_{{snake_case component}}_contract(instance);
 * =========================================================================
 */
export function validate_{{snake_case component}}_contract(target) {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const required_methods = [
{{#each methods}}
    '{{name}}'{{#unless @last}},{{/unless}}
{{/each}}
  ];

  for (let i = 0; i < required_methods.length; i += 1) {
    const method_name = required_methods[i];
    if (typeof target[method_name] !== 'function') {
      return false;
    }
  }

  return true;
}

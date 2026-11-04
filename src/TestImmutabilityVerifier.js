/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test immutability verification engine
 * verbose: checks test files for reduced assertion counts or introduced test skips
 * to guarantee that tests remain an inviolable source of truth during development.
 * 
 * section: arguments
 * - baseline_source (string): baseline test source code
 * - current_source (string): current test source code
 * 
 * section: return value
 * - result (object): validation outcome { valid: boolean, delta: number, violations: string[] }
 * 
 * section: example
 * import { verify_test_immutability } from './TestImmutabilityVerifier.js';
 * const result = verify_test_immutability('test(...)', 'test(...)');
 */

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test assertion immutability validation algorithm
 * verbose: checks baseline versus current test source code for deleted assertions
 * or introduced test skips.
 * 
 * section: arguments
 * - baseline_source (string): baseline test source code
 * - current_source (string): current test source code
 * 
 * section: return value
 * - result (object): validation result { valid: boolean, delta: number, violations: string[] }
 * 
 * section: example
 * const outcome = verify_test_immutability(old_code, new_code);
 */
export function verify_test_immutability(baseline_source, current_source) {
  const count_assertions = (source) => {
    const assertion_matches = source.match(/assert\.[a-z_]+|expect\(/g) || [];
    const skip_matches = source.match(/test\.skip|\.skip\(/g) || [];
    return {
      assertions: assertion_matches.length,
      skips: skip_matches.length
    };
  };

  const baseline = count_assertions(baseline_source || '');
  const current = count_assertions(current_source || '');
  const delta = current.assertions - baseline.assertions;
  const violations = [];

  if (delta < 0) {
    violations.push(`assertion count decreased: baseline=${baseline.assertions}, current=${current.assertions}`);
  }

  if (current.skips > baseline.skips) {
    violations.push(`test skipping introduced: baseline=${baseline.skips}, current=${current.skips}`);
  }

  return {
    valid: violations.length === 0,
    delta,
    violations
  };
}

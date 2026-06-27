/** Max length for a Soroban Symbol (Stellar contract event IDs). */
export const SOROBAN_SYMBOL_MAX_LENGTH = 32;

/** Allowed charset: letters, digits, underscore. */
const SOROBAN_SYMBOL_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

/**
 * Returns true when `value` can be encoded as a Soroban Symbol via nativeToScVal.
 */
export function isValidSorobanSymbol(value: string): boolean {
  return SOROBAN_SYMBOL_PATTERN.test(value);
}

/**
 * Validates a Soroban Symbol or throws with a clear message.
 */
export function assertValidSorobanSymbol(value: string, fieldName = 'eventId'): void {
  if (!isValidSorobanSymbol(value)) {
    throw new Error(
      `${fieldName} must be a valid Soroban Symbol (1-${SOROBAN_SYMBOL_MAX_LENGTH} chars, alphanumeric and underscore only)`,
    );
  }
}

export const SOROBAN_SYMBOL_VALIDATION_MESSAGE =
  'Must be a valid Soroban Symbol (1-32 chars, alphanumeric and underscore only)';

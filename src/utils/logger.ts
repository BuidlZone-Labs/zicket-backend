import pino from 'pino';

// ─── PII Sanitization ────────────────────────────────────────────────────────

const EMAIL_RE = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const WALLET_RE = /0x[a-fA-F0-9]{8,}/g;

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const local = parts[0];
  const domain = parts[1];
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

function maskWallet(address: string): string {
  if (!address.startsWith('0x')) return address;
  if (address.length <= 12) return `${address.slice(0, 6)}...`;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

function sanitizeString(s: string): string {
  return s
    .replace(EMAIL_RE, (_m, p1, p2) => `${maskEmail(p1 + '@' + p2)}`)
    .replace(WALLET_RE, (m) => maskWallet(m));
}

function sanitizeObject(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      // Strip original stack — it may contain PII (emails, wallets)
      stack: obj.stack ? sanitizeString(obj.stack) : undefined,
    };
  }
  if (Array.isArray(obj)) return obj.map((v) => sanitizeObject(v, seen));
  if (typeof obj === 'object') {
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    const out: any = {};
    for (const key of Object.keys(obj)) {
      try {
        out[key] = sanitizeObject(obj[key], seen);
      } catch (e) {
        out[key] = '[Unserializable]';
      }
    }
    return out;
  }
  return String(obj);
}

// ─── Logger Instance ─────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  hooks: {
    logMethod(args: any[], method: any) {
      // Pino's standard contract: logger.method([mergingObject], [message], [...interpolationValues])
      // When a string is passed as the first arg with no placeholders, extra trailing
      // args (errors, objects) are silently dropped. Reorder so errors/objects become
      // the first (mergingObject) arg and the string becomes the message.
      if (args.length >= 2 && typeof args[0] === 'string') {
        const message = args[0];
        const rest = args.slice(1);
        // If any remaining arg is an Error or object, promote it first
        const hasStructurable = rest.some(
          (a) => a instanceof Error || (typeof a === 'object' && a !== null),
        );
        if (hasStructurable) {
          const merged: Record<string, any> = {};
          const interpolationValues: any[] = [];
          for (const arg of rest) {
            if (arg instanceof Error) {
              merged.err = arg;
            } else if (typeof arg === 'object' && arg !== null) {
              Object.assign(merged, arg);
            } else {
              interpolationValues.push(arg);
            }
          }
          args = [merged, message, ...interpolationValues];
        }
      }
      method.apply(this, args);
    },
  },
});

/**
 * Wrapper that auto-sanitizes all arguments before passing to pino.
 * Returns `any` to maintain console-like flexibility (no strict typing).
 */
function sanitizeLogMethod(fn: Function): any {
  return (...args: any[]) => {
    const sanitized = args.map((arg: any) => sanitizeObject(arg));
    return fn.apply(logger, sanitized);
  };
}

const sanitizedLogger = {
  info: sanitizeLogMethod(logger.info.bind(logger)),
  warn: sanitizeLogMethod(logger.warn.bind(logger)),
  error: sanitizeLogMethod(logger.error.bind(logger)),
  debug: sanitizeLogMethod(logger.debug.bind(logger)),
  fatal: sanitizeLogMethod(logger.fatal.bind(logger)),
  child: (bindings: Record<string, unknown>) => {
    const sanitizedBindings = sanitizeObject(bindings);
    const child = logger.child(sanitizedBindings);
    return {
      info: sanitizeLogMethod(child.info.bind(child)),
      warn: sanitizeLogMethod(child.warn.bind(child)),
      error: sanitizeLogMethod(child.error.bind(child)),
      debug: sanitizeLogMethod(child.debug.bind(child)),
      fatal: sanitizeLogMethod(child.fatal.bind(child)),
    };
  },
};

export { sanitizedLogger as logger };
export { sanitizeObject, sanitizeString };
export default sanitizedLogger;

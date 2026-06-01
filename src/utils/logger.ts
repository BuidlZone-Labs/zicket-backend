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
    return { name: obj.name, message: sanitizeString(obj.message), stack: obj.stack };
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

function formatLog(level: string, args: IArguments | any[]) {
  const timestamp = new Date().toISOString();
  const payload = Array.isArray(args) ? args : Array.from(args as any);
  const sanitized = payload.map((a: any) => sanitizeObject(a));
  // If first arg is a string message, join it with rest for readability
  let message = undefined as string | undefined;
  if (typeof sanitized[0] === 'string') {
    message = sanitized.shift();
  }
  const log = {
    timestamp,
    level,
    message,
    data: sanitized.length === 1 ? sanitized[0] : sanitized,
  };
  return JSON.stringify(log);
}

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: (console as any).debug ? (console as any).debug.bind(console) : console.log.bind(console),
};

// Override console methods with structured, sanitized output
console.log = (...args: any[]) => {
  originalConsole.log(formatLog('info', args));
};

console.info = (...args: any[]) => {
  originalConsole.info(formatLog('info', args));
};

console.warn = (...args: any[]) => {
  originalConsole.warn(formatLog('warn', args));
};

console.error = (...args: any[]) => {
  originalConsole.error(formatLog('error', args));
};

(console as any).debug = (...args: any[]) => {
  originalConsole.debug(formatLog('debug', args));
};

export { sanitizeObject, sanitizeString };

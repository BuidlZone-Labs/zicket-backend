import logger from '../utils/logger';

/**
 * Asset pricing for payment verification.
 * Converts USD ticket amounts into on-chain base units using a live (or cached)
 * USD-per-asset rate. Asset-agnostic: symbol + decimals come from env.
 */

export interface AssetPriceQuote {
  /** Asset symbol, e.g. ETH, XLM, USDC */
  asset: string;
  /** USD value of 1 whole unit of the asset (not base units) */
  usdPerAsset: number;
  source: 'api' | 'cache' | 'fallback';
  fetchedAt: number;
}

export interface PricingConfig {
  asset: string;
  decimals: number;
  /** Acceptable under/over-pay variance in basis points (100 = 1%) */
  toleranceBps: number;
  cacheTtlMs: number;
  priceApiUrl: string | null;
  /** Last-resort USD-per-asset if live pricing is unavailable */
  fallbackUsdPerAsset: number | null;
}

/**
 * Permanent config/input failure — not retryable.
 * Callers should map this to PaymentVerificationError (422), not 503.
 */
export class PricingConfigError extends Error {
  readonly isPricingConfigError = true as const;

  constructor(message: string) {
    super(message);
    this.name = 'PricingConfigError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isPricingConfigError(err: unknown): err is PricingConfigError {
  return (
    err instanceof PricingConfigError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { isPricingConfigError?: boolean }).isPricingConfigError === true)
  );
}

const DEFAULT_ASSET = 'ETH';
const DEFAULT_DECIMALS = 18;
const DEFAULT_TOLERANCE_BPS = 100; // 1%
const DEFAULT_CACHE_TTL_MS = 60_000;

/** Shared CoinGecko id map — used by defaultPriceEndpoint + parseUsdFromBody. */
export const COINGECKO_ID_MAP: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  XLM: 'stellar',
  BTC: 'bitcoin',
  MATIC: 'matic-network',
  POL: 'matic-network',
  USDC: 'usd-coin',
  USDT: 'tether',
};

type CacheEntry = { quote: AssetPriceQuote; expiresAt: number };

let cache: CacheEntry | null = null;

/** Test/reset hook */
export function _resetPricingCache(): void {
  cache = null;
}

export function getPricingConfig(): PricingConfig {
  const asset = (process.env.PAYMENT_ASSET || DEFAULT_ASSET).toUpperCase();
  const decimals = parseInt(
    process.env.PAYMENT_ASSET_DECIMALS || String(DEFAULT_DECIMALS),
    10,
  );
  const toleranceBps = parseInt(
    process.env.PAYMENT_TOLERANCE_BPS || String(DEFAULT_TOLERANCE_BPS),
    10,
  );
  const cacheTtlMs = parseInt(
    process.env.PRICE_CACHE_TTL_MS || String(DEFAULT_CACHE_TTL_MS),
    10,
  );
  const priceApiUrl = process.env.PRICE_API_URL || null;
  const fallbackRaw = process.env.FALLBACK_USD_PER_ASSET;
  const fallbackUsdPerAsset =
    fallbackRaw !== undefined && fallbackRaw !== ''
      ? Number(fallbackRaw)
      : null;

  return {
    asset,
    decimals: Number.isFinite(decimals) ? decimals : DEFAULT_DECIMALS,
    toleranceBps: Number.isFinite(toleranceBps)
      ? toleranceBps
      : DEFAULT_TOLERANCE_BPS,
    cacheTtlMs: Number.isFinite(cacheTtlMs) ? cacheTtlMs : DEFAULT_CACHE_TTL_MS,
    priceApiUrl,
    fallbackUsdPerAsset:
      fallbackUsdPerAsset !== null &&
      Number.isFinite(fallbackUsdPerAsset) &&
      fallbackUsdPerAsset > 0
        ? fallbackUsdPerAsset
        : null,
  };
}

/**
 * CoinGecko-style map for common payment assets when PRICE_API_URL is unset.
 * Override via PRICE_API_URL for custom tokens / oracles.
 */
function defaultPriceEndpoint(asset: string): string {
  const id = COINGECKO_ID_MAP[asset] || asset.toLowerCase();
  return `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
}

function parseUsdFromBody(body: unknown, asset: string): number | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;

  // Direct { usdPerAsset: number } or { price: number }
  if (typeof obj.usdPerAsset === 'number' && obj.usdPerAsset > 0) {
    return obj.usdPerAsset;
  }
  if (typeof obj.price === 'number' && obj.price > 0) {
    return obj.price;
  }

  // CoinGecko: { ethereum: { usd: 2500 } } — only trust the entry that maps
  // to the requested asset (by known id or symbol), not the first one found.
  const coingeckoId = COINGECKO_ID_MAP[asset] || asset.toLowerCase();
  const matched = obj[coingeckoId] ?? obj[asset] ?? obj[asset.toLowerCase()];
  if (matched && typeof matched === 'object') {
    const usd = (matched as Record<string, unknown>).usd;
    if (typeof usd === 'number' && usd > 0) return usd;
  }

  // Flat { ETH: 2500 } keyed by symbol
  const bySymbol = obj[asset] ?? obj[asset.toLowerCase()];
  if (typeof bySymbol === 'number' && bySymbol > 0) return bySymbol;

  return null;
}

async function fetchLiveUsdPerAsset(
  asset: string,
  priceApiUrl: string | null,
): Promise<AssetPriceQuote> {
  const url = priceApiUrl || defaultPriceEndpoint(asset);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`Price API HTTP ${res.status} for ${url}`);
  }
  const body = await res.json();
  const usdPerAsset = parseUsdFromBody(body, asset);
  if (usdPerAsset === null) {
    throw new Error(`Price API response missing USD rate for ${asset}`);
  }
  return {
    asset,
    usdPerAsset,
    source: 'api',
    fetchedAt: Date.now(),
  };
}

/**
 * Resolve current USD-per-asset rate: cache → live API → env fallback.
 * Throws if no rate can be obtained (caller maps to ServiceUnavailableError).
 */
export async function getUsdPerAsset(
  assetOverride?: string,
): Promise<AssetPriceQuote> {
  const cfg = getPricingConfig();
  const asset = (assetOverride || cfg.asset).toUpperCase();
  const now = Date.now();

  if (
    cache &&
    cache.quote.asset === asset &&
    cache.expiresAt > now &&
    cache.quote.usdPerAsset > 0
  ) {
    return { ...cache.quote, source: 'cache' };
  }

  try {
    const quote = await fetchLiveUsdPerAsset(asset, cfg.priceApiUrl);
    cache = { quote, expiresAt: now + cfg.cacheTtlMs };
    return quote;
  } catch (err) {
    logger.warn(
      `[AssetPricingService] live price failed for ${asset}:`,
      err instanceof Error ? err.message : err,
    );

    if (cfg.fallbackUsdPerAsset !== null) {
      const quote: AssetPriceQuote = {
        asset,
        usdPerAsset: cfg.fallbackUsdPerAsset,
        source: 'fallback',
        fetchedAt: now,
      };
      // shorter cache on fallback so we retry live soon
      cache = {
        quote,
        expiresAt: now + Math.min(cfg.cacheTtlMs, 15_000),
      };
      return quote;
    }

    throw err;
  }
}

/**
 * Convert a USD amount into on-chain base units (wei / stroops / token atoms)
 * using usdPerAsset and asset decimals.
 *
 * expectedBase = round(usd / usdPerAsset * 10^decimals)
 *
 * Always uses toFixed → BigInt path (no IEEE-754 float multiply).
 */
export function usdToAssetBaseUnits(
  amountUsd: number,
  usdPerAsset: number,
  decimals: number,
): bigint {
  if (!(amountUsd >= 0) || !Number.isFinite(amountUsd)) {
    throw new PricingConfigError(`Invalid USD amount: ${amountUsd}`);
  }
  if (!(usdPerAsset > 0) || !Number.isFinite(usdPerAsset)) {
    throw new PricingConfigError(`Invalid USD-per-asset rate: ${usdPerAsset}`);
  }
  if (!(decimals >= 0) || !Number.isFinite(decimals) || decimals > 36) {
    throw new PricingConfigError(`Invalid asset decimals: ${decimals}`);
  }

  // Exact BigInt math for rational rates (or float to scaled ratio) to avoid IEEE 754 precision artifacts.
  const scale = 1e8;
  const rateScaled = BigInt(Math.round(usdPerAsset * scale));
  const amountUsdScaled = BigInt(Math.round(amountUsd * scale));
  return (amountUsdScaled * 10n ** BigInt(decimals)) / rateScaled;
}

/**
 * Minimum acceptable on-chain amount given expected base units and tolerance bps.
 * variance allowed below expected: expected * (1 - bps/10000)
 */
export function minAcceptableAmount(
  expectedBaseUnits: bigint,
  toleranceBps: number,
): bigint {
  const bps = Math.max(0, Math.min(10_000, Math.floor(toleranceBps)));
  if (bps === 0) return expectedBaseUnits;
  // min = expected * (10000 - bps) / 10000
  return (expectedBaseUnits * BigInt(10_000 - bps)) / 10_000n;
}

/**
 * Full path: USD → expected base units + min acceptable with tolerance.
 */
export async function resolveExpectedPaymentBaseUnits(
  amountUsd: number,
  assetOverride?: string,
): Promise<{
  expectedBaseUnits: bigint;
  minAcceptable: bigint;
  quote: AssetPriceQuote;
  config: PricingConfig;
}> {
  const config = getPricingConfig();
  // Config validation before any network call — fail permanent, not 503.
  if (!(amountUsd >= 0) || !Number.isFinite(amountUsd)) {
    throw new PricingConfigError(`Invalid expectedAmountUsd: ${amountUsd}`);
  }
  if (
    !(config.decimals >= 0) ||
    !Number.isFinite(config.decimals) ||
    config.decimals > 36
  ) {
    throw new PricingConfigError(
      `Invalid PAYMENT_ASSET_DECIMALS: ${config.decimals}`,
    );
  }

  const quote = await getUsdPerAsset(assetOverride || config.asset);
  const expectedBaseUnits = usdToAssetBaseUnits(
    amountUsd,
    quote.usdPerAsset,
    config.decimals,
  );
  const minAcceptable = minAcceptableAmount(
    expectedBaseUnits,
    config.toleranceBps,
  );
  return { expectedBaseUnits, minAcceptable, quote, config };
}

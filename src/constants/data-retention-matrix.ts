/**
 * Canonical on-chain vs off-chain data retention matrix (Issue #127).
 * Served via GET /compliance/data-retention and documented in docs/compliance/data-retention.md.
 */

export interface DataRetentionRow {
  data: string;
  storedWhere: 'mongodb' | 'soroban' | 'redis' | 'not_stored' | 'relay_only';
  retention: string;
  erasableOnRequest: 'yes' | 'no' | 'n_a' | 'partial';
  notes: string;
}

export const DATA_RETENTION_MATRIX: DataRetentionRow[] = [
  {
    data: 'User profile (name, email, password hash)',
    storedWhere: 'mongodb',
    retention: 'Until account erasure or anonymization',
    erasableOnRequest: 'yes',
    notes: 'Removed or anonymized by POST /account/request-erasure',
  },
  {
    data: 'Ticket orders and transaction records (amounts, tx hash)',
    storedWhere: 'mongodb',
    retention: 'Financial record retention policy',
    erasableOnRequest: 'partial',
    notes:
      'User linkage anonymized on erasure; amounts/hashes retained for audit',
  },
  {
    data: 'Temporary session / OTP data',
    storedWhere: 'mongodb',
    retention: '7 days (TempData TTL) / until used',
    erasableOnRequest: 'yes',
    notes: 'MongoDB TTL on TempData collection',
  },
  {
    data: 'Application logs (if persisted to Log collection)',
    storedWhere: 'mongodb',
    retention: '30 days (Log TTL)',
    erasableOnRequest: 'yes',
    notes: 'Runtime logs mask emails and wallet addresses',
  },
  {
    data: 'Anonymization job audit trail',
    storedWhere: 'mongodb',
    retention: '90 days (AnonymizationJob TTL)',
    erasableOnRequest: 'n_a',
    notes: 'Stores target user id only, no PII',
  },
  {
    data: 'zkPassport / zkEmail raw proofs',
    storedWhere: 'not_stored',
    retention: 'Never persisted',
    erasableOnRequest: 'n_a',
    notes: 'Verified in memory; only commitments may be stored on User',
  },
  {
    data: 'ContractEvent indexer records',
    storedWhere: 'mongodb',
    retention: 'Indefinite (no attendee identity)',
    erasableOnRequest: 'n_a',
    notes: 'Privacy-stripped on-chain events; no payer/attendee fields',
  },
  {
    data: 'PaymentRecord payer wallet (Standard / paymentPrivacy=1)',
    storedWhere: 'soroban',
    retention: 'Permanent (blockchain immutability)',
    erasableOnRequest: 'no',
    notes: 'Requires pre-payment disclosure and privacyAcknowledged',
  },
  {
    data: 'PaymentRecord for Anonymous payment (paymentPrivacy=0)',
    storedWhere: 'soroban',
    retention: 'Permanent record without payer wallet linkage',
    erasableOnRequest: 'n_a',
    notes: 'No wallet address stored on-chain for anonymous payment level',
  },
  {
    data: 'Inventory locks',
    storedWhere: 'redis',
    retention: 'Seconds to minutes (lock TTL)',
    erasableOnRequest: 'yes',
    notes: 'Ephemeral; no PII',
  },
];

export const PRIVACY_POLICY_SUMMARY = {
  offChainErasable:
    'Profile data, authentication tokens, and non-financial preferences stored in MongoDB can be erased or anonymized on request.',
  onChainPermanent:
    'Soroban payment and event records are immutable. Standard (public) payments may store your wallet address on-chain permanently; it cannot be deleted after submission.',
  anonymousPaymentGuarantee:
    'Events configured with paymentPrivacy=0 (Anonymous) do not store your wallet address in PaymentRecord on-chain.',
  standardPaymentWarning:
    'Events configured with paymentPrivacy=1 (Standard/Public) store your paying wallet address on the blockchain. This cannot be erased under any right-to-erasure request.',
  policyDocumentPath: 'docs/compliance/data-retention.md',
};

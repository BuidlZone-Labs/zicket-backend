# Zicket Privacy Policy — Data Retention Summary

This is the user-facing privacy summary referenced by issue #127. The live API version is at `GET /compliance/privacy-policy`.

## What we can delete (off-chain)

When you request erasure, we anonymize profile data stored in our database: your name, email, authentication tokens, and notification preferences. Ticket and payment records in our database keep financial amounts for audit, but your personal linkage is removed.

Temporary data (sessions, OTP payloads in `TempData`) expires automatically within 7 days.

## What we cannot delete (on-chain)

Payments on the Stellar/Soroban blockchain create **permanent** records:

- **Standard (public) payments** store your paying wallet address on-chain. This cannot be erased, including under GDPR right-to-erasure requests.
- **Anonymous payments** still create a permanent `PaymentRecord`, but your wallet address is **not** stored in that record.

Event financial state (revenue, cancellation ratios) on Soroban is also immutable.

## Before you pay

If an event uses Standard payment privacy, you must acknowledge (`privacyAcknowledged: true`) that your wallet will be stored permanently on-chain before we process your payment.

## How to exercise your rights

1. `GET /account/erasure-assessment` — see what can and cannot be erased for your account.
2. `POST /account/request-erasure` — anonymize off-chain profile data.

Full technical matrix: `GET /compliance/data-retention`

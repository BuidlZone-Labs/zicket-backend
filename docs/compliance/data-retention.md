# Data Retention & On-Chain Immutability (Issue #127)

This document is the internal compliance reference for Zicket backend operators and legal review. The public API mirror lives at `GET /compliance/data-retention`. The user-facing summary is at `GET /compliance/privacy-policy`.

## Core principle

**Off-chain data** (MongoDB, Redis) can be erased or anonymized on user request. **On-chain data** (Soroban `PaymentRecord`, event financial state) is **immutable** and cannot be deleted after a transaction is submitted.

## Erasable off-chain data

| Data                                    | Storage                    | Retention           | Erasure                                               |
| --------------------------------------- | -------------------------- | ------------------- | ----------------------------------------------------- |
| User profile (name, email, credentials) | MongoDB `User`             | Until erasure       | `POST /account/request-erasure` anonymizes the record |
| Ticket orders                           | MongoDB `TicketOrder`      | Financial retention | User link anonymized; order amounts retained          |
| Transactions                            | MongoDB `Transaction`      | Financial retention | User link anonymized; tx hash retained                |
| OTP / session payloads                  | MongoDB `TempData`         | 7 days (TTL index)  | Auto-expires; not stored on `User` long-term          |
| Persisted app logs                      | MongoDB `Log`              | 30 days (TTL index) | Auto-expires                                          |
| Anonymization audit jobs                | MongoDB `AnonymizationJob` | 90 days (TTL index) | Contains user id only                                 |
| Privacy-stripped indexer events         | MongoDB `ContractEvent`    | Indefinite          | No attendee identity stored                           |

## Permanent on-chain data

| Data                                                         | Storage | Erasable?                                         |
| ------------------------------------------------------------ | ------- | ------------------------------------------------- |
| `PaymentRecord` payer wallet (Standard / `paymentPrivacy=1`) | Soroban | **No** — disclosed before payment                 |
| `PaymentRecord` (Anonymous / `paymentPrivacy=0`)             | Soroban | **No** — permanent record; wallet address omitted |
| Event revenue / cancellation ratios                          | Soroban | **No**                                            |

## Payment privacy levels

| `paymentPrivacy` | Label             | On-chain wallet in PaymentRecord | PaymentRecord permanent | Pre-payment acknowledgment                 |
| ---------------- | ----------------- | -------------------------------- | ----------------------- | ------------------------------------------ |
| `0`              | Anonymous         | No                               | Yes                     | Notice only                                |
| `1`              | Standard (public) | Yes                              | Yes                     | **Required** (`privacyAcknowledged: true`) |

Free events (`eventType=0`) do not trigger payment privacy disclosures.

## User-facing disclosure flow

1. `GET /compliance/privacy-policy` — user-facing erasable vs permanent summary.
2. `GET /event-tickets/:eventId` returns `paymentDisclosure` for paid events.
3. `GET /compliance/payment-privacy-disclosure/:eventId` provides the same disclosure standalone.
4. `POST /ticket-orders/verify-payment` requires `privacyAcknowledged: true` when `paymentPrivacy=1`.

## Right-to-erasure workflow

1. User calls `GET /account/erasure-assessment` to learn off-chain vs on-chain impact.
2. User calls `POST /account/request-erasure` to anonymize off-chain profile data.
3. Response explicitly states if on-chain Standard payment records remain permanent.

## Verification guarantee (Anonymous-only paid history)

Users who **only** purchased paid tickets on events with `paymentPrivacy=0` are assessed as having **no on-chain wallet data** subject to erasure (`anonymousOnlyPaymentHistory: true`, `onChainPermanentData: false`). A permanent anonymous `PaymentRecord` still exists on Soroban without the payer wallet. Users with any Standard (`paymentPrivacy=1`) purchase are flagged with `onChainPermanentData: true`.

## API reference

- `GET /compliance/privacy-policy` — user-facing privacy summary
- `GET /compliance/data-retention` — machine-readable matrix
- `GET /compliance/payment-privacy-disclosure/:eventId` — pre-payment warning
- `GET /account/erasure-assessment` — authenticated impact assessment
- `POST /account/request-erasure` — authenticated off-chain anonymization

## Related issues

- GitHub [#127](https://github.com/BuidlZone-Labs/zicket-backend/issues/127)
- Original retention layer [#87](https://github.com/BuidlZone-Labs/zicket-backend/issues/87)

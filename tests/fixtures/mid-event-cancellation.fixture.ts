/**
 * Mid-event cancellation fixture aligned with zicket-contract payments tests:
 * - bind_event: event_start_ledger=0, event_end_ledger=17280
 * - cancel_event at ledger 1000
 * - single payment of 100_000_000 stroops
 *
 * Contract formula (lib.rs cancel_event):
 *   ratio = elapsed * 10000 / total = 1000 * 10000 / 17280 = 578 (integer division)
 */
export const MID_EVENT_CANCELLATION_FIXTURE = {
  onChainEventId: 'EVENTCAN',
  eventStartLedger: 0,
  eventEndLedger: 17280,
  cancelLedger: 1000,
  /** Integer division — matches Soroban u32 cast in cancel_event. */
  withdrawableRatioBps: Math.floor((1000 * 10_000) / 17280),
  totalRevenue: 100_000_000n,
  platformFeeBps: 0,
  organizerWithdrawn: false,
} as const;

/** Expected on-chain balances for the fixture above. */
export const MID_EVENT_EXPECTED_BALANCES = {
  withdrawableAmount: 5_780_000n,
  refundPoolAmount: 94_220_000n,
  organizerPayoutAmount: 5_780_000n,
} as const;

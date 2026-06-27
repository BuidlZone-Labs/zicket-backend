/**
 * On-chain financial snapshot read from the Soroban payments contract.
 * withdrawable_ratio_bps is always sourced from contract storage — never derived off-chain.
 */
export interface EventFinancialState {
  onChainEventId: string;
  /** Basis points [0, 10000] the organizer may withdraw when cancelled. null if not cancelled on-chain. */
  withdrawableRatioBps: number | null;
  cancelLedger: number | null;
  organizerWithdrawn: boolean;
  /** Total held revenue (get_event_revenue). */
  totalRevenue: bigint;
  platformFeeBps: number;
}

export interface OrganizerBalanceSnapshot {
  onChainEventId: string;
  eventStatus: string;
  totalRevenue: string;
  withdrawableRatioBps: number | null;
  withdrawableAmount: string;
  refundPoolAmount: string;
  organizerPayoutAmount: string;
  organizerWithdrawn: boolean;
  platformFeeBps: number;
  /** Indicates values were computed from live contract reads. */
  source: 'contract';
}

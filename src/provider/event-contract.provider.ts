export interface VerifyAndAttendResult {
  txHash: string;
}

/**
 * Event contract surface for zkPassport verified attendance (#121).
 *
 * Proposed Soroban entrypoint (coordinate with zicket-contract):
 *   verify_and_attend(event_id: Symbol, nullifier: BytesN<32>) -> Result<(), Error>
 *
 * - `event_id` matches the on-chain Symbol stored on EventTicket.onChainEventId
 * - `nullifier` is the zkPassport nullifier (publicSignals[0]) as 32 bytes
 * - Contract rejects duplicate nullifiers per event; cross-event reuse is allowed
 */
export interface IEventContractProvider {
  verifyAndAttend(
    onChainEventId: string,
    nullifier: string,
  ): Promise<VerifyAndAttendResult>;
}

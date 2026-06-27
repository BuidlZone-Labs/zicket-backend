/**
 * Financial math mirrored from zicket-contract/contracts/payments/src/lib.rs
 * (withdraw, claim_refund, cancel_event). Integer division matches Soroban i128/u32.
 */

/** Basis-point denominator used by the payments contract (10_000 = 100%). */
export const BPS_DENOMINATOR = 10_000;

/** Organizer withdrawable amount before platform fee (withdraw()). */
export function computeWithdrawableAmount(
  totalHeld: bigint,
  withdrawableRatioBps: number,
): bigint {
  return (totalHeld * BigInt(withdrawableRatioBps)) / BigInt(BPS_DENOMINATOR);
}

/** Attendee max refund for a held payment (claim_refund()). */
export function computeMaxRefundAmount(
  paymentAmount: bigint,
  withdrawableRatioBps: number,
): bigint {
  const refundRatioBps = BPS_DENOMINATOR - withdrawableRatioBps;
  if (refundRatioBps <= 0) return 0n;
  return (paymentAmount * BigInt(refundRatioBps)) / BigInt(BPS_DENOMINATOR);
}

/** Organizer net payout after platform fee (withdraw()). */
export function computeOrganizerPayout(
  withdrawableAmount: bigint,
  platformFeeBps: number,
): bigint {
  const feeAmount =
    (withdrawableAmount * BigInt(platformFeeBps)) / BigInt(BPS_DENOMINATOR);
  return withdrawableAmount - feeAmount;
}

/** Attendee refund pool (total held minus organizer withdrawable share). */
export function computeRefundPoolAmount(
  totalHeld: bigint,
  withdrawableRatioBps: number,
): bigint {
  return totalHeld - computeWithdrawableAmount(totalHeld, withdrawableRatioBps);
}

import {
  EventFinancialState,
  OrganizerBalanceSnapshot,
} from '../types/payments-contract.types';
import {
  computeOrganizerPayout,
  computeRefundPoolAmount,
  computeWithdrawableAmount,
} from '../utils/proportional-cancellation';
import {
  getPaymentsContractProvider,
  IPaymentsContractProvider,
} from '../provider/payments-contract.provider';

export class OrganizerBalanceService {
  /**
   * Build a dashboard balance snapshot from contract-sourced financial state.
   * All proportional amounts derive from withdrawable_ratio_bps returned by the contract.
   */
  static computeFromContractState(
    eventStatus: string,
    state: EventFinancialState,
  ): OrganizerBalanceSnapshot {
    const ratio = state.withdrawableRatioBps ?? 0;
    const withdrawableAmount = computeWithdrawableAmount(
      state.totalRevenue,
      ratio,
    );
    const refundPoolAmount = computeRefundPoolAmount(state.totalRevenue, ratio);
    const organizerPayoutAmount = computeOrganizerPayout(
      withdrawableAmount,
      state.platformFeeBps,
    );

    return {
      onChainEventId: state.onChainEventId,
      eventStatus,
      totalRevenue: state.totalRevenue.toString(),
      withdrawableRatioBps: state.withdrawableRatioBps,
      withdrawableAmount: withdrawableAmount.toString(),
      refundPoolAmount: refundPoolAmount.toString(),
      organizerPayoutAmount: organizerPayoutAmount.toString(),
      organizerWithdrawn: state.organizerWithdrawn,
      platformFeeBps: state.platformFeeBps,
      source: 'contract',
    };
  }

  /**
   * Reads live contract storage and returns the organizer dashboard balance.
   */
  static async getOrganizerBalanceForEvent(
    onChainEventId: string,
    eventStatus: string,
    provider: IPaymentsContractProvider = getPaymentsContractProvider(),
  ): Promise<OrganizerBalanceSnapshot> {
    const state = await provider.getEventFinancialState(onChainEventId);
    return this.computeFromContractState(eventStatus, state);
  }
}

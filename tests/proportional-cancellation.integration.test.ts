import {
  MID_EVENT_CANCELLATION_FIXTURE,
  MID_EVENT_EXPECTED_BALANCES,
} from './fixtures/mid-event-cancellation.fixture';
import { OrganizerBalanceService } from '../src/services/organizer-balance.service';
import {
  computeMaxRefundAmount,
  computeOrganizerPayout,
  computeRefundPoolAmount,
  computeWithdrawableAmount,
} from '../src/utils/proportional-cancellation';
import { EventFinancialState } from '../src/types/payments-contract.types';
import { ReconciliationService } from '../src/services/reconciliation.service';
import { setPaymentsContractProvider } from '../src/provider/payments-contract.provider';
import { TransactionStateMachine } from '../src/state-machine/transaction.state-machine';

jest.mock('../src/models/event-ticket');
jest.mock('../src/models/transaction');
jest.mock('../src/state-machine/transaction.state-machine', () => {
  const actual = jest.requireActual(
    '../src/state-machine/transaction.state-machine',
  );
  return {
    ...actual,
    TransactionStateMachine: {
      ...actual.TransactionStateMachine,
      apply: jest.fn(),
    },
  };
});

import EventTicket from '../src/models/event-ticket';
import Transaction from '../src/models/transaction';

describe('Proportional cancellation (Issue #3)', () => {
  const fixture = MID_EVENT_CANCELLATION_FIXTURE;
  const originalSorobanRpcUrl = process.env.SOROBAN_RPC_URL;
  const originalPaymentsContractId = process.env.PAYMENTS_CONTRACT_ID;
  const originalNetworkPassphrase = process.env.SOROBAN_NETWORK_PASSPHRASE;

  const contractState: EventFinancialState = {
    onChainEventId: fixture.onChainEventId,
    withdrawableRatioBps: fixture.withdrawableRatioBps,
    cancelLedger: fixture.cancelLedger,
    organizerWithdrawn: fixture.organizerWithdrawn,
    totalRevenue: fixture.totalRevenue,
    platformFeeBps: fixture.platformFeeBps,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    setPaymentsContractProvider(null);
    process.env.SOROBAN_RPC_URL = originalSorobanRpcUrl;
    process.env.PAYMENTS_CONTRACT_ID = originalPaymentsContractId;
    process.env.SOROBAN_NETWORK_PASSPHRASE = originalNetworkPassphrase;
  });

  describe('contract-aligned financial math', () => {
    it('withdrawable_ratio_bps matches contract integer division for mid-event cancel', () => {
      expect(fixture.withdrawableRatioBps).toBe(578);
    });

    it('withdrawable and refund pool sum to total held revenue exactly', () => {
      const withdrawable = computeWithdrawableAmount(
        fixture.totalRevenue,
        fixture.withdrawableRatioBps,
      );
      const refundPool = computeRefundPoolAmount(
        fixture.totalRevenue,
        fixture.withdrawableRatioBps,
      );

      expect(withdrawable).toBe(MID_EVENT_EXPECTED_BALANCES.withdrawableAmount);
      expect(refundPool).toBe(MID_EVENT_EXPECTED_BALANCES.refundPoolAmount);
      expect(withdrawable + refundPool).toBe(fixture.totalRevenue);
    });

    it('attendee max refund uses complement ratio (claim_refund)', () => {
      const paymentAmount = 100_000_000n;
      const maxRefund = computeMaxRefundAmount(
        paymentAmount,
        fixture.withdrawableRatioBps,
      );
      expect(maxRefund).toBe(MID_EVENT_EXPECTED_BALANCES.refundPoolAmount);
    });

    it('organizer payout matches on-chain withdraw() with zero platform fee', () => {
      const withdrawable = computeWithdrawableAmount(
        fixture.totalRevenue,
        fixture.withdrawableRatioBps,
      );
      const payout = computeOrganizerPayout(
        withdrawable,
        fixture.platformFeeBps,
      );
      expect(payout).toBe(MID_EVENT_EXPECTED_BALANCES.organizerPayoutAmount);
    });
  });

  describe('organizer dashboard balance', () => {
    it('displayed balances match on-chain values exactly for mid-event cancellation', async () => {
      const mockProvider = {
        getEventFinancialState: jest.fn().mockResolvedValue(contractState),
        getPlatformFeeBps: jest.fn().mockResolvedValue(0),
      };
      setPaymentsContractProvider(mockProvider);

      const snapshot =
        await OrganizerBalanceService.getOrganizerBalanceForEvent(
          fixture.onChainEventId,
          'cancelled',
          mockProvider,
        );

      expect(snapshot.source).toBe('contract');
      expect(snapshot.withdrawableRatioBps).toBe(578);
      expect(snapshot.withdrawableAmount).toBe(
        MID_EVENT_EXPECTED_BALANCES.withdrawableAmount.toString(),
      );
      expect(snapshot.refundPoolAmount).toBe(
        MID_EVENT_EXPECTED_BALANCES.refundPoolAmount.toString(),
      );
      expect(snapshot.organizerPayoutAmount).toBe(
        MID_EVENT_EXPECTED_BALANCES.organizerPayoutAmount.toString(),
      );
      expect(snapshot.totalRevenue).toBe(fixture.totalRevenue.toString());

      // Dashboard must not show binary refunded/not-refunded — ratio is explicit
      expect(snapshot.withdrawableRatioBps).not.toBe(0);
      expect(snapshot.withdrawableRatioBps).not.toBe(10_000);
    });

    it('rejects proportional balance for non-cancelled events', () => {
      expect(() =>
        OrganizerBalanceService.computeFromContractState('ongoing', {
          ...contractState,
          withdrawableRatioBps: null,
        }),
      ).toThrow('Proportional balance is only available for cancelled events');
    });
  });

  describe('reconciliation reads ratio from contract storage', () => {
    it('syncs withdrawable_ratio_bps from contract without re-deriving', async () => {
      const eventId = '507f1f77bcf86cd799439011';
      const mockProvider = {
        getEventFinancialState: jest.fn().mockResolvedValue(contractState),
        getPlatformFeeBps: jest.fn().mockResolvedValue(0),
      };
      setPaymentsContractProvider(mockProvider);

      process.env.SOROBAN_RPC_URL = 'http://localhost:8000/soroban/rpc';
      process.env.PAYMENTS_CONTRACT_ID =
        'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      process.env.SOROBAN_NETWORK_PASSPHRASE =
        'Test SDF Network ; September 2015';

      const mockFindByIdAndUpdate = jest.fn().mockResolvedValue({});
      (EventTicket.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              _id: eventId,
              onChainEventId: fixture.onChainEventId,
              eventStatus: 'cancelled',
            },
          ]),
        }),
      });
      (EventTicket.findByIdAndUpdate as jest.Mock) = mockFindByIdAndUpdate;

      (Transaction.find as jest.Mock) = jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([{ transactionId: '0xabc', status: 'confirmed' }]),
      });

      (TransactionStateMachine.apply as jest.Mock) = jest
        .fn()
        .mockResolvedValue({
          transitioned: true,
          previousState: 'confirmed',
          newState: 'cancelled',
          message: 'ok',
        });

      const report =
        await ReconciliationService.reconcileCancelledEventFinances();

      expect(mockProvider.getEventFinancialState).toHaveBeenCalledWith(
        fixture.onChainEventId,
      );
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining({
          withdrawableRatioBps: 578,
          cancelLedger: fixture.cancelLedger,
        }),
      );
      expect(TransactionStateMachine.apply).toHaveBeenCalledWith(
        'EVENT_CANCELLED',
        expect.objectContaining({
          txHash: '0xabc',
          withdrawableRatioBps: 578,
          triggeredBy: 'reconciliation',
        }),
      );
      expect(report.cancelledEventsSynced).toBe(1);
      expect(report.cancelledTransactionsUpdated).toBe(1);
    });
  });
});

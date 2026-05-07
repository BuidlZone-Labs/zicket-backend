import { PaymentVerificationService } from '../src/verification/payment-verification.service';
import EventTicket from '../src/models/event-ticket';
import User from '../src/models/user';
import Transaction from '../src/models/transaction';

jest.mock('../src/models/event-ticket');
jest.mock('../src/models/user');
jest.mock('../src/models/transaction');
jest.mock('../src/models/ticket-order');
jest.mock('../src/provider/blockchain.provider', () => ({
  BlockchainProvider: {
    getInstance: jest.fn().mockReturnValue({
      fetchTransaction: jest.fn(),
      getMinConfirmations: jest.fn().mockReturnValue(2),
      getPlatformWallet: jest.fn().mockReturnValue('0xPlatformWallet'),
    }),
  },
}));

const mockEventTicket = EventTicket as jest.Mocked<typeof EventTicket>;
const mockUser = User as jest.Mocked<typeof User>;
const mockTransaction = Transaction as jest.Mocked<typeof Transaction>;

const baseEvent = {
  _id: 'event123',
  name: 'Test Event',
  availableTickets: 10,
  offerReceipts: false,
  privacyLevel: 1,
  allowAnonymous: false,
  requiresVerification: false,
};

describe('PaymentVerificationService - privacy enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockTransaction.findOne as jest.Mock).mockResolvedValue(null);
  });

  describe('allowAnonymous = false', () => {
    it('rejects purchase when user does not exist in DB', async () => {
      (mockEventTicket.findById as jest.Mock).mockResolvedValue({
        ...baseEvent,
        allowAnonymous: false,
        requiresVerification: false,
      });
      (mockUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await PaymentVerificationService.verifyAndIssueTicket(
        '0xTxHash',
        'nonExistentUser',
        'event123',
        'General',
        1,
        10,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'Authentication required to purchase tickets for this event',
      );
    });

    it('proceeds to on-chain verification when user exists', async () => {
      const {
        BlockchainProvider,
      } = require('../src/provider/blockchain.provider');
      const blockchain = BlockchainProvider.getInstance();
      blockchain.fetchTransaction.mockResolvedValue(null);

      (mockEventTicket.findById as jest.Mock).mockResolvedValue({
        ...baseEvent,
        allowAnonymous: false,
        requiresVerification: false,
      });

      // Reset and set up mock properly
      (mockUser.findById as jest.Mock).mockReset();
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'user123' }),
      });
      (mockUser.findById as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await PaymentVerificationService.verifyAndIssueTicket(
        '0xTxHash',
        '507f1f77bcf86cd799439011', // valid ObjectId
        'event123',
        'General',
        1,
        10,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Transaction not found on chain');
    });
  });

  describe('requiresVerification = true', () => {
    it('rejects purchase when user email is not verified', async () => {
      (mockEventTicket.findById as jest.Mock).mockResolvedValue({
        ...baseEvent,
        allowAnonymous: false,
        requiresVerification: true,
      });

      // Reset and set up mock properly - chain select().lean()
      (mockUser.findById as jest.Mock).mockReset();
      (mockUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue({ _id: 'user123', emailVerifiedAt: undefined }),
        }),
      });

      const result = await PaymentVerificationService.verifyAndIssueTicket(
        '0xTxHash',
        '507f1f77bcf86cd799439011', // valid ObjectId
        'event123',
        'General',
        1,
        10,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'Email verification required to purchase tickets for this event',
      );
    });

    it('proceeds when user email is verified', async () => {
      const {
        BlockchainProvider,
      } = require('../src/provider/blockchain.provider');
      const blockchain = BlockchainProvider.getInstance();
      blockchain.fetchTransaction.mockResolvedValue(null);

      (mockEventTicket.findById as jest.Mock).mockResolvedValue({
        ...baseEvent,
        allowAnonymous: false,
        requiresVerification: true,
      });

      // Reset and set up mock properly - chain select().lean()
      (mockUser.findById as jest.Mock).mockReset();
      (mockUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'user123',
            emailVerifiedAt: new Date('2026-01-01'),
          }),
        }),
      });

      const result = await PaymentVerificationService.verifyAndIssueTicket(
        '0xTxHash',
        '507f1f77bcf86cd799439011', // valid ObjectId
        'event123',
        'General',
        1,
        10,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Transaction not found on chain');
    });
  });

  describe('allowAnonymous = true', () => {
    it('skips user lookup and proceeds when anonymous purchases are allowed', async () => {
      const {
        BlockchainProvider,
      } = require('../src/provider/blockchain.provider');
      const blockchain = BlockchainProvider.getInstance();
      blockchain.fetchTransaction.mockResolvedValue(null);

      (mockEventTicket.findById as jest.Mock).mockResolvedValue({
        ...baseEvent,
        allowAnonymous: true,
        requiresVerification: false,
      });

      const result = await PaymentVerificationService.verifyAndIssueTicket(
        '0xTxHash',
        '',
        'event123',
        'General',
        1,
        10,
      );

      expect(mockUser.findById).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toBe('Transaction not found on chain');
    });
  });
});

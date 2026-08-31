import mongoose from 'mongoose';
import {
  isEligibleForAnonymization,
  sha256,
  truncatedPlaceholder,
  runPostEventAnonymization,
  DEFAULT_RETENTION_DAYS,
} from '../src/services/post-event-anonymization.service';
import EventTicket from '../src/models/event-ticket';
import TicketOrder from '../src/models/ticket-order';
import User from '../src/models/user';
import PrivacyAuditLog from '../src/models/privacy-audit';

jest.mock('../src/models/event-ticket');
jest.mock('../src/models/ticket-order');
jest.mock('../src/models/user');
jest.mock('../src/models/privacy-audit');

const mockEventTicket = EventTicket as jest.Mocked<typeof EventTicket>;
const mockTicketOrder = TicketOrder as jest.Mocked<typeof TicketOrder>;
const mockUser = User as jest.Mocked<typeof User>;
const mockPrivacyAuditLog = PrivacyAuditLog as jest.Mocked<
  typeof PrivacyAuditLog
>;

function buildChain<T>(value: T) {
  const chain: any = {
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
  };
  return chain;
}

function buildFindChain<T>(value: T) {
  const chain: any = {
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  return chain;
}

describe('Post-Event Anonymization Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Pure helper tests ────────────────────────────────────────────────────

  describe('isEligibleForAnonymization', () => {
    it('returns true for completed events past retention', () => {
      const eventDate = new Date('2026-06-01');
      jest.setSystemTime(new Date('2026-07-15')); // 44 days later
      expect(isEligibleForAnonymization(eventDate, 30, 'completed')).toBe(true);
    });

    it('returns false for completed events within retention window', () => {
      const eventDate = new Date('2026-06-20');
      jest.setSystemTime(new Date('2026-07-15')); // 25 days later
      expect(isEligibleForAnonymization(eventDate, 30, 'completed')).toBe(
        false,
      );
    });

    it('returns false for ongoing events even if past retention date', () => {
      const eventDate = new Date('2026-04-01');
      jest.setSystemTime(new Date('2026-07-15')); // 105 days later
      expect(isEligibleForAnonymization(eventDate, 30, 'ongoing')).toBe(false);
    });

    it('returns false for upcoming events', () => {
      const eventDate = new Date('2026-08-30');
      jest.setSystemTime(new Date('2026-07-15'));
      expect(isEligibleForAnonymization(eventDate, 30, 'upcoming')).toBe(false);
    });

    it('returns false for cancelled events', () => {
      const eventDate = new Date('2026-04-01');
      jest.setSystemTime(new Date('2026-07-15'));
      expect(isEligibleForAnonymization(eventDate, 30, 'cancelled')).toBe(
        false,
      );
    });
  });

  describe('sha256', () => {
    it('returns deterministic SHA-256 hex digest', () => {
      const hash = sha256('test@example.com');
      expect(hash).toBe(
        '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
      );
      // Verify determinism
      expect(sha256('test@example.com')).toBe(hash);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = sha256('alice@example.com');
      const hash2 = sha256('bob@example.com');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('truncatedPlaceholder', () => {
    it('returns 8-char prefix + redacted suffix', () => {
      const placeholder = truncatedPlaceholder('John Doe');
      expect(placeholder).toMatch(/^[a-f0-9]{8}\.\.\.\[redacted\]$/);
    });
  });

  // ─── Integration: runPostEventAnonymization ────────────────────────────────

  describe('runPostEventAnonymization', () => {
    it('anonymizes attendees of completed events past retention', async () => {
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const eventId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      // Completed event past retention
      (mockEventTicket.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventStatus === 'completed') {
          return buildFindChain([
            {
              _id: eventId,
              name: 'Past Hackathon',
              eventDate: new Date('2026-06-01'),
              eventStatus: 'completed',
              privacyLevel: 1,
            },
          ]);
        }
        // No active events
        return buildFindChain([]);
      });

      // Orders for the completed event
      (mockTicketOrder.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventTicket?.toString() === eventId.toString()) {
          return {
            lean: jest.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                eventTicket: eventId,
                status: 1,
                amount: 25,
              },
            ]),
          };
        }
        // Active orders check
        return { lean: jest.fn().mockResolvedValue([]) };
      });

      // User exists and not yet anonymized
      const mockUserInstance = {
        _id: userId,
        name: 'Alice Attendee',
        email: 'alice@example.com',
        anonymizedAt: null,
        password: 'hashed',
        googleId: 'g123',
        otp: 123456,
        otpExpires: new Date(),
        magicToken: 'tok',
        magicTokenExpires: new Date(),
        zkEmail: 'zk',
        zkPassport: 'zkp',
        zkEmailVerified: true,
        zkPassportVerified: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserInstance);

      // Audit log
      (mockPrivacyAuditLog.create as jest.Mock).mockResolvedValue({});

      const report = await runPostEventAnonymization(30, 'retention_expired');

      expect(report.eventsEligible).toBe(1);
      expect(report.ordersScanned).toBe(1);
      expect(report.usersRedacted).toBe(1);
      expect(report.auditLogsCreated).toBe(1);

      // Verify PII was replaced
      expect(mockUserInstance.email).not.toBe('alice@example.com');
      expect(mockUserInstance.email).toContain('redacted+');
      expect(mockUserInstance.email).toContain('anonymized.zicket.local');
      expect(mockUserInstance.name).not.toBe('Alice Attendee');
      expect(mockUserInstance.name).toContain('[redacted]');

      // Verify user marked as anonymized
      expect(mockUserInstance.anonymizedAt).toBeInstanceOf(Date);

      // Verify auth fields cleared
      expect(mockUserInstance.password).toBeUndefined();
      expect(mockUserInstance.googleId).toBeUndefined();
      expect(mockUserInstance.otp).toBeUndefined();
      expect(mockUserInstance.magicToken).toBeUndefined();
      expect(mockUserInstance.zkEmail).toBeUndefined();
      expect(mockUserInstance.zkPassport).toBeUndefined();
      expect(mockUserInstance.zkEmailVerified).toBe(false);
      expect(mockUserInstance.zkPassportVerified).toBe(false);

      // Verify save was called
      expect(mockUserInstance.save).toHaveBeenCalled();

      // Verify audit log
      expect(mockPrivacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId,
          eventName: 'Past Hackathon',
          ordersScanned: 1,
          usersRedacted: 1,
          fieldsRedacted: expect.arrayContaining(['email', 'name']),
          method: 'sha256',
          trigger: 'retention_expired',
        }),
      );
    });

    it('does not anonymize users with active (upcoming/ongoing) event orders', async () => {
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const completedEventId = new mongoose.Types.ObjectId();
      const activeEventId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      (mockEventTicket.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventStatus === 'completed') {
          return buildFindChain([
            {
              _id: completedEventId,
              name: 'Past Conference',
              eventDate: new Date('2026-05-01'),
              eventStatus: 'completed',
              privacyLevel: 1,
            },
          ]);
        }
        // Active events
        return buildFindChain([
          { _id: activeEventId, name: 'Upcoming Summit' },
        ]);
      });

      // Orders for completed event
      (mockTicketOrder.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventTicket?.toString() === completedEventId.toString()) {
          return {
            lean: jest.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                eventTicket: completedEventId,
                status: 1,
                amount: 50,
              },
            ]),
          };
        }
        // User has order for active event
        return {
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            {
              _id: new mongoose.Types.ObjectId(),
              user: userId,
              eventTicket: activeEventId,
              status: 1,
            },
          ]),
        };
      });

      (mockPrivacyAuditLog.create as jest.Mock).mockResolvedValue({});

      const report = await runPostEventAnonymization(30, 'retention_expired');

      // Event was scanned but user was skipped (orders scanned but no users redacted)
      expect(report.eventsEligible).toBe(1);
      expect(report.ordersScanned).toBe(1);
      expect(report.usersRedacted).toBe(0);
      expect(report.usersSkippedActive).toBe(1);

      // User should NOT have been touched
      expect(mockUser.findById).not.toHaveBeenCalled();
    });

    it('skips already-anonymized users', async () => {
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const eventId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      (mockEventTicket.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventStatus === 'completed') {
          return buildFindChain([
            {
              _id: eventId,
              name: 'Old Workshop',
              eventDate: new Date('2026-03-01'),
              eventStatus: 'completed',
              privacyLevel: 0,
            },
          ]);
        }
        return buildFindChain([]);
      });

      (mockTicketOrder.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventTicket?.toString() === eventId.toString()) {
          return {
            lean: jest.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                eventTicket: eventId,
                status: 1,
                amount: 0,
              },
            ]),
          };
        }
        return { lean: jest.fn().mockResolvedValue([]) };
      });

      // User already anonymized
      const mockUserInstance = {
        _id: userId,
        name: 'Deleted User',
        email: 'deleted+abc@anonymized.zicket.local',
        anonymizedAt: new Date('2026-05-01'),
        save: jest.fn().mockResolvedValue(undefined),
      };
      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserInstance);

      (mockPrivacyAuditLog.create as jest.Mock).mockResolvedValue({});

      const report = await runPostEventAnonymization(30, 'retention_expired');

      expect(report.eventsEligible).toBe(1);
      expect(report.usersRedacted).toBe(0);
      // save should not be called for already-anonymized user
      expect(mockUserInstance.save).not.toHaveBeenCalled();
    });

    it('returns empty report when no events are eligible', async () => {
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      // No completed events
      (mockEventTicket.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventStatus === 'completed') {
          return buildFindChain([]);
        }
        return buildFindChain([]);
      });

      const report = await runPostEventAnonymization(30, 'retention_expired');

      expect(report.eventsScanned).toBe(0);
      expect(report.eventsEligible).toBe(0);
      expect(report.ordersScanned).toBe(0);
      expect(report.usersRedacted).toBe(0);
      expect(report.auditLogsCreated).toBe(0);
    });

    it('handles events with no ticket orders', async () => {
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const eventId = new mongoose.Types.ObjectId();

      (mockEventTicket.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventStatus === 'completed') {
          return buildFindChain([
            {
              _id: eventId,
              name: 'Empty Event',
              eventDate: new Date('2026-05-01'),
              eventStatus: 'completed',
              privacyLevel: 1,
            },
          ]);
        }
        return buildFindChain([]);
      });

      // No orders
      (mockTicketOrder.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const report = await runPostEventAnonymization(30, 'retention_expired');

      expect(report.eventsEligible).toBe(1);
      expect(report.ordersScanned).toBe(0);
      expect(report.usersRedacted).toBe(0);
    });

    it('preserves manual trigger in audit log', async () => {
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const eventId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      (mockEventTicket.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventStatus === 'completed') {
          return buildFindChain([
            {
              _id: eventId,
              name: 'Manual Run Event',
              eventDate: new Date('2026-05-01'),
              eventStatus: 'completed',
              privacyLevel: 1,
            },
          ]);
        }
        return buildFindChain([]);
      });

      (mockTicketOrder.find as jest.Mock).mockImplementation((query: any) => {
        if (query.eventTicket?.toString() === eventId.toString()) {
          return {
            lean: jest.fn().mockResolvedValue([
              {
                _id: new mongoose.Types.ObjectId(),
                user: userId,
                eventTicket: eventId,
                status: 1,
                amount: 10,
              },
            ]),
          };
        }
        return { lean: jest.fn().mockResolvedValue([]) };
      });

      const mockUserInstance = {
        _id: userId,
        name: 'Bob User',
        email: 'bob@example.com',
        anonymizedAt: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserInstance);
      (mockPrivacyAuditLog.create as jest.Mock).mockResolvedValue({});

      const report = await runPostEventAnonymization(30, 'manual');

      expect(report.usersRedacted).toBe(1);

      // Verify audit log uses 'manual' trigger, not 'retention_expired'
      expect(mockPrivacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'manual',
        }),
      );
    });
  });
});

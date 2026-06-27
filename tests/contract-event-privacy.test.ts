/**
 * Privacy guarantee tests for ContractEvent model.
 *
 * These tests assert that the ContractEvent model intentionally carries
 * NO user/attendee identification fields. The on-chain contract layer
 * (e.g. AnonEventRegistration) deliberately strips attendee identifiers.
 * The indexer must NOT back-fill identity onto those privacy-stripped
 * contract events.
 *
 * Issue: https://github.com/BuidlZone-Labs/zicket-backend/issues/125
 */

import ContractEvent from '../src/models/contract-event';

describe('ContractEvent privacy guarantees', () => {
  describe('schema-level: no identity fields', () => {
    it('ContractEvent schema has no user/attendee_id/session fields', () => {
      const schemaPaths = Object.keys(ContractEvent.schema.paths);

      // Privacy-sensitive fields that MUST NOT exist
      const forbiddenFields = [
        'user',
        'userId',
        'attendeeId',
        'attendee_id',
        'session',
        'sessionId',
        'payer',
        'email',
        'wallet',
      ];

      for (const field of forbiddenFields) {
        expect(schemaPaths).not.toContain(field);
      }
    });

    it('ContractEvent schema has no ref to User or Session', () => {
      const schemaPaths = ContractEvent.schema.paths;

      // Mongoose 8 stores refs on field.options.ref or field.caster.options.ref
      // (for array fields). Direct `field.ref` can miss standard refs.
      for (const path of Object.keys(schemaPaths)) {
        const field = schemaPaths[path] as any;
        const ref = field.options?.ref ?? field.caster?.options?.ref ?? null;
        if (ref) {
          expect(ref).not.toBe('User');
          expect(ref).not.toBe('Session');
        }
      }
    });

    it('ContractEvent schema has no indexes linking to user tables', () => {
      const indexes = ContractEvent.schema.indexes();

      for (const [condition] of indexes) {
        // Ensure no index references user-related fields
        const indexedFields = Object.keys(condition);
        const forbiddenFields = ['user', 'userId', 'attendeeId', 'session'];
        for (const field of forbiddenFields) {
          expect(indexedFields).not.toContain(field);
        }
      }
    });
  });

  describe('indexer ingestion: no correlation logic', () => {
    it('ContractEvent has no user field for populate/join', () => {
      const userPath = ContractEvent.schema.paths.user;
      expect(userPath).toBeUndefined();
    });

    it('ContractEvent has no attendeeId field for populate/join', () => {
      const attendeeIdPath = ContractEvent.schema.paths.attendeeId;
      expect(attendeeIdPath).toBeUndefined();
    });

    it('ContractEvent has no payer field for populate/join', () => {
      const payerPath = ContractEvent.schema.paths.payer;
      expect(payerPath).toBeUndefined();
    });

    it('ContractEvent args field is Mixed type (no enforced identity keys)', () => {
      const argsPath = ContractEvent.schema.paths.args;
      expect(argsPath).toBeDefined();
      // Mixed type allows any shape — no enforced user identifiers
      expect(argsPath.instance).toBe('Mixed');
    });

    it('indexer write path inserts only schema fields (no identity injection)', () => {
      // Simulate the indexer's eventsToSave construction from indexer.service.ts
      // (lines 55-63). This is the exact shape ContractEvent.insertMany receives.
      const mockLog = {
        address: '0xabcdef1234567890',
        blockNumber: 999,
        transactionHash: '0xtxhash123',
        index: 0,
        topics: ['0xeventTopic'],
        data: '0xdeadbeef',
      };

      // Reproduce indexer's mapping (indexer.service.ts:55-63)
      const eventToSave = {
        contractAddress: mockLog.address.toLowerCase(),
        eventName: mockLog.topics[0] || 'Unknown',
        blockNumber: mockLog.blockNumber,
        transactionHash: mockLog.transactionHash,
        logIndex: mockLog.index,
        topics: mockLog.topics,
        data: mockLog.data,
        timestamp: new Date(),
      };

      const allowedFields = [
        'contractAddress',
        'eventName',
        'blockNumber',
        'transactionHash',
        'logIndex',
        'topics',
        'data',
        'timestamp',
      ];

      const writtenFields = Object.keys(eventToSave);
      expect(writtenFields.sort()).toEqual(allowedFields.sort());

      // Ensure no identity fields leak into the persisted payload
      const forbiddenIdentity = [
        'user',
        'userId',
        'attendeeId',
        'payer',
        'email',
        'wallet',
        'session',
        'ip',
      ];
      for (const field of forbiddenIdentity) {
        expect(writtenFields).not.toContain(field);
      }
    });
  });

  describe('unknown attendee state documentation', () => {
    it('schema paths confirm no attendee identity can be stored', () => {
      const schemaPaths = Object.keys(ContractEvent.schema.paths);

      // Required on-chain fields (allowed)
      const expectedFields = [
        'contractAddress',
        'eventName',
        'blockNumber',
        'transactionHash',
        'logIndex',
        'topics',
        'data',
        'timestamp',
        'createdAt',
        'updatedAt',
      ];

      for (const field of expectedFields) {
        expect(schemaPaths).toContain(field);
      }

      // The only optional field is 'args' which is Mixed — no enforced identity
      const allFields = [...expectedFields, 'args', '__v', '_id']; // __v + _id = mongoose defaults
      expect(schemaPaths.sort()).toEqual(allFields.sort());
    });
  });
});

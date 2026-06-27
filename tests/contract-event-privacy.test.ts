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

      // Check that no path has a ref to User or Session
      for (const path of Object.keys(schemaPaths)) {
        const field = schemaPaths[path];
        if ('ref' in field) {
          expect(field.ref).not.toBe('User');
          expect(field.ref).not.toBe('Session');
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
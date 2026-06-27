import {
  PaymentPrivacyDisclosureService,
  PAYMENT_PRIVACY_ANONYMOUS,
  PAYMENT_PRIVACY_STANDARD,
} from '../src/services/payment-privacy-disclosure.service';

describe('PaymentPrivacyDisclosureService', () => {
  describe('buildDisclosure', () => {
    it('returns not_applicable for free events', () => {
      const d = PaymentPrivacyDisclosureService.buildDisclosure(0, 1);
      expect(d.level).toBe('not_applicable');
      expect(d.acknowledgmentRequired).toBe(false);
      expect(d.warning).toBeNull();
    });

    it('requires acknowledgment for Standard paid events', () => {
      const d = PaymentPrivacyDisclosureService.buildDisclosure(
        1,
        PAYMENT_PRIVACY_STANDARD,
      );
      expect(d.level).toBe('standard');
      expect(d.onChainWalletStored).toBe(true);
      expect(d.onChainDataPermanent).toBe(true);
      expect(d.acknowledgmentRequired).toBe(true);
      expect(d.warning).toMatch(/cannot be erased/i);
      expect(d.warning).toMatch(/wallet address/i);
    });

    it('does not require acknowledgment for Anonymous paid events', () => {
      const d = PaymentPrivacyDisclosureService.buildDisclosure(
        1,
        PAYMENT_PRIVACY_ANONYMOUS,
      );
      expect(d.level).toBe('anonymous');
      expect(d.onChainWalletStored).toBe(false);
      expect(d.acknowledgmentRequired).toBe(false);
      expect(d.warning).toMatch(/not stored/i);
    });
  });

  describe('validateAcknowledgment', () => {
    it('rejects Standard payment without privacyAcknowledged', () => {
      const err = PaymentPrivacyDisclosureService.validateAcknowledgment(
        1,
        PAYMENT_PRIVACY_STANDARD,
        false,
      );
      expect(err).toMatch(/privacyAcknowledged must be true/i);
    });

    it('allows Standard payment when privacyAcknowledged is true', () => {
      const err = PaymentPrivacyDisclosureService.validateAcknowledgment(
        1,
        PAYMENT_PRIVACY_STANDARD,
        true,
      );
      expect(err).toBeNull();
    });

    it('allows Anonymous payment without privacyAcknowledged', () => {
      const err = PaymentPrivacyDisclosureService.validateAcknowledgment(
        1,
        PAYMENT_PRIVACY_ANONYMOUS,
        undefined,
      );
      expect(err).toBeNull();
    });
  });
});

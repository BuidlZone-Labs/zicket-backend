/**
 * Pre-payment privacy disclosures for paid events (Issue #127).
 * paymentPrivacy: 0 = Anonymous, 1 = Standard/Public (wallet on-chain).
 */

export const PAYMENT_PRIVACY_ANONYMOUS = 0;
export const PAYMENT_PRIVACY_STANDARD = 1;

export interface PaymentPrivacyDisclosure {
  required: boolean;
  paymentPrivacy: number | null;
  level: 'anonymous' | 'standard' | 'not_applicable';
  onChainWalletStored: boolean;
  onChainDataPermanent: boolean;
  warning: string | null;
  acknowledgmentRequired: boolean;
  policyReference: string;
}

const STANDARD_WARNING =
  'This event uses Standard (public) payment privacy. Your paying wallet address ' +
  'will be stored on the Stellar/Soroban blockchain as part of the payment record. ' +
  'Blockchain data is permanent and cannot be erased, including under right-to-erasure requests. ' +
  'By proceeding you acknowledge this limitation.';

const ANONYMOUS_NOTICE =
  'This event uses Anonymous payment privacy. A permanent Soroban PaymentRecord is still ' +
  'created on-chain, but your paying wallet address is not stored in that record. ' +
  'Off-chain account data remains subject to our erasure policy.';

export class PaymentPrivacyDisclosureService {
  /**
   * Builds the disclosure payload shown before payment for a paid event.
   */
  static buildDisclosure(
    eventType: number,
    paymentPrivacy?: number | null,
  ): PaymentPrivacyDisclosure {
    if (eventType !== 1) {
      return {
        required: false,
        paymentPrivacy: paymentPrivacy ?? null,
        level: 'not_applicable',
        onChainWalletStored: false,
        onChainDataPermanent: false,
        warning: null,
        acknowledgmentRequired: false,
        policyReference: '/compliance/data-retention',
      };
    }

    const level =
      paymentPrivacy === PAYMENT_PRIVACY_STANDARD ? 'standard' : 'anonymous';

    if (paymentPrivacy === PAYMENT_PRIVACY_STANDARD) {
      return {
        required: true,
        paymentPrivacy,
        level,
        onChainWalletStored: true,
        onChainDataPermanent: true,
        warning: STANDARD_WARNING,
        acknowledgmentRequired: true,
        policyReference: '/compliance/data-retention',
      };
    }

    return {
      required: true,
      paymentPrivacy: paymentPrivacy ?? PAYMENT_PRIVACY_ANONYMOUS,
      level,
      onChainWalletStored: false,
      onChainDataPermanent: true,
      warning: ANONYMOUS_NOTICE,
      acknowledgmentRequired: false,
      policyReference: '/compliance/data-retention',
    };
  }

  /**
   * Returns an error message when Standard payment proceeds without acknowledgment.
   */
  static validateAcknowledgment(
    eventType: number,
    paymentPrivacy: number | null | undefined,
    privacyAcknowledged?: boolean,
  ): string | null {
    const disclosure = this.buildDisclosure(eventType, paymentPrivacy);
    if (!disclosure.acknowledgmentRequired) {
      return null;
    }
    if (privacyAcknowledged !== true) {
      return (
        'privacyAcknowledged must be true before paying for Standard (public) ' +
        'payment events. Review GET /compliance/payment-privacy-disclosure/:eventId ' +
        'or the event paymentDisclosure field.'
      );
    }
    return null;
  }
}

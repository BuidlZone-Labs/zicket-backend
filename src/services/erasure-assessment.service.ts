import mongoose from 'mongoose';
import TicketOrder from '../models/ticket-order';
import EventTicket from '../models/event-ticket';
import { PAYMENT_PRIVACY_STANDARD } from './payment-privacy-disclosure.service';

export interface ErasureAssessment {
  userId: string;
  offChainErasable: boolean;
  onChainPermanentData: boolean;
  onChainPermanentReasons: string[];
  ordersReviewed: number;
  standardPaymentOrders: number;
  anonymousOnlyPaymentHistory: boolean;
}

/**
 * Assesses right-to-erasure impact: off-chain vs immutable on-chain data (Issue #127).
 */
export class ErasureAssessmentService {
  static async assessUser(userId: string): Promise<ErasureAssessment> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }

    const orders = await TicketOrder.find({
      user: new mongoose.Types.ObjectId(userId),
    })
      .select('eventTicket paymentPrivacy')
      .lean();

    const eventIds = [...new Set(orders.map((o) => o.eventTicket.toString()))];

    const events =
      eventIds.length > 0
        ? await EventTicket.find({ _id: { $in: eventIds } })
            .select('eventType paymentPrivacy name')
            .lean()
        : [];

    const eventById = new Map(events.map((e) => [e._id.toString(), e]));

    const onChainPermanentReasons: string[] = [];
    let standardPaymentOrders = 0;

    for (const order of orders) {
      const event = eventById.get(order.eventTicket.toString());
      if (!event || event.eventType !== 1) {
        continue;
      }

      const effectivePrivacy =
        order.paymentPrivacy ?? event.paymentPrivacy ?? null;

      if (effectivePrivacy === PAYMENT_PRIVACY_STANDARD) {
        standardPaymentOrders++;
        onChainPermanentReasons.push(
          `Standard payment for event "${event.name}": wallet address is stored permanently on Soroban PaymentRecord`,
        );
      }
    }

    const onChainPermanentData = standardPaymentOrders > 0;
    const anonymousOnlyPaymentHistory =
      orders.length > 0 && standardPaymentOrders === 0;

    return {
      userId,
      offChainErasable: true,
      onChainPermanentData,
      onChainPermanentReasons,
      ordersReviewed: orders.length,
      standardPaymentOrders,
      anonymousOnlyPaymentHistory,
    };
  }
}

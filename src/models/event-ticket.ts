import mongoose, { Schema, Document } from 'mongoose';

export interface IEventTicket extends Document {
  name: string;
  about: string;
  price: number; // 0 for free events, >0 for paid events
  privacyLevel: number; // 0 - anonymous, 1 - wallet-required, 2 - verified-access
  eventCategory: string; // the category this event ticket belongs to (e.g., web3 & crypto meetups, hackathons)
  organizedBy: mongoose.Types.ObjectId; // references to User model
  eventDate: Date; // date and time of the event
  location: string;
  locationType: number; // 0 - exact, 1 - general
  ticketType: Array<{
    ticketName: string;
    quantity: number;
    currencyOrToken: string;
    price: number;
  }>;
  totalTickets: number; // total number of tickets available for the event
  availableTickets: number; // number of tickets still available
  soldTickets: number; // number of tickets sold
  eventStatus: string; // upcoming, ongoing, completed, cancelled
  imageUrl: string; // image representing the event (Cloudinary URL)
  cloudinary_public_id?: string; // Cloudinary public ID for invalidation/destroy (required for new tickets)
  tags: string[]; // tags for better searchability
  isTrending: boolean; // flag to indicate if the event is trending
  attendanceMode?: string; // derived from privacy level
  eventType: number; // 0 - FREE, 1 - PAID (requires privacy level to be wallet-required)
  paymentPrivacy?: number; // 0 - anonymous, 1 - public
  offerReceipts?: boolean; // whether to offer receipts
  hasZkEmailUpdates?: boolean; // whether user has opted in for zk-email updates
  hasEventReminders?: boolean; // whether user has opted in for event reminders
  isPublished: boolean; // whether the event is published
}

const eventTicketSchema = new Schema<IEventTicket>(
  {
    name: { type: String, required: true },
    about: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    privacyLevel: { type: Number, required: true, enum: [0, 1, 2], default: 1 },
    eventCategory: { type: String, required: true },
    organizedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventDate: { type: Date, required: true },
    location: { type: String, required: true, default: 'Virtual' },
    locationType: { type: Number, enum: [0, 1], default: 1 }, // 0 - exact, 1 - general
    ticketType: [
      {
        ticketName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
        currencyOrToken: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    totalTickets: { type: Number, required: true, min: 0 },
    availableTickets: { type: Number, required: true, min: 0 },
    soldTickets: { type: Number, required: true, min: 0, default: 0 },
    eventStatus: {
      type: String,
      required: true,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    imageUrl: { type: String, required: true },
    cloudinary_public_id: { type: String, required: false },
    tags: [{ type: String }],
    isTrending: { type: Boolean, default: false },
    attendanceMode: { type: String },
    eventType: { type: Number, enum: [0, 1], default: 0 }, // 0 - FREE, 1 - PAID
    paymentPrivacy: { type: Number, enum: [0, 1] }, // 0 - anonymous, 1 - public
    offerReceipts: { type: Boolean, default: false },
    hasZkEmailUpdates: { type: Boolean, default: false },
    hasEventReminders: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const EventTicket = mongoose.model<IEventTicket>(
  'EventTicket',
  eventTicketSchema,
);
export default EventTicket;

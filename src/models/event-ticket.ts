import mongoose, { Schema, Document } from 'mongoose';

// Privacy settings enums
export enum PrivacyLevel {
  ANONYMOUS = 'anonymous',
  WALLET_REQUIRED = 'wallet-required',
  VERIFIED_ACCESS = 'verified-access',
}

export enum EventType {
  FREE = 'FREE',
  PAID = 'PAID',
}

export enum LocationType {
  EXACT = 'exact',
  GENERAL = 'general',
}

export enum PaymentPrivacy {
  ANONYMOUS = 'anonymous',
  PUBLIC = 'public',
}

export enum AttendanceMode {
  ONLINE = 'online',
  IN_PERSON = 'in-person',
  HYBRID = 'hybrid',
}

// Ticket type interface
export interface ITicketType {
  ticketName: string;
  quantity: number;
  currencyOrToken: string;
  price: number;
}

export interface IEventTicket extends Document {
  name: string;
  about: string;
  price: number; // 0 for free events, >0 for paid events
  privacyLevel: PrivacyLevel; // Privacy level setting
  attendanceMode: AttendanceMode; // Mode of attendance based on privacy level
  eventType: EventType; // FREE or PAID
  eventCategory: string; // the category this event ticket belongs to (e.g., web3 & crypto meetups, hackathons)
  organizedBy: mongoose.Types.ObjectId; // references to User model
  eventDate: Date; // date and time of the event
  location: string; // Actual location address
  locationType: LocationType; // exact or general location visibility
  paymentPrivacy: PaymentPrivacy; // anonymous or public payment
  offerReceipts: boolean; // Whether to offer receipts
  hasZkEmailUpdates: boolean; // Enable ZK email updates
  hasEventReminders: boolean; // Enable event reminders
  ticketType: ITicketType[]; // Array of ticket types with pricing details
  isPublished: boolean; // Whether the event is published
  totalTickets: number; // total number of tickets available for the event
  availableTickets: number; // number of tickets still available
  soldTickets: number; // number of tickets sold
  eventStatus: string; // upcoming, ongoing, completed, cancelled
  imageUrl: string; // image representing the event
  tags: string[]; // tags for better searchability
  isTrending: boolean; // flag to indicate if the event is trending
}

const ticketTypeSchema = new Schema<ITicketType>(
  {
    ticketName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    currencyOrToken: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const eventTicketSchema = new Schema<IEventTicket>(
  {
    name: { type: String, required: true },
    about: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    privacyLevel: {
      type: String,
      required: true,
      enum: Object.values(PrivacyLevel),
      default: PrivacyLevel.WALLET_REQUIRED,
    },
    attendanceMode: {
      type: String,
      required: true,
      enum: Object.values(AttendanceMode),
      default: AttendanceMode.HYBRID,
    },
    eventType: {
      type: String,
      required: true,
      enum: Object.values(EventType),
      default: EventType.FREE,
    },
    eventCategory: { type: String, required: true },
    organizedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventDate: { type: Date, required: true },
    location: { type: String, required: true, default: 'Virtual' },
    locationType: {
      type: String,
      required: true,
      enum: Object.values(LocationType),
      default: LocationType.GENERAL,
    },
    paymentPrivacy: {
      type: String,
      required: true,
      enum: Object.values(PaymentPrivacy),
      default: PaymentPrivacy.PUBLIC,
    },
    offerReceipts: { type: Boolean, default: false },
    hasZkEmailUpdates: { type: Boolean, default: false },
    hasEventReminders: { type: Boolean, default: false },
    ticketType: [ticketTypeSchema],
    isPublished: { type: Boolean, default: false },
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
    tags: [{ type: String }],
    isTrending: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const EventTicket = mongoose.model<IEventTicket>(
  'EventTicket',
  eventTicketSchema,
);
export default EventTicket;

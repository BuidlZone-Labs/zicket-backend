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
    ticketType: string[]; // based on price (e.g., free, paid), with free being 0 price and paid being >0 price
    totalTickets: number; // total number of tickets available for the event
    availableTickets: number; // number of tickets still available
    soldTickets: number; // number of tickets sold
    eventStatus: string; // upcoming, ongoing, completed, cancelled
    imageUrl: string; // image representing the event
    tags: string[]; // tags for better searchability
}

const eventTicketSchema = new Schema<IEventTicket>({
    name: { type: String, required: true },
    about: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    privacyLevel: { type: Number, required: true, enum: [0, 1, 2], default: 1 },
    eventCategory: { type: String, required: true },
    organizedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventDate: { type: Date, required: true },
    location: { type: String, required: true, default: 'Virtual' },
    ticketType: [{ type: String, required: true }],
    totalTickets: { type: Number, required: true, min: 0 },
    availableTickets: { type: Number, required: true, min: 0 },
    soldTickets: { type: Number, required: true, min: 0, default: 0 },
    eventStatus: { type: String, required: true, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },
    imageUrl: { type: String, required: true },
    tags: [{ type: String }],
}, { timestamps: true });

const EventTicket = mongoose.model<IEventTicket>('EventTicket', eventTicketSchema);
export default EventTicket;

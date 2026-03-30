import { z } from 'zod';

export const CreateEventStepOneSchema = z
  .object({
    eventTitle: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title is too long'),

    description: z
      .string()
      .min(10, 'Description must be at least 10 characters'),

    tags: z.array(z.string()).min(1, 'At least one tag is required'),

    startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid start date',
    }),

    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: 'Invalid start time (HH:mm format required)',
    }),

    endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid end date',
    }),

    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: 'Invalid end time (HH:mm format required)',
    }),

    eventTicketImage: z.string().url('Must be a valid image URL'),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.startDate}T${data.startTime}`);
      const end = new Date(`${data.endDate}T${data.endTime}`);
      return end > start;
    },
    {
      message: 'End date/time must be after start date/time',
      path: ['endDate'],
    },
  );

export type CreateEventStepOneInput = z.infer<typeof CreateEventStepOneSchema>;

// Privacy level enum: 0 - anonymous, 1 - wallet-required, 2 - verified-access
export const PrivacyLevelEnum = z.enum(['0', '1', '2']).transform(Number);

// Event type enum: 0 - FREE, 1 - PAID
export const EventTypeEnum = z.enum(['0', '1']).transform(Number);

// Location type enum: 0 - exact, 1 - general
export const LocationTypeEnum = z.enum(['0', '1']).transform(Number);

// Payment privacy enum: 0 - anonymous, 1 - public
export const PaymentPrivacyEnum = z.enum(['0', '1']).transform(Number);

// Ticket type schema
export const TicketTypeSchema = z.object({
  ticketName: z
    .string()
    .min(1, 'Ticket name is required')
    .max(100, 'Ticket name is too long'),
  quantity: z.number().int().positive('Quantity must be a positive number'),
  currencyOrToken: z.string().min(1, 'Currency or token is required'),
  price: z.number().nonnegative('Price must be non-negative'),
});

export const CreateEventStepTwoSchema = z
  .object({
    // Privacy settings
    privacyLevel: PrivacyLevelEnum,
    attendanceMode: z.string().optional(),

    // Event type (PAID requires privacy level to be wallet-required)
    eventType: EventTypeEnum,

    // Location settings
    locationType: LocationTypeEnum,
    location: z.string().min(1, 'Location is required'),

    // Payment privacy (for paid events)
    paymentPrivacy: PaymentPrivacyEnum.optional(),

    // Preferences
    offerReceipts: z.boolean().default(false),
    hasZkEmailUpdates: z.boolean().default(false),
    hasEventReminders: z.boolean().default(false),

    // Ticket types (array of ticket objects)
    ticketTypes: z
      .array(TicketTypeSchema)
      .min(1, 'At least one ticket type is required'),

    // Publication status
    isPublished: z.boolean().default(false),

    // Privacy configuration
    allowAnonymous: z.boolean().default(false),
    requiresVerification: z.boolean().default(false),
  })
  .refine(
    (data) => {
      // If eventType is PAID (1), privacyLevel must be wallet-required (1)
      if (data.eventType === 1 && data.privacyLevel !== 1) {
        return false;
      }
      return true;
    },
    {
      message: 'PAID events require privacy level to be set to Wallet-Required',
      path: ['privacyLevel'],
    },
  )
  .refine(
    (data) => {
      // If eventType is PAID, paymentPrivacy should be required
      if (data.eventType === 1 && data.paymentPrivacy === undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'Payment privacy is required for PAID events',
      path: ['paymentPrivacy'],
    },
  )
  .refine(
    (data) => {
      // allowAnonymous and requiresVerification are mutually exclusive
      if (data.allowAnonymous && data.requiresVerification) {
        return false;
      }
      return true;
    },
    {
      message:
        'allowAnonymous and requiresVerification cannot both be true',
      path: ['requiresVerification'],
    },
  );

export type CreateEventStepTwoInput = z.infer<typeof CreateEventStepTwoSchema>;

import { z } from 'zod';

export const CreateNewsSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters'),

  content: z.string().min(10, 'Content must be at least 10 characters'),

  category: z
    .string()
    .min(2, 'Category must be at least 2 characters')
    .max(50, 'Category must not exceed 50 characters'),

  publishedBy: z
    .string()
    .max(100, 'Publisher name must not exceed 100 characters')
    .optional(),

  publishAvatarUrl: z
    .string()
    .url('Publisher avatar must be a valid URL')
    .optional(),
});

export type CreateNewsInput = z.infer<typeof CreateNewsSchema>;

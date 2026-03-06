import { z } from 'zod';

const urlSchema = z.url('Must be a valid URL');

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

export const UpdateNewsSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(300, 'Title must not exceed 300 characters')
      .optional(),
    content: z.string().min(1, 'Content must not be empty').optional(),
    category: z.string().min(1, 'Category must not be empty').optional(),
    imageUrl: urlSchema.optional().nullable(),
    publishAvatarUrl: urlSchema.optional().nullable(),
    publishedBy: z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdateNewsInput = z.infer<typeof UpdateNewsSchema>;

export const NewsIdParamSchema = z.object({
  id: z.string().refine((val) => /^[a-f\d]{24}$/i.test(val), {
    message: 'Invalid news article ID',
  }),
});
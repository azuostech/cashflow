import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(1, 'Senha obrigatoria')
});

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
    email: z.string().email('E-mail invalido'),
    password: z
      .string()
      .min(8, 'Senha deve ter ao menos 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiuscula')
      .regex(/[0-9]/, 'Deve conter ao menos um numero'),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas nao coincidem',
    path: ['confirmPassword']
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail invalido')
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Senha deve ter ao menos 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiuscula')
      .regex(/[0-9]/, 'Deve conter ao menos um numero'),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas nao coincidem',
    path: ['confirmPassword']
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

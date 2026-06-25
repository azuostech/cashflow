import { describe, expect, it } from 'vitest';
import { forgotPasswordSchema, loginSchema, registerSchema } from './auth.schema';

describe('loginSchema', () => {
  it('aceita credenciais validas', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(true);
  });

  it('rejeita e-mail invalido', () => {
    expect(loginSchema.safeParse({ email: 'nao-e-email', password: '123' }).success).toBe(false);
  });

  it('rejeita senha vazia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    name: 'Joao Silva',
    email: 'joao@email.com',
    password: 'Senha123!',
    confirmPassword: 'Senha123!'
  };

  it('aceita dados validos', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita nome curto', () => {
    expect(registerSchema.safeParse({ ...valid, name: 'J' }).success).toBe(false);
  });

  it('rejeita senha sem maiuscula', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'senha123!', confirmPassword: 'senha123!' }).success).toBe(false);
  });

  it('rejeita senha sem numero', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'SenhaSemNum!', confirmPassword: 'SenhaSemNum!' }).success).toBe(false);
  });

  it('rejeita senhas diferentes', () => {
    expect(registerSchema.safeParse({ ...valid, confirmPassword: 'Diferente1!' }).success).toBe(false);
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'Abc1!', confirmPassword: 'Abc1!' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('aceita e-mail valido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'teste@email.com' }).success).toBe(true);
  });

  it('rejeita e-mail invalido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'invalido' }).success).toBe(false);
  });
});

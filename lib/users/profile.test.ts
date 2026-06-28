import { describe, expect, it } from 'vitest';
import { PROFILE_TIMEZONES, normalizeNotificationPrefs, sidebarBadgeColor, validatePasswordRules } from './profile';

describe('validacao de senha', () => {
  it('aceita senha valida', () => {
    expect(validatePasswordRules('Senha123')).toHaveLength(0);
  });

  it('rejeita senha sem maiuscula', () => {
    expect(validatePasswordRules('senha123')).toContain('Deve conter ao menos uma letra maiuscula');
  });

  it('rejeita senha sem numero', () => {
    expect(validatePasswordRules('SenhaForte')).toContain('Deve conter ao menos um numero');
  });

  it('rejeita senha curta', () => {
    expect(validatePasswordRules('S1')).toContain('Minimo 8 caracteres');
  });
});

describe('timezones disponiveis', () => {
  const brTimezones = PROFILE_TIMEZONES.filter((timezone) => timezone.startsWith('America/'));

  it('lista inclui Sao Paulo', () => {
    expect(PROFILE_TIMEZONES).toContain('America/Sao_Paulo');
  });

  it('lista inclui fusos brasileiros principais', () => {
    expect(brTimezones.length).toBeGreaterThanOrEqual(12);
  });
});

describe('sidebar badges', () => {
  it('payables com count maior que zero usa vermelho', () => {
    expect(sidebarBadgeColor(3, 'payable')).toBe('bg-red-500');
  });

  it('payables com count zero fica escondido', () => {
    expect(sidebarBadgeColor(0, 'payable')).toBe('hidden');
  });

  it('conciliacao com count maior que zero usa azul', () => {
    expect(sidebarBadgeColor(7, 'recon')).toBe('bg-blue-500');
  });
});

describe('preferencias de notificacao', () => {
  it('preenche defaults quando faltam campos', () => {
    expect(normalizeNotificationPrefs({ overduePayables: false })).toEqual({
      overduePayables: false,
      overdueReceivables: true,
      periodsReminder: true,
      reconciliationReminder: true
    });
  });
});

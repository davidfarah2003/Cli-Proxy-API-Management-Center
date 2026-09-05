import { describe, expect, mock, test } from 'bun:test';
import type { TFunction } from 'i18next';

const calls: string[] = [];

mock.module('@/services/api', () => ({
  apiCallApi: {
    request: async ({ url }: { url: string }) => {
      if (url.endsWith('/rate-limit-reset-credits/consume')) {
        calls.push('consume');
        return { statusCode: 200, header: {}, bodyText: '', body: {} };
      }
      calls.push('refresh');
      return {
        statusCode: 200,
        header: {},
        bodyText: '',
        body: {
          plan_type: 'pro',
          rate_limit: {
            allowed: true,
            limit_reached: false,
            primary_window: {
              used_percent: 0,
              limit_window_seconds: 18000,
              reset_after_seconds: 18000,
            },
          },
          rate_limit_reset_credits: { available_count: 0 },
        },
      };
    },
    resetQuota: async (authIndex: string) => {
      calls.push(`clear:${authIndex}`);
      return { status: 'ok', auth_index: authIndex, models: [] };
    },
  },
  getApiCallErrorMessage: () => 'request failed',
}));

const { CODEX_CONFIG } = await import('@/features/quota/providers/codex/data');
const t = ((key: string) => key) as TFunction;

describe('Codex quota reset', () => {
  test('clears CPA routing cooldown after redeeming the reset credit', async () => {
    calls.length = 0;
    const resetQuota = CODEX_CONFIG.resetQuota;
    if (!resetQuota) throw new Error('Codex reset handler is missing');

    await resetQuota(
      {
        name: 'codex-test.json',
        type: 'codex',
        auth_index: 'codex-test-index',
      },
      t
    );

    expect(calls[0]).toBe('consume');
    expect(calls[1]).toBe('clear:codex-test-index');
    expect(calls.slice(2)).toContain('refresh');
  });
});

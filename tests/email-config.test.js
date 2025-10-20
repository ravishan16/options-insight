import { describe, it, expect, vi } from 'vitest';
import { sendEmailDigest, sendRunSummaryEmail } from '../src/email.js';

describe('Email Configuration Tests', () => {
  describe('sendEmailDigest', () => {
    it('should require from option to be set', async () => {
      const mockApiKey = 'test-api-key';
      const mockAudienceId = 'test-audience-id';
      const mockContent = [];
      const mockMarketContext = { vix: 18.5 };
      
      // Call without 'from' option should throw
      await expect(
        sendEmailDigest(mockApiKey, mockAudienceId, mockContent, mockMarketContext, {})
      ).rejects.toThrow('Newsletter sender email (from) is required');
    });

    it('should accept from option when provided', async () => {
      const mockApiKey = 'test-api-key';
      const mockAudienceId = 'test-audience-id';
      const mockContent = [];
      const mockMarketContext = { vix: 18.5 };
      
      // Mock Resend to avoid actual API calls
      vi.mock('resend', () => ({
        Resend: vi.fn().mockImplementation(() => ({
          broadcasts: {
            create: vi.fn().mockResolvedValue({
              data: { id: 'broadcast-123' },
              error: null
            }),
            send: vi.fn().mockResolvedValue({
              data: { id: 'broadcast-123' },
              error: null
            })
          }
        }))
      }));

      // This should not throw with from option
      const options = {
        from: 'newsletter@example.com',
        unsubscribeEmail: 'unsubscribe@example.com'
      };
      
      // Will fail due to missing Resend mock, but won't throw the "from is required" error
      try {
        await sendEmailDigest(mockApiKey, mockAudienceId, mockContent, mockMarketContext, options);
      } catch (error) {
        // Expect a different error (related to Resend initialization), not the "from is required" error
        expect(error.message).not.toContain('Newsletter sender email (from) is required');
      }
    });
  });

  describe('sendRunSummaryEmail', () => {
    it('should require from option to be set', async () => {
      const mockApiKey = 'test-api-key';
      const mockSummary = {
        success: true,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 1000,
        steps: [],
        metrics: {},
        errors: []
      };
      const mockRecipients = ['admin@example.com'];
      
      // Call without 'from' option should throw
      await expect(
        sendRunSummaryEmail(mockApiKey, mockSummary, mockRecipients, {})
      ).rejects.toThrow('Summary email sender address (from) is required');
    });

    it('should accept from option when provided', async () => {
      const mockApiKey = 'test-api-key';
      const mockSummary = {
        success: true,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 1000,
        steps: [],
        metrics: {},
        errors: []
      };
      const mockRecipients = ['admin@example.com'];
      
      // Mock Resend to avoid actual API calls
      vi.mock('resend', () => ({
        Resend: vi.fn().mockImplementation(() => ({
          emails: {
            send: vi.fn().mockResolvedValue({
              data: { id: 'email-123' },
              error: null
            })
          }
        }))
      }));

      const options = {
        from: 'alerts@example.com'
      };
      
      // Will fail due to missing Resend mock, but won't throw the "from is required" error
      try {
        await sendRunSummaryEmail(mockApiKey, mockSummary, mockRecipients, options);
      } catch (error) {
        // Expect a different error (related to Resend initialization), not the "from is required" error
        expect(error.message).not.toContain('Summary email sender address (from) is required');
      }
    });
  });
});

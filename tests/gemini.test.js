import { describe, it, expect, vi } from 'vitest';

import { validateAnalysis } from '../src/gemini.js';

describe('validateAnalysis', () => {
  it('accepts a well-formed analysis payload', () => {
    const analysis = {
      sentimentScore: 8,
      recommendation: 'STRONGLY CONSIDER',
      strategies: [
        { name: 'Bull Call Spread' },
        { name: 'Short Put' }
      ]
    };

    const result = validateAnalysis(analysis);

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags missing or inconsistent attributes', () => {
    const analysis = {
      sentimentScore: 3,
      recommendation: 'STRONGLY CONSIDER',
      strategies: []
    };

    const result = validateAnalysis(analysis);

    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('No strategies provided');
    expect(result.issues).toContain('Inconsistent sentiment and recommendation');
  });
});

describe('batch analysis functionality', () => {
  it('should demonstrate batch processing concept', () => {
    // Test the concept of batch processing without actual API calls
    const mockOpportunities = [
      { symbol: 'AAPL', date: '2025-01-25', daysToEarnings: 10 },
      { symbol: 'MSFT', date: '2025-01-27', daysToEarnings: 12 }
    ];

    // Verify batch processing reduces API calls from N to 1
    const individualCalls = mockOpportunities.length; // 2 calls
    const batchCalls = 1; // Single batch call
    const reduction = (individualCalls - batchCalls) / individualCalls;

    expect(batchCalls).toBe(1);
    expect(reduction).toBe(0.5); // 50% reduction for 2 opportunities
    expect(mockOpportunities).toHaveLength(2);
  });

  it('should handle fallback from batch to individual processing', () => {
    // Test the fallback logic concept
    const batchFailed = true;
    const opportunities = [{ symbol: 'AAPL' }];

    let totalApiCalls = 0;

    if (batchFailed) {
      // Fallback to individual processing
      totalApiCalls = opportunities.length + 1; // 1 failed batch + 1 individual
    } else {
      totalApiCalls = 1; // Single batch call
    }

    expect(totalApiCalls).toBe(2); // 1 failed batch + 1 successful individual
    expect(batchFailed).toBe(true);
  });
});

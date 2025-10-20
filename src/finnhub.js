import { STOCK_UNIVERSE } from './config.js';
import { getBulkVolatilityAnalysis, calculateVolatilityScore } from './real-volatility.js';

/**
 * Finnhub API wrapper class
 */
class FinnhubAPI {
    constructor(apiKey, delay = 0) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://finnhub.io/api/v1';
        this.delay = delay;
    }

    async makeRequest(endpoint, { retries = 3, baseDelayMs = 400 } = {}) {
        const url = `${this.baseUrl}${endpoint}&token=${this.apiKey}`;
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    const status = response.status;
                    // Retry on rate limits and transient server errors
                    if ((status === 429 || (status >= 500 && status < 600)) && attempt < retries) {
                        const delay = Math.round(baseDelayMs * Math.pow(2, attempt) + Math.random() * 100);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                    throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
                }

                if (this.delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.delay));
                }

                return await response.json();
            } catch (err) {
                lastError = err;
                // Network error: retry
                if (attempt < retries) {
                    const delay = Math.round(baseDelayMs * Math.pow(2, attempt) + Math.random() * 100);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            }
        }
        throw lastError || new Error('Finnhub API request failed');
    }

    async getEarningsCalendar(fromDate, toDate) {
        const data = await this.makeRequest(`/calendar/earnings?from=${fromDate}&to=${toDate}`);
        return data.earningsCalendar || [];
    }

    async getQuote(symbol) {
        return this.makeRequest(`/quote?symbol=${symbol}`);
    }

    async getCompanyProfile(symbol) {
        return this.makeRequest(`/stock/profile2?symbol=${symbol}`);
    }

    async getBasicFinancials(symbol) {
        return this.makeRequest(`/stock/metric?symbol=${symbol}&metric=all`);
    }
}

/**
 * Enhanced earnings opportunities scanner with volatility analysis
 * @async
 * @param {string} finnhubApiKey - Finnhub API key for earnings calendar data
 * @returns {Promise<Array<Object>>} Array of qualified earnings opportunities
 * @returns {Object[]} returns.opportunities - Individual opportunity objects
 * @returns {string} returns.opportunities[].symbol - Stock symbol
 * @returns {string} returns.opportunities[].date - Earnings date (YYYY-MM-DD)
 * @returns {number} returns.opportunities[].daysToEarnings - Days until earnings
 * @returns {Object} returns.opportunities[].volatilityData - Complete volatility analysis
 * @returns {number} returns.opportunities[].qualityScore - Composite quality score (0-100)
 * @description Main pipeline function that scans earnings calendar, filters by stock universe,
 * performs volatility analysis, and calculates quality scores. Returns only opportunities
 * that pass timing (1-45 days) and universe (S&P 500 + NASDAQ 100) filters.
 */
export async function getEarningsOpportunities(finnhubApiKey) {
    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(fromDate.getDate() + 45);
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];

    console.log(`Scanning earnings from ${fromDateStr} to ${toDateStr}...`);

    // Fetch earnings calendar from Finnhub
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromDateStr}&to=${toDateStr}&token=${finnhubApiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Finnhub API Error: ${response.statusText}`);
    }
    const data = await response.json();
    const earningsCalendar = data.earningsCalendar || [];

    console.log(`📊 Total earnings found: ${earningsCalendar.length}`);

    // Filter for stocks in our universe
    const stockUniverseSet = new Set(STOCK_UNIVERSE);
    const universeFiltered = earningsCalendar
        .filter(event => stockUniverseSet.has(event.symbol));
    
    console.log(`📊 Earnings in our universe: ${universeFiltered.length}`);
    if (universeFiltered.length > 0) {
        console.log('   Symbols:', universeFiltered.map(e => e.symbol).slice(0, 10).join(', '));
    }

    // Apply time window filter (1-45 days out)
    const timeWindowFiltered = universeFiltered.filter(event => {
        const earningsDate = new Date(event.date);
        const daysToEarnings = Math.ceil((earningsDate - fromDate) / (1000 * 60 * 60 * 24));
        return daysToEarnings >= 1 && daysToEarnings <= 45;
    });

    if (timeWindowFiltered.length === 0) {
        console.log('\u2139\ufe0f  No earnings found in time window.');
        return [];
    }

    // Pre-screen using Finnhub data to reduce API calls (revenue-based scoring)
    const prescreened = timeWindowFiltered
        .map(event => {
            const daysToEarnings = Math.ceil((new Date(event.date) - new Date()) / (1000 * 60 * 60 * 24));
            const prescreenScore = calculatePrescreenScore(event, daysToEarnings);
            return {
                ...event,
                daysToEarnings,
                prescreenScore
            };
        })
        .sort((a, b) => b.prescreenScore - a.prescreenScore)
        .slice(0, 8); // Analyze top 8 instead of all ~18 (55% fewer API calls)

    console.log(`📊 Pre-screened to top ${prescreened.length} symbols: ${prescreened.map(e => `${e.symbol}(${e.prescreenScore})`).join(', ')}`);

    // Now do full volatility analysis only on pre-screened symbols
    const symbols = prescreened.map(event => event.symbol);
    const bulk = await getBulkVolatilityAnalysis(symbols, null, finnhubApiKey);

    // Create volatility lookup map from the object returned by getBulkVolatilityAnalysis
    const volatilityMap = new Map();
    Object.entries(bulk || {}).forEach(([symbol, data]) => {
        if (data !== null) {
            volatilityMap.set(symbol, data);
        }
    });

    // Enhance earnings data with volatility metrics and scoring
    const enhancedOpportunities = prescreened.map(event => {
        const volatility = volatilityMap.get(event.symbol) || null;

        const enhanced = {
            ...event, // already includes daysToEarnings from prescreening
            volatilityData: volatility,
            volatilityScore: calculateVolatilityScore(volatility),
            qualityScore: 0
        };

        // Calculate composite quality score
        enhanced.qualityScore = calculateQualityScore(enhanced);
        
        return enhanced;
    });

    // Filter out low-quality and missing-volatility opportunities
    const qualifiedOpportunities = enhancedOpportunities
        .filter(opp => opp.volatilityData)
        .filter(opp => opp.qualityScore > 5) // keep lenient threshold for now
        .sort((a, b) => b.qualityScore - a.qualityScore);

    console.log(`\ud83d\udcca Qualified opportunities after filtering: ${qualifiedOpportunities.length}`);
    return qualifiedOpportunities.slice(0, 5);
}

/**
 * Calculate composite quality score for an earnings opportunity
 */
function calculateQualityScore(opportunity) {
    let score = 10; // Base score for having earnings data
    const weights = {
        volatility: 30,
        timing: 25,
        liquidity: 20,
        technical: 15,
        dataAvailability: 10
    };

    // Give base points for having volatility data at all
    if (opportunity.volatilityData) {
        score += weights.dataAvailability;
        
        // Give points for having historical volatility (even if IV is missing)
        if (opportunity.volatilityData.historicalVolatility > 0) {
            score += 5; // Bonus for having historical data
        }
    }

    // Volatility score (from volatility analysis) - use the detailed volatility score
    const volatilityScore = opportunity.volatilityData?.volatilityScore || opportunity.volatilityScore || 0;
    if (volatilityScore > 70) {
        score += weights.volatility;
    } else if (volatilityScore > 50) {
        score += weights.volatility * 0.8;
    } else if (volatilityScore > 30) {
        score += weights.volatility * 0.6;
    } else if (volatilityScore > 10) {
        score += weights.volatility * 0.4;
    } else {
        score += weights.volatility * 0.2; // Even very low scores get some points
    }

    // Timing score - prefer 14-21 days to earnings
    const daysToEarnings = opportunity.daysToEarnings;
    if (daysToEarnings >= 14 && daysToEarnings <= 21) {
        score += weights.timing;
    } else if (daysToEarnings >= 10 && daysToEarnings <= 28) {
        score += weights.timing * 0.7;
    } else if (daysToEarnings >= 5 && daysToEarnings <= 35) {
        score += weights.timing * 0.4;
    } else {
        score += weights.timing * 0.2; // Even bad timing gets some points
    }

    // Liquidity score based on options volume - but more tolerant
    const optionsVolume = opportunity.volatilityData?.optionsVolume || 0;
    if (optionsVolume > 10000) {
        score += weights.liquidity;
    } else if (optionsVolume > 5000) {
        score += weights.liquidity * 0.7;
    } else if (optionsVolume > 1000) {
        score += weights.liquidity * 0.4;
    } else if (optionsVolume > 0) {
        score += weights.liquidity * 0.2; // Some volume is better than none
    }

    // Technical score based on RSI extremes
    const rsi = opportunity.volatilityData?.technicalIndicators?.rsi;
    if (rsi) {
        if (rsi > 70 || rsi < 30) {
            score += weights.technical; // Extreme levels good for mean reversion
        } else if (rsi > 60 || rsi < 40) {
            score += weights.technical * 0.5;
        } else {
            score += weights.technical * 0.2; // Any RSI data gets some points
        }
    }

    return Math.round(score);
}

/**
 * Get market volatility context and regime classification
 * @async
 * @param {string} finnhubApiKey - Finnhub API key for VIX data
 * @returns {Promise<Object>} Market context object
 * @returns {number|null} returns.vix - Current VIX level or null if unavailable
 * @returns {string} returns.marketRegime - Volatility regime classification
 * @returns {string} returns.lastUpdated - ISO timestamp of data retrieval
 * @description Fetches VIX data and classifies market volatility regime:
 * - 'low-volatility': VIX < 20 (premium selling favored)
 * - 'normal': VIX 20-30 (balanced strategies)
 * - 'high-volatility': VIX > 30 (premium buying considerations)
 * Used by AI analysis for strategy recommendations.
 */
export async function getMarketContext(finnhubApiKey) {
    try {
        // Get VIX data for market volatility context
        const vixUrl = `https://finnhub.io/api/v1/quote?symbol=VIX&token=${finnhubApiKey}`;
        const vixResponse = await fetch(vixUrl);
        
        if (!vixResponse.ok) {
            console.warn('Failed to fetch VIX data');
            return { vix: null, marketRegime: 'unknown' };
        }
        
        const vixData = await vixResponse.json();
        const vixLevel = vixData.c; // Current price
        
        let marketRegime = 'normal';
        if (vixLevel > 30) marketRegime = 'high-volatility';
        else if (vixLevel > 20) marketRegime = 'elevated-volatility';
        else if (vixLevel < 15) marketRegime = 'low-volatility';
        
        return {
            vix: vixLevel,
            marketRegime,
            lastUpdated: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Error fetching market context:', error);
        return { vix: null, marketRegime: 'unknown' };
    }
}

/**
 * Calculate prescreening score using Finnhub earnings data (no additional API calls)
 * Prioritizes larger companies with optimal timing and better market positioning
 */
function calculatePrescreenScore(event, daysToEarnings) {
    let score = 0;

    // Revenue size scoring (proxy for market cap/liquidity/options volume)
    if (event.revenueEstimate) {
        if (event.revenueEstimate > 10_000_000_000) {
            score += 10; // $10B+ revenue (mega caps like AAPL, MSFT)
        } else if (event.revenueEstimate > 1_000_000_000) {
            score += 7;  // $1B+ revenue (large caps)
        } else if (event.revenueEstimate > 100_000_000) {
            score += 5;  // $100M+ revenue (mid caps)
        } else {
            score += 3;  // Smaller companies
        }
    } else {
        score += 5; // No revenue data = neutral (don't penalize)
    }

    // Timing preference (7-21 days is sweet spot for options strategies)
    if (daysToEarnings >= 7 && daysToEarnings <= 21) {
        score += 8; // Optimal timing - enough time for setup, not too much theta decay
    } else if (daysToEarnings >= 3 && daysToEarnings <= 30) {
        score += 5; // Acceptable timing
    } else {
        score += 2; // Too close (<3d) or too far (>30d)
    }

    // Market session preference (after-hours typically better for options positioning)
    if (event.hour === "amc") {
        score += 2; // After market close - better for overnight positioning
    } else if (event.hour === "bmo") {
        score += 1; // Before market open - still good
    }
    // No penalty for missing hour data

    return score;
}

export default FinnhubAPI;

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Generate AI-powered trading ideas using Google Gemini
 * @async
 * @param {string} apiKey - Google Gemini API key
 * @param {Array<Object>} opportunities - Array of earnings opportunities from scanner
 * @param {Object} marketContext - Market volatility context from getMarketContext
 * @returns {Promise<Array<Object>>} Array of analyzed opportunities with AI insights
 * @returns {Object[]} returns.analyses - Individual analysis objects
 * @returns {Object} returns.analyses[].opportunity - Original opportunity data
 * @returns {Object} returns.analyses[].analysis - AI-generated analysis
 * @returns {number} returns.analyses[].analysis.sentimentScore - AI sentiment score (1-10)
 * @returns {string} returns.analyses[].analysis.recommendation - Trade recommendation
 * @returns {Array} returns.analyses[].analysis.strategies - Suggested options strategies
 * @returns {string} returns.analyses[].timestamp - Analysis timestamp
 * @description Core AI analysis engine that processes earnings opportunities through
 * Google Gemini Pro. Generates sentiment scores, trade recommendations, and specific
 * options strategies. Includes error handling to continue processing if individual
 * analyses fail.
 */
export async function generateTradingIdeas(apiKey, opportunities, marketContext) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro-latest"});

    console.log(`Generating AI analysis for ${opportunities.length} opportunities...`);

    try {
        // Use batch analysis for better performance (single API call)
        const batchAnalysis = await generateBatchAnalysis(model, opportunities, marketContext);
        console.log(`Successfully generated ${batchAnalysis.length} analyses`);
        return batchAnalysis;
    } catch (error) {
        console.error('Batch analysis failed, falling back to individual analysis:', error);

        // Fallback to individual analysis if batch fails
        let content = [];
        for (const opp of opportunities) {
            try {
                const analysis = await generateSingleAnalysis(model, opp, marketContext);
                if (analysis) {
                    content.push({
                        opportunity: opp,
                        analysis: analysis,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error(`Error generating analysis for ${opp.symbol}:`, error);
                // Continue with other opportunities even if one fails
            }
        }

        console.log(`Successfully generated ${content.length} analyses (fallback mode)`);
        return content;
    }
}

/**
 * Generate comprehensive analysis for a single opportunity
 */
async function generateSingleAnalysis(model, opportunity, marketContext) {
    const vol = opportunity.volatilityData;
    const prompt = createEnhancedPrompt(opportunity, marketContext);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawAnalysis = response.text();

        // Parse the structured response
        const analysis = parseAnalysisResponse(rawAnalysis, opportunity);
        
        return analysis;
    } catch (error) {
        console.error(`Error in AI analysis for ${opportunity.symbol}:`, error);
        return null;
    }
}

/**
 * Create enhanced prompt with quantitative data
 */
function createEnhancedPrompt(opportunity, marketContext) {
    const vol = opportunity.volatilityData;
    const marketRegimeDescription = getMarketRegimeDescription(marketContext);
    
    const prompt = `
QUANTITATIVE ANALYST: Analyze this earnings opportunity. KEEP RESPONSE CONCISE.

STOCK: ${opportunity.symbol} | Earnings: ${opportunity.date} (${opportunity.daysToEarnings}d)
Price: $${vol?.currentPrice?.toFixed(2) || 'N/A'} | Expected Move: ${vol?.expectedMove ? `${((vol.expectedMove/vol.currentPrice)*100).toFixed(1)}%` : 'N/A'}
IV: ${vol?.impliedVolatility?.toFixed(1) || 'N/A'}% | HV: ${vol?.historicalVolatility?.toFixed(1) || 'N/A'}% | RSI: ${vol?.technicalIndicators?.rsi?.toFixed(1) || 'N/A'}
Quality: ${opportunity.qualityScore}/100 | VIX: ${marketContext?.vix?.toFixed(1) || 'N/A'} (${marketContext?.marketRegime || 'Unknown'})

RESPOND IN EXACTLY THIS FORMAT (NO EXTRA TEXT):

**SENTIMENT SCORE:** [number 1-10]

**RECOMMENDATION:** [STRONGLY CONSIDER or NEUTRAL or STAY AWAY]

**REASONING:** [2-3 sentences max explaining key factors]

**STRATEGIES:**
1. **[Strategy Name]** - POP: [%], Risk: $[amount], Entry: [timing]  
2. **[Strategy Name]** - POP: [%], Risk: $[amount], Entry: [timing]

**KEY RISKS:** [1-2 bullets max]

BE CONCISE. NO FLUFF.`;

    return prompt;
}

/**
 * Generate batch analysis for multiple opportunities in a single API call
 * This reduces API calls from N separate calls to 1 batch call, significantly improving performance
 */
async function generateBatchAnalysis(model, opportunities, marketContext) {
    const marketRegimeDescription = getMarketRegimeDescription(marketContext);

    // Create batch prompt with all opportunities
    let batchPrompt = `QUANTITATIVE ANALYST: Analyze these ${opportunities.length} earnings opportunities. KEEP RESPONSES CONCISE.

MARKET CONTEXT: VIX: ${marketContext?.vix?.toFixed(1) || 'N/A'} (${marketContext?.marketRegime || 'Unknown'})
${marketRegimeDescription}

`;

    // Add each opportunity to the batch prompt
    opportunities.forEach((opp, index) => {
        const vol = opp.volatilityData;
        batchPrompt += `
--- STOCK ${index + 1}: ${opp.symbol} ---
Earnings: ${opp.date} (${opp.daysToEarnings}d)
Price: $${vol?.currentPrice?.toFixed(2) || 'N/A'} | Expected Move: ${vol?.expectedMove ? `${((vol.expectedMove/vol.currentPrice)*100).toFixed(1)}%` : 'N/A'}
IV: ${vol?.impliedVolatility?.toFixed(1) || 'N/A'}% | HV: ${vol?.historicalVolatility?.toFixed(1) || 'N/A'}% | RSI: ${vol?.technicalIndicators?.rsi?.toFixed(1) || 'N/A'}
Quality: ${opp.qualityScore}/100

`;
    });

    batchPrompt += `
RESPOND WITH EXACTLY ${opportunities.length} ANALYSES IN THIS FORMAT (one per stock):

=== ${opportunities[0].symbol} ===
**SENTIMENT SCORE:** [1-10]
**RECOMMENDATION:** [STRONGLY CONSIDER or NEUTRAL or STAY AWAY]
**REASONING:** [2-3 sentences max]
**STRATEGIES:**
1. **[Strategy Name]** - POP: [%], Risk: $[amount], Entry: [timing]
2. **[Strategy Name]** - POP: [%], Risk: $[amount], Entry: [timing]
**KEY RISKS:** [1-2 bullets max]

${opportunities.slice(1).map(opp => `=== ${opp.symbol} ===
**SENTIMENT SCORE:** [1-10]
**RECOMMENDATION:** [STRONGLY CONSIDER or NEUTRAL or STAY AWAY]
**REASONING:** [2-3 sentences max]
**STRATEGIES:**
1. **[Strategy Name]** - POP: [%], Risk: $[amount], Entry: [timing]
2. **[Strategy Name]** - POP: [%], Risk: $[amount], Entry: [timing]
**KEY RISKS:** [1-2 bullets max]`).join('\n\n')}

BE CONCISE. NO EXTRA TEXT.`;

    try {
        const result = await model.generateContent(batchPrompt);
        const response = await result.response;
        const rawBatchResponse = response.text();

        // Parse the batch response into individual analyses
        const analyses = parseBatchResponse(rawBatchResponse, opportunities);
        return analyses;
    } catch (error) {
        console.error('Error in batch AI analysis:', error);
        throw error; // Re-throw to trigger fallback
    }
}

/**
 * Parse batch response into individual analysis objects
 */
function parseBatchResponse(rawBatchResponse, opportunities) {
    const analyses = [];

    // Split response by stock symbols
    opportunities.forEach(opp => {
        try {
            const symbolRegex = new RegExp(`===\\s*${opp.symbol}\\s*===([\\s\\S]*?)(?===\\s*[A-Z]+\\s*===|$)`, 'i');
            const symbolMatch = rawBatchResponse.match(symbolRegex);

            if (symbolMatch) {
                const symbolResponse = symbolMatch[1].trim();
                const analysis = parseAnalysisResponse(symbolResponse, opp);
                analyses.push({
                    opportunity: opp,
                    analysis: analysis,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.warn(`Could not find analysis for ${opp.symbol} in batch response`);
            }
        } catch (error) {
            console.error(`Error parsing batch analysis for ${opp.symbol}:`, error);
        }
    });

    return analyses;
}

/**
 * Parse structured AI response into organized data
 */
function parseAnalysisResponse(rawResponse, opportunity) {
    const analysis = {
        symbol: opportunity.symbol,
        sentimentScore: null,
        recommendation: 'NEUTRAL',
        strategies: [],
        volatilityAssessment: '',
        riskFactors: '',
        positionSizing: '',
        rawAnalysis: rawResponse
    };

    try {
        // Extract sentiment score - try multiple patterns
        let sentimentMatch = rawResponse.match(/\*\*SENTIMENT SCORE:\*\*\s*(\d+)/i);
        if (!sentimentMatch) {
            sentimentMatch = rawResponse.match(/SENTIMENT SCORE:\s*(\d+)/i);
        }
        if (!sentimentMatch) {
            sentimentMatch = rawResponse.match(/sentiment[^:]*:\s*(\d+)/i);
        }
        if (!sentimentMatch) {
            // Try to find any number after sentiment-related words
            sentimentMatch = rawResponse.match(/sentiment[^0-9]*(\d+)/i);
        }
        
        if (sentimentMatch) {
            analysis.sentimentScore = parseInt(sentimentMatch[1]);
        }

        // Extract recommendation - try multiple patterns
        let recommendationMatch = rawResponse.match(/\*\*RECOMMENDATION:\*\*\s*(STRONGLY CONSIDER|NEUTRAL|STAY AWAY)/i);
        if (!recommendationMatch) {
            recommendationMatch = rawResponse.match(/RECOMMENDATION:\s*(STRONGLY CONSIDER|NEUTRAL|STAY AWAY)/i);
        }
        if (!recommendationMatch) {
            // Look for the recommendation anywhere in the response
            recommendationMatch = rawResponse.match(/(STRONGLY CONSIDER|NEUTRAL|STAY AWAY)/i);
        }
        
        if (recommendationMatch) {
            analysis.recommendation = recommendationMatch[1].toUpperCase();
        }

        // Extract strategies (simplified parsing)
        const strategyMatches = rawResponse.match(/\d\.\s*\*\*([^*]+)\*\*([\s\S]*?)(?=\d\.\s*\*\*|\*\*POSITION SIZING|\n\n|$)/gi);
        if (strategyMatches) {
            strategyMatches.forEach(match => {
                const strategyName = match.match(/\*\*([^*]+)\*\*/)?.[1]?.trim();
                if (strategyName) {
                    analysis.strategies.push({
                        name: strategyName,
                        details: match.replace(/\*\*[^*]+\*\*/, '').trim()
                    });
                }
            });
        }

        // Extract other sections
        const volatilityMatch = rawResponse.match(/\*\*VOLATILITY ASSESSMENT:\*\*\s*([\s\S]*?)(?=\*\*[A-Z\s]+:|$)/i);
        if (volatilityMatch) {
            analysis.volatilityAssessment = volatilityMatch[1].trim();
        }

        const riskMatch = rawResponse.match(/\*\*RISK FACTORS:\*\*\s*([\s\S]*?)(?=\*\*[A-Z\s]+:|$)/i);
        if (riskMatch) {
            analysis.riskFactors = riskMatch[1].trim();
        }

        const positionMatch = rawResponse.match(/\*\*POSITION SIZING:\*\*\s*([\s\S]*?)(?=\*\*[A-Z\s]+:|$)/i);
        if (positionMatch) {
            analysis.positionSizing = positionMatch[1].trim();
        }

    } catch (parseError) {
        console.error(`Error parsing AI response for ${opportunity.symbol}:`, parseError);
    }

    return analysis;
}

/**
 * Get market regime description for context
 */
function getMarketRegimeDescription(marketContext) {
    if (!marketContext || !marketContext.marketRegime) {
        return '';
    }

    const descriptions = {
        'high-volatility': 'High volatility environment - Premium selling may be attractive, but manage risk carefully.',
        'elevated-volatility': 'Elevated volatility - Good environment for defined risk strategies.',
        'normal': 'Normal volatility environment - Focus on high-probability setups.',
        'low-volatility': 'Low volatility environment - Premium buying may be more attractive than selling.'
    };

    return descriptions[marketContext.marketRegime] || '';
}

/**
 * Validate AI analysis quality and filter out poor recommendations
 * @param {Object} analysis - AI-generated analysis object to validate
 * @param {number} analysis.sentimentScore - AI sentiment score (should be 1-10)
 * @param {string} analysis.recommendation - Trade recommendation 
 * @param {Array} analysis.strategies - Array of suggested strategies
 * @returns {Object} Validation result object
 * @returns {boolean} returns.isValid - Whether analysis passes quality checks
 * @returns {Array<string>} returns.issues - Array of validation issues found
 * @description Quality gate function that ensures AI analyses meet minimum standards:
 * - Sentiment score must be valid (1-10)
 * - Recommendation must be standard format
 * - Must include at least one strategy
 * - Checks for logical consistency (sentiment vs recommendation)
 * Filters prevent poor quality analyses from reaching newsletter subscribers.
 */
export function validateAnalysis(analysis) {
    const issues = [];

    // Check sentiment score
    if (!analysis.sentimentScore || analysis.sentimentScore < 1 || analysis.sentimentScore > 10) {
        issues.push('Invalid sentiment score');
    }

    // Check recommendation format
    if (!['STRONGLY CONSIDER', 'NEUTRAL', 'STAY AWAY'].includes(analysis.recommendation)) {
        issues.push('Invalid recommendation format');
    }

    // Check for strategies
    if (!analysis.strategies || analysis.strategies.length === 0) {
        issues.push('No strategies provided');
    }

    // Conservative filter: Reject low-confidence analyses
    if (analysis.sentimentScore && analysis.sentimentScore < 5 && analysis.recommendation === 'STRONGLY CONSIDER') {
        issues.push('Inconsistent sentiment and recommendation');
    }

    return {
        isValid: issues.length === 0,
        issues: issues
    };
}
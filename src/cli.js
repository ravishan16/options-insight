import { getEarningsOpportunities, getMarketContext } from './finnhub.js';
import { getBulkVolatilityAnalysis } from './real-volatility.js';
import { generateTradingIdeas, validateAnalysis } from './gemini.js';
import { sendEmailDigest, previewEmailTemplate, sendRunSummaryEmail } from './email.js';

async function main() {
    const [,, command, ...args] = process.argv;

    try {
        switch (command) {
            case 'finnhub':
                await testFinnhub();
                break;
            case 'alphavantage':
                await testAlphaVantage();
                break;
            case 'volatility':
                await testVolatilityAnalysis();
                break;
            case 'gemini':
                await testGemini();
                break;
            case 'email':
                await testEmail();
                break;
            case 'scoring':
                await testScoring();
                break;
            case 'pipeline':
                await testPipeline();
                break;
            case 'full-run':
                await testFullRun();
                break;
            case 'preview-email':
                await previewEmail();
                break;
            case 'summary-email':
                await testSummaryEmail();
                break;
            case 'test-stock':
                await testSpecificStock();
                break;
            case 'validate-keys':
                await validateApiKeys();
                break;
            default:
                console.log('🔧 Options Insight CLI');
                console.log('');
                console.log('Usage: node src/cli.js <command>');
                console.log('');
                console.log('Commands:');
                console.log('  finnhub        - Test earnings data fetching');
                console.log('  alphavantage   - Test Alpha Vantage market data');
                console.log('  volatility     - Test volatility analysis pipeline');
                console.log('  gemini         - Test AI analysis');
                console.log('  email          - Test email delivery');
                console.log('  scoring        - Test opportunity scoring');
                console.log('  pipeline       - Test complete data pipeline');
                console.log('  full-run       - Simulate complete daily run');
                console.log('  preview-email  - Preview email template');
        console.log('  summary-email  - Send a test run summary email');
                console.log('  test-stock     - Test specific stock (set SYMBOL env var)');
                console.log('  validate-keys  - Validate all API keys');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function testFinnhub() {
    console.log('📊 Testing Finnhub integration...');
    const finnhubApiKey = process.env.FINNHUB_API_KEY;
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!finnhubApiKey) {
        throw new Error('FINNHUB_API_KEY environment variable is not set');
    }
    
    const opportunities = await getEarningsOpportunities(finnhubApiKey);
    console.log(`✅ Found ${opportunities.length} earnings opportunities`);
    
    opportunities.forEach(opp => {
        console.log(`  📈 ${opp.symbol} - ${opp.date} (Quality: ${opp.qualityScore}/100)`);
    });
}

async function testAlphaVantage() {
    console.log('📈 Testing Alpha Vantage integration...');
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!alphaVantageApiKey) {
        throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
    }
    
    const testSymbols = ['AAPL', 'MSFT', 'GOOGL'];
    console.log(`Testing volatility analysis for: ${testSymbols.join(', ')}`);
    
    const results = await getBulkVolatilityAnalysis(testSymbols, alphaVantageApiKey);
    const successfulResults = Object.entries(results).filter(([symbol, data]) => data !== null);
    console.log(`✅ Successfully analyzed ${successfulResults.length} symbols`);
    
    successfulResults.forEach(([symbol, result]) => {
        console.log(`  📊 ${symbol}:`);
        console.log(`     Current Price: $${result.currentPrice?.toFixed(2) || 'N/A'}`);
        console.log(`     IV Estimate: ${result.impliedVolatility?.toFixed(1) || 'N/A'}%`);
        console.log(`     HV: ${result.historicalVolatility?.toFixed(1) || 'N/A'}%`);
        console.log(`     Volatility Score: ${result.volatilityScore || 'N/A'}/100`);
    });
}

async function testVolatilityAnalysis() {
    console.log('📊 Testing volatility analysis pipeline...');
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!alphaVantageApiKey) {
        console.log('⚠️  ALPHA_VANTAGE_API_KEY not set, using mock data');
    }
    
    const symbol = process.env.SYMBOL || 'AAPL';
    console.log(`Analyzing volatility for ${symbol}...`);
    
    const result = await getBulkVolatilityAnalysis([symbol], alphaVantageApiKey);
    const symbolData = result[symbol];
    
    if (symbolData) {
        console.log('✅ Volatility Analysis Results:');
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Current Price: $${symbolData.currentPrice?.toFixed(2) || 'N/A'}`);
        console.log(`  Historical Vol: ${symbolData.historicalVolatility?.toFixed(1) || 'N/A'}%`);
        console.log(`  IV Estimate: ${symbolData.impliedVolatility?.toFixed(1) || 'N/A'}%`);
        console.log(`  Expected Move: $${symbolData.expectedMove?.toFixed(2) || 'N/A'}`);
        console.log(`  Volatility Score: ${symbolData.volatilityScore || 'N/A'}/100`);
    } else {
        console.log('❌ No volatility data available');
    }
}

async function testGemini() {
    console.log('🤖 Testing Gemini AI analysis...');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    // Create mock opportunity data
    const mockOpportunities = [{
        symbol: 'AAPL',
        date: '2025-10-28',
        daysToEarnings: 15,
        qualityScore: 75,
        volatilityData: {
            currentPrice: 150.25,
            impliedVolatility: 35.5,
            historicalVolatility: 28.3,
            expectedMove: 8.75,
            optionsVolume: 15000,
            technicalIndicators: { rsi: 68.5 }
        }
    }];
    
    const mockMarketContext = {
        vix: 18.5,
        marketRegime: 'normal'
    };
    
    console.log('Generating AI analysis...');
    const analyses = await generateTradingIdeas(geminiApiKey, mockOpportunities, mockMarketContext);
    
    console.log(`✅ Generated ${analyses.length} analyses`);
    
    analyses.forEach(item => {
        const analysis = item.analysis;
        console.log(`  📊 ${item.opportunity.symbol}:`);
        console.log(`     Sentiment Score: ${analysis.sentimentScore || 'N/A'}/10`);
        console.log(`     Recommendation: ${analysis.recommendation}`);
        console.log(`     Strategies: ${analysis.strategies?.length || 0}`);
        
        const validation = validateAnalysis(analysis);
        if (validation.isValid) {
            console.log(`     ✅ Analysis passed validation`);
        } else {
            console.log(`     ❌ Validation issues: ${validation.issues.join(', ')}`);
        }
    });
}

async function testEmail() {
    console.log('📧 Testing email template and delivery...');
    const resendApiKey = process.env.RESEND_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const audienceId = process.env.AUDIENCE_ID;
    
    if (!resendApiKey || !geminiApiKey) {
        throw new Error('RESEND_API_KEY or GEMINI_API_KEY environment variable is not set');
    }

    if (!audienceId) {
        throw new Error('AUDIENCE_ID environment variable is not set');
    }
    
    // Use mock data for testing
    const mockContent = [{
        opportunity: {
            symbol: 'AAPL',
            date: '2025-10-28',
            daysToEarnings: 15,
            qualityScore: 85,
            volatilityData: {
                currentPrice: 150.25,
                impliedVolatility: 35.5,
                historicalVolatility: 28.3,
                expectedMove: 8.75,
                optionsVolume: 15000,
                fiftyTwoWeekHigh: 123.00, // Added for Mock Test Issue: Fix 52-week range and add ticker hyperlinks to newsletter #16
                fiftyTwoWeekLow: 456.00, // Added for Mock Test Issue: Fix 52-week range and add ticker hyperlinks to newsletter #16
                technicalIndicators: { rsi: 68.5, atr: 2.15 }
            }
        },
        analysis: {
            sentimentScore: 8,
            recommendation: 'STRONGLY CONSIDER',
            strategies: [
                { name: 'Iron Condor', details: 'Sell 145/150/155/160 Iron Condor for $2.50 credit...' },
                { name: 'Bull Put Spread', details: 'Sell 140/145 Put Spread for $1.25 credit...' }
            ],
            riskFactors: 'High IV environment may lead to volatility crush post-earnings.'
        }
    }];
    
    const mockMarketContext = {
        vix: 18.5,
        marketRegime: 'normal'
    };
    
    console.log('Sending test email...');
    const result = await sendEmailDigest(resendApiKey, audienceId, mockContent, mockMarketContext);
    console.log(`✅ Email sent successfully - Broadcast ID: ${result.broadcastId}`);
}

async function testScoring() {
    console.log('🎯 Testing opportunity scoring algorithm...');
    
    // Mock volatility data for scoring test
    const mockVolatilityData = [
        { symbol: 'AAPL', impliedVolatility: 35, historicalVolatility: 28, optionsVolume: 15000, technicalIndicators: { rsi: 68 } },
        { symbol: 'MSFT', impliedVolatility: 25, historicalVolatility: 22, optionsVolume: 8000, technicalIndicators: { rsi: 45 } },
        { symbol: 'TSLA', impliedVolatility: 55, historicalVolatility: 65, optionsVolume: 25000, technicalIndicators: { rsi: 75 } }
    ];
    
    console.log('Calculating volatility scores...');
    mockVolatilityData.forEach(data => {
        const score = calculateVolatilityScore(data);
        console.log(`  📊 ${data.symbol}: ${score}/100`);
        console.log(`     IV: ${data.impliedVolatility}% | HV: ${data.historicalVolatility}% | Volume: ${data.optionsVolume.toLocaleString()}`);
    });
    
    console.log('✅ Scoring algorithm test completed');
}

async function testPipeline() {
    console.log('🔄 Testing complete data pipeline...');
    const finnhubApiKey = process.env.FINNHUB_API_KEY;
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!finnhubApiKey) {
        throw new Error('FINNHUB_API_KEY environment variable is not set');
    }
    
    console.log('1. Fetching earnings opportunities...');
    const opportunities = await getEarningsOpportunities(finnhubApiKey);
    console.log(`   Found ${opportunities.length} opportunities`);
    
    console.log('2. Getting market context...');
    const marketContext = await getMarketContext(finnhubApiKey);
    console.log(`   VIX: ${marketContext.vix} | Regime: ${marketContext.marketRegime}`);
    
    console.log('✅ Data pipeline test completed');
}

async function testFullRun() {
    console.log('🎯 Simulating complete daily run...');
    
    const { FINNHUB_API_KEY, ALPHA_VANTAGE_API_KEY, GEMINI_API_KEY, RESEND_API_KEY, AUDIENCE_ID } = process.env;
    
    if (!FINNHUB_API_KEY || !GEMINI_API_KEY || !RESEND_API_KEY) {
        throw new Error('Missing required API keys (FINNHUB_API_KEY, GEMINI_API_KEY, RESEND_API_KEY)');
    }

    if (!AUDIENCE_ID) {
        throw new Error('AUDIENCE_ID environment variable is not set');
    }
    
    try {
        const startedAtMs = Date.now();
        const summary = {
            success: false,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            durationMs: null,
            steps: [],
            metrics: {
                newsletterSent: false
            },
            errors: []
        };

        const addStep = (name, status, detail) => {
            summary.steps.push({ name, status, detail });
        };

        console.log('1. 📊 Scanning earnings opportunities...');
    const opportunities = await getEarningsOpportunities(FINNHUB_API_KEY);
        console.log(`   ✅ Found ${opportunities.length} qualified opportunities`);
        addStep('Scan earnings opportunities', 'success', `${opportunities.length} opportunities analyzed`);
        summary.metrics.totalOpportunities = opportunities.length;

        console.log('2. 🌍 Getting market context...');
        const marketContext = await getMarketContext(FINNHUB_API_KEY);
        console.log(`   ✅ VIX: ${marketContext.vix?.toFixed(1)} | Regime: ${marketContext.marketRegime}`);
        addStep('Fetch market context', 'success', `VIX ${marketContext.vix?.toFixed(1) ?? 'N/A'}, Regime: ${marketContext.marketRegime || 'Unknown'}`);
        summary.metrics.vix = marketContext.vix;
        summary.metrics.marketRegime = marketContext.marketRegime;

        let emailContent = [];
        let validatedContent = [];
        let contextPayload = null;
        let subjectTag = undefined;

        if (opportunities.length === 0) {
            console.log('   ℹ️  No opportunities cleared the screen – generating context-only digest');
            const digestNote = 'No qualifying earnings setups cleared the filters today—delivering context only.';
            contextPayload = { ...(marketContext || {}), digestNote };
            subjectTag = 'No Screened Setups';
            addStep('Generate AI analysis', 'skipped', 'No opportunities available');
        } else {
            console.log('3. 🤖 Generating AI analysis...');
            emailContent = await generateTradingIdeas(GEMINI_API_KEY, opportunities, marketContext);
            console.log(`   ✅ Generated ${emailContent.length} analyses`);
            addStep('Generate AI analysis', 'success', `Generated ${emailContent.length} analyses`);

            console.log('4. 🛡️ Validating analyses...');
            validatedContent = emailContent.filter(item => {
                const validation = validateAnalysis(item.analysis);
                if (!validation.isValid) {
                    console.warn(`   ⚠️  Filtering out ${item.opportunity.symbol}: ${validation.issues.join(', ')}`);
                    return false;
                }
                return true;
            });

            summary.metrics.generatedAnalyses = emailContent.length;
            summary.metrics.validatedAnalyses = validatedContent.length;

            if (validatedContent.length === 0) {
                console.log('   ℹ️  All analyses were held by the quality gate – sending context-only digest');
                const digestNote = 'All screened names were held by the quality gate—see context below while we wait for better setups.';
                contextPayload = { ...(marketContext || {}), digestNote };
                subjectTag = 'Quality Gate Hold';
                addStep('Validate analyses', 'warning', '0 passed; all filtered out');
            } else {
                if (validatedContent.length !== emailContent.length) {
                    console.log(`   ⚠️  ${validatedContent.length} analyses passed validation; ${emailContent.length - validatedContent.length} filtered out`);
                    addStep('Validate analyses', 'warning', `${validatedContent.length} passed; ${emailContent.length - validatedContent.length} filtered out`);
                } else {
                    console.log(`   ✅ ${validatedContent.length} analyses passed validation`);
                    addStep('Validate analyses', 'success', `${validatedContent.length} analyses passed validation`);
                }
            }
        }

        console.log(`${contextPayload ? '5' : '5'}. 📧 Sending newsletter...`);
        const result = await sendEmailDigest(
            RESEND_API_KEY,
            AUDIENCE_ID,
            contextPayload ? [] : validatedContent,
            contextPayload ? contextPayload : marketContext,
            {
                opportunityCount: contextPayload ? 0 : validatedContent.length,
                ...(subjectTag ? { subjectTag } : {})
            }
        );
        console.log(`   ✅ ${contextPayload ? 'Broadcast dispatched' : 'Newsletter sent'} - Broadcast ID: ${result.broadcastId}`);
        addStep('Send newsletter', 'success', `Broadcast dispatched (ID: ${result.broadcastId})`);
        summary.metrics.newsletterSent = true;
        summary.metrics.broadcastId = result.broadcastId;
        summary.metrics.recipientCount = result.recipientCount;
        summary.metrics.completedAt = result.timestamp;
        summary.metrics.newsletterReason = contextPayload ? (subjectTag === 'No Screened Setups' ? 'no-opportunities' : 'quality-gate') : 'opportunities-published';

        // Finalize summary
        summary.finishedAt = new Date().toISOString();
        summary.durationMs = Date.now() - startedAtMs;
        summary.success = summary.errors.length === 0;

        // Optionally send run summary email (requires recipients)
    const from = process.env.SUMMARY_EMAIL_FROM;
    const rawRecipients = process.env.RECIPIENTS || process.env.SUMMARY_EMAIL_RECIPIENT;
        const recipients = rawRecipients
            ? Array.from(new Map(
                String(rawRecipients)
                    .split(/[;,\n]/)
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(e => [e.toLowerCase(), e])
              ).values())
            : [];

        if (!RESEND_API_KEY || recipients.length === 0 || !from) {
            console.log('ℹ️  Skipping run summary email (set RESEND_API_KEY, SUMMARY_EMAIL_FROM, and RECIPIENTS or SUMMARY_EMAIL_RECIPIENT)');
        } else {
            // Small pause to avoid back-to-back API calls after broadcast send
            await new Promise(res => setTimeout(res, 500));
            console.log(`📬 Sending run summary to: ${recipients.join(', ')}`);
            try {
                await sendRunSummaryEmail(RESEND_API_KEY, summary, recipients, { from });
                console.log('✅ Summary email sent');
            } catch (err) {
                console.warn(`⚠️  Summary email failed: ${err.message}`);
            }
        }

        console.log(`\n🎉 Full run completed successfully (${contextPayload ? (subjectTag === 'No Screened Setups' ? 'context-only update' : 'quality gate update') : 'opportunities published'})!`);
        
    } catch (error) {
        console.error('❌ Full run failed:', error.message);
        throw error;
    }
}

async function previewEmail() {
    console.log('👀 Generating email preview...');
    
    // Mock data for preview
    const mockContent = [{
        opportunity: {
            symbol: 'AAPL',
            date: '2025-10-28',
            daysToEarnings: 15,
            qualityScore: 85,
            volatilityData: {
                currentPrice: 150.25,
                impliedVolatility: 35.5,
                historicalVolatility: 28.3,
                expectedMove: 8.75,
                optionsVolume: 15000,
                technicalIndicators: { rsi: 68.5, atr: 2.15 }
            }
        },
        analysis: {
            sentimentScore: 8,
            recommendation: 'STRONGLY CONSIDER',
            strategies: [
                { name: 'Iron Condor', details: 'Sell 145/150/155/160 Iron Condor for $2.50 credit targeting 20% profit in 10-14 days' }
            ],
            riskFactors: 'High IV environment may lead to volatility crush post-earnings'
        }
    }, {
        opportunity: {
            symbol: 'TSLA',
            date: '2025-10-30',
            daysToEarnings: 17,
            qualityScore: 72,
            volatilityData: {
                currentPrice: 245.80,
                impliedVolatility: 45.2,
                historicalVolatility: 52.1,
                expectedMove: 15.30,
                optionsVolume: 28500,
                technicalIndicators: { rsi: 75.2, atr: 8.65 }
            }
        },
        analysis: {
            sentimentScore: 6,
            recommendation: 'CONSIDER',
            strategies: [
                { name: 'Bull Put Spread', details: 'Sell 230/235 Put Spread for $1.75 credit with 65% win rate' },
                { name: 'Short Strangle', details: 'Sell 225 Put / 265 Call for $4.20 credit targeting IV contraction' }
            ],
            riskFactors: 'High volatility stock with unpredictable earnings reactions'
        }
    }];
    
    const mockMarketContext = { vix: 18.5, marketRegime: 'normal' };
    
    const htmlContent = previewEmailTemplate(mockContent, mockMarketContext);
    
    // Save preview to file
    const fs = await import('fs');
    const previewPath = './email-preview.html';
    fs.writeFileSync(previewPath, htmlContent);
    
    console.log(`✅ Email preview saved to: ${previewPath}`);
    console.log('   Open this file in your browser to see the email template');
}

async function testSummaryEmail() {
    console.log('📧 Testing run summary email...');
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.SUMMARY_EMAIL_FROM;
    const rawRecipients = process.env.RECIPIENTS || process.env.SUMMARY_EMAIL_RECIPIENT;

    if (!apiKey) {
        throw new Error('RESEND_API_KEY environment variable is not set');
    }

    if (!from) {
        throw new Error('SUMMARY_EMAIL_FROM environment variable is not set');
    }

    if (!rawRecipients) {
        throw new Error('No recipients provided. Set RECIPIENTS or SUMMARY_EMAIL_RECIPIENT');
    }

    const recipients = String(rawRecipients)
        .split(/[;,\n]/)
        .map(s => s.trim())
        .filter(Boolean);

    const startedAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const summary = {
        success: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: 3 * 60 * 1000,
        steps: [
            { name: 'Validate environment', status: 'success', detail: 'All required secrets present' },
            { name: 'Scan earnings opportunities', status: 'success', detail: '12 opportunities analyzed' },
            { name: 'Generate AI analysis', status: 'success', detail: '9 analyses generated' },
            { name: 'Validate analyses', status: 'warning', detail: '7 passed, 2 filtered out' },
            { name: 'Send newsletter', status: 'success', detail: 'Broadcast dispatched (ID: test-123)' }
        ],
        metrics: {
            newsletterSent: true,
            broadcastId: 'test-123',
            recipientCount: 1,
            vix: 18.4,
            marketRegime: 'normal'
        },
        errors: []
    };

    console.log(`Sending summary to: ${recipients.join(', ')}`);
    await sendRunSummaryEmail(apiKey, summary, recipients, { from });
    console.log('✅ Summary email sent');
}

async function testSpecificStock() {
    const symbol = process.env.SYMBOL;
    if (!symbol) {
        throw new Error('SYMBOL environment variable is required');
    }
    
    console.log(`📊 Testing analysis for ${symbol}...`);
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!alphaVantageApiKey) {
        console.log('⚠️  ALPHA_VANTAGE_API_KEY not set, using mock data');
    }
    
    const result = await getBulkVolatilityAnalysis([symbol], alphaVantageApiKey);
    const symbolData = result[symbol];
    
    if (symbolData) {
        console.log(`✅ Analysis for ${symbol}:`);
        console.log(`  Price: $${symbolData.currentPrice?.toFixed(2) || 'N/A'}`);
        console.log(`  IV Estimate: ${symbolData.impliedVolatility?.toFixed(1) || 'N/A'}%`);
        console.log(`  Volatility Score: ${symbolData.volatilityScore || 'N/A'}/100`);
    } else {
        console.log(`❌ No data available for ${symbol}`);
    }
}

async function validateApiKeys() {
    console.log('🔑 Validating API keys...');
    
    const keys = [
        { name: 'FINNHUB_API_KEY', value: process.env.FINNHUB_API_KEY },
        { name: 'ALPHA_VANTAGE_API_KEY', value: process.env.ALPHA_VANTAGE_API_KEY },
        { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY },
        { name: 'RESEND_API_KEY', value: process.env.RESEND_API_KEY }
    ];
    
    keys.forEach(key => {
        if (key.value) {
            console.log(`  ✅ ${key.name}: Present (${key.value.length} chars)`);
        } else {
            console.log(`  ❌ ${key.name}: Missing`);
        }
    });
    
    console.log('\n🔍 Testing API connectivity...');
    
    // Test Finnhub
    if (process.env.FINNHUB_API_KEY) {
        try {
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${process.env.FINNHUB_API_KEY}`);
            if (response.ok) {
                console.log('  ✅ Finnhub API: Working');
            } else {
                console.log('  ❌ Finnhub API: Error');
            }
        } catch (error) {
            console.log('  ❌ Finnhub API: Connection failed');
        }
    }
    
    console.log('✅ API key validation completed');
}

main().catch(console.error);

/**
 * @fileoverview Options Insight - Automated Earnings Analysis Pipeline
 * @description Cloudflare Worker that scans earnings calendars, performs volatility analysis,
 * generates AI-powered trading insights, and delivers professional newsletters via email.
 * Implements 7-stage deterministic pipeline with graceful degradation.
 */

import { getEarningsOpportunities, getMarketContext } from './finnhub.js';
import { generateTradingIdeas, validateAnalysis } from './gemini.js';
import { sendEmailDigest, sendRunSummaryEmail, addSubscriberToAudience } from './email.js';
import { initializeRealData } from './real-volatility.js';

/**
 * Main Cloudflare Worker export with scheduled and fetch handlers
 * @namespace Worker
 */
export default {
    /**
     * Scheduled handler for automated daily newsletter generation
     * @async
     * @param {Object} controller - Cloudflare cron controller
     * @param {Object} env - Environment variables and secrets
     * @param {Object} ctx - Execution context
     * @description Runs the complete 7-stage pipeline: Environment validation,
     * data initialization, earnings scanning, market context, AI analysis,
     * validation, and newsletter delivery. Includes comprehensive error handling
     * and summary reporting.
     */
    async scheduled(controller, env, ctx) {
        console.log("🎯 Running Options Insight Research Agent...");
        let summary;

        try {
            summary = await processAndSendDigest(env);
        } catch (error) {
            console.error("❌ Options Insight failed to run:", error);
            summary = buildEmergencySummary(error);
        }

        await deliverRunSummary(env, summary);

        if (!summary.success) {
            console.warn("⚠️  Research agent completed with issues – see summary for details");
        }
    },

    /**
     * HTTP fetch handler for API endpoints
     * @async  
     * @param {Request} request - HTTP request object
     * @param {Object} env - Environment variables and secrets
     * @param {Object} ctx - Execution context
     * @returns {Response} HTTP response
     * @description Handles various API endpoints:
     * - GET /health: System health check
     * - GET /status: Configuration audit  
     * - POST /trigger: Manual pipeline execution
     * - POST /subscribe: Newsletter subscription management
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Health check endpoint
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'healthy',
                service: 'Options Insight',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // API status endpoint - checks if required environment variables are present
        if (url.pathname === '/status') {
            const { FINNHUB_API_KEY, ALPHA_VANTAGE_API_KEY, RESEND_API_KEY, GEMINI_API_KEY, AUDIENCE_ID } = env;
            
            const status = {
                service: 'Options Insight',
                timestamp: new Date().toISOString(),
                environment: {
                    FINNHUB_API_KEY: !!FINNHUB_API_KEY,
                    RESEND_API_KEY: !!RESEND_API_KEY,
                    GEMINI_API_KEY: !!GEMINI_API_KEY,
                    AUDIENCE_ID: !!AUDIENCE_ID,
                    // Alpha Vantage is optional (legacy fallback)
                    ALPHA_VANTAGE_API_KEY: !!ALPHA_VANTAGE_API_KEY
                },
                // Ready when primary keys are present; Alpha Vantage is optional
                ready: !!(FINNHUB_API_KEY && RESEND_API_KEY && GEMINI_API_KEY && AUDIENCE_ID)
            };

            return new Response(JSON.stringify(status, null, 2), {
                headers: { 'Content-Type': 'application/json' },
                status: status.ready ? 200 : 503
            });
        }

        if (url.pathname === '/subscribe') {
            if (request.method === 'OPTIONS') {
                return handleCorsPreflight(request, env);
            }

            const origin = request.headers.get('Origin');
            const corsHeaders = buildCorsHeaders(origin, env);

            if (!corsHeaders) {
                console.warn(`🚫 Blocked subscribe request from disallowed origin: ${origin || 'unknown'}`);
                const fallbackHeaders = createCorsHeaderObject('*');
                return respondWithCors(JSON.stringify({
                    success: false,
                    error: 'Origin not allowed'
                }), {
                    status: 403
                }, fallbackHeaders);
            }

            if (request.method !== 'POST') {
                return respondWithCors(JSON.stringify({
                    success: false,
                    error: 'Method not allowed'
                }), {
                    status: 405
                }, corsHeaders);
            }

            let payload;
            try {
                payload = await request.json();
            } catch (error) {
                console.warn('⚠️  Invalid JSON payload for /subscribe');
                return respondWithCors(JSON.stringify({
                    success: false,
                    error: 'Invalid JSON payload'
                }), {
                    status: 400
                }, corsHeaders);
            }

            const email = (payload?.email || '').trim().toLowerCase();
            const firstName = (payload?.firstName || '').trim();
            const lastName = (payload?.lastName || '').trim();

            if (!isValidEmail(email)) {
                return respondWithCors(JSON.stringify({
                    success: false,
                    error: 'Please provide a valid email address'
                }), {
                    status: 400
                }, corsHeaders);
            }

            if (!env.RESEND_API_KEY || !env.AUDIENCE_ID) {
                console.error('❌ Subscription attempt while RESEND_API_KEY or AUDIENCE_ID missing');
                return respondWithCors(JSON.stringify({
                    success: false,
                    error: 'Subscription service unavailable'
                }), {
                    status: 503
                }, corsHeaders);
            }

            try {
                const result = await addSubscriberToAudience(env.RESEND_API_KEY, env.AUDIENCE_ID, email, {
                    firstName,
                    lastName,
                    attributes: {
                        source: payload?.source || 'options-insight-pages',
                        consentedAt: new Date().toISOString()
                    }
                });

                const message = result.status === 'exists'
                    ? 'You are already subscribed to Options Insight.'
                    : 'Thanks! You are on the list for the next briefing.';

                return respondWithCors(JSON.stringify({
                    success: true,
                    message,
                    status: result.status
                }), {
                    status: 200
                }, corsHeaders);
            } catch (error) {
                console.error('❌ Failed to add subscriber:', error);
                return respondWithCors(JSON.stringify({
                    success: false,
                    error: 'Unable to subscribe at this time'
                }), {
                    status: 500
                }, corsHeaders);
            }
        }

        // Manual trigger endpoint (for testing)
        if (url.pathname === '/trigger' && request.method === 'POST') {
            const expectedSecret = env.TRIGGER_AUTH_SECRET || env.TRIGGER_AUTH_TOKEN;
            if (!expectedSecret) {
                console.warn('⚠️  Manual trigger blocked: TRIGGER_AUTH_SECRET not configured');
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Manual trigger disabled: missing TRIGGER_AUTH_SECRET',
                    timestamp: new Date().toISOString()
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 503
                });
            }

            const providedSecret = request.headers.get('x-trigger-secret') || url.searchParams.get('token');
            if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
                console.warn('⚠️  Unauthorized manual trigger attempt');
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Unauthorized',
                    timestamp: new Date().toISOString()
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 401
                });
            }

            let summary;

            try {
                summary = await processAndSendDigest(env);
            } catch (error) {
                console.error('❌ Manual trigger failed:', error);
                summary = buildEmergencySummary(error);
            }

            await deliverRunSummary(env, summary);

            return new Response(JSON.stringify({
                success: summary.success,
                summary,
                timestamp: new Date().toISOString()
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: summary.success ? 200 : 500
            });
        }

        // Default response
        return new Response('Options Insight Worker - Use /health, /status, or POST /trigger endpoints', {
            status: 404
        });
    }
};

async function processAndSendDigest(env) {
    const summary = createRunSummary();
    const startTime = Date.now();

    const beginStep = (name) => {
        summary._activeStep = name;
    };

    const completeStep = (status, detail) => {
        const name = summary._activeStep || 'Pipeline';
        summary.steps.push({ name, status, detail });
        summary._activeStep = null;
    };

    const failStep = (detail) => {
        const name = summary._activeStep || 'Pipeline';
        summary.steps.push({ name, status: 'failed', detail });
        summary._activeStep = null;
    };

    try {
    const { FINNHUB_API_KEY, ALPHA_VANTAGE_API_KEY, RESEND_API_KEY, GEMINI_API_KEY, AUDIENCE_ID } = env;
    let marketContext = null;

        beginStep('Validate environment');
        const missingKeys = ['FINNHUB_API_KEY', 'RESEND_API_KEY', 'GEMINI_API_KEY', 'AUDIENCE_ID'].filter(key => !env[key]);
        if (missingKeys.length > 0) {
            const message = `Missing required secrets: ${missingKeys.join(', ')}`;
            failStep(message);
            summary.errors.push(formatError(new Error(message)));
            return finalizeSummary(summary, startTime);
        }
        completeStep('success', 'All required secrets present');

    beginStep('Initialize market data');
        if (!ALPHA_VANTAGE_API_KEY && !FINNHUB_API_KEY) {
            console.warn("⚠️  No Alpha Vantage or Finnhub API keys provided, using fallback data");
            completeStep('warning', 'No market data API keys provided; using fallback data');
        } else {
            console.log("🔐 Initializing market data providers...");
            try {
                const dataInit = await initializeRealData(ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY);
                if (!dataInit) {
                    console.warn("⚠️  Market data initialization failed, using fallback data");
                    completeStep('warning', 'Market data initialization failed; using fallback data');
                } else {
                    console.log("✅ Market data providers initialized successfully");
                    completeStep('success', 'Market data providers initialized successfully');
                }
            } catch (error) {
                console.warn('⚠️  Market data providers threw an error, using fallback data', error);
                completeStep('warning', `Market data error: ${error.message}`);
            }
        }

        beginStep('Scan earnings opportunities');
        console.log("📊 Step 1: Scanning earnings opportunities...");
    const opportunities = await getEarningsOpportunities(FINNHUB_API_KEY);
        summary.metrics.totalOpportunities = opportunities.length;
        completeStep('success', `${opportunities.length} opportunities analyzed`);

        if (opportunities.length === 0) {
            console.log("ℹ️  No qualifying earnings opportunities found today.");
            beginStep('Generate AI analysis');
            completeStep('skipped', 'No opportunities available');

            beginStep('Fetch market context');
            try {
                marketContext = await getMarketContext(FINNHUB_API_KEY);
                summary.metrics.vix = marketContext.vix;
                summary.metrics.marketRegime = marketContext.marketRegime;
                completeStep('success', `VIX ${marketContext.vix?.toFixed(1) ?? 'N/A'}, Regime: ${marketContext.marketRegime || 'Unknown'}`);
            } catch (error) {
                console.warn('⚠️  Failed to fetch market context for fallback digest:', error);
                completeStep('warning', `Market context unavailable: ${error.message}`);
                marketContext = marketContext || {};
            }

            const digestNote = 'No qualifying earnings setups cleared the filters today—delivering context only.';
            const contextPayload = { ...(marketContext || {}), digestNote };

            beginStep('Send newsletter');
            const result = await sendEmailDigest(RESEND_API_KEY, AUDIENCE_ID, [], contextPayload, {
                from: env.NEWSLETTER_FROM || env.NEWSLETTER_FROM_EMAIL || 'newsletter@ravishankars.com',
                subjectTag: 'No Screened Setups',
                opportunityCount: 0
            });
            summary.metrics.newsletterSent = true;
            summary.metrics.broadcastId = result.broadcastId;
            summary.metrics.recipientCount = result.recipientCount;
            summary.metrics.completedAt = result.timestamp;
            summary.metrics.newsletterReason = 'no-opportunities';
            summary.metrics.newsletterNote = digestNote;
            completeStep('success', `Broadcast ${result.broadcastId} dispatched (no opportunities)`);

            console.log(`🎉 Context-only update sent successfully!`);
            console.log(`   📧 Broadcast ID: ${result.broadcastId}`);
            console.log(`   🕒 Completed at: ${result.timestamp}`);

            return finalizeSummary(summary, startTime);
        }

        console.log(`✅ Found ${opportunities.length} qualified opportunities`);

        beginStep('Fetch market context');
        console.log("🌍 Step 2: Getting market context...");
    marketContext = await getMarketContext(FINNHUB_API_KEY);
        summary.metrics.vix = marketContext.vix;
        summary.metrics.marketRegime = marketContext.marketRegime;
        completeStep('success', `VIX ${marketContext.vix?.toFixed(1) ?? 'N/A'}, Regime: ${marketContext.marketRegime}`);
        console.log(`✅ Market context - VIX: ${marketContext.vix?.toFixed(1)}, Regime: ${marketContext.marketRegime}`);

        beginStep('Generate AI analysis');
        console.log("🤖 Step 3: Generating AI analysis...");
    const emailContent = await generateTradingIdeas(GEMINI_API_KEY, opportunities, marketContext);
        summary.metrics.generatedAnalyses = emailContent.length;
        completeStep('success', `Generated ${emailContent.length} analyses`);

        beginStep('Validate analyses');
    const validatedContent = emailContent.filter(item => {
            const validation = validateAnalysis(item.analysis);
            if (!validation.isValid) {
                console.warn(`⚠️  Filtering out ${item.opportunity.symbol} due to: ${validation.issues.join(', ')}`);
                return false;
            }
            return true;
        });
        const filteredCount = emailContent.length - validatedContent.length;
        summary.metrics.validatedAnalyses = validatedContent.length;
        if (filteredCount > 0) {
            completeStep('warning', `${validatedContent.length} passed, ${filteredCount} filtered out`);
        } else {
            completeStep('success', `${validatedContent.length} analyses passed validation`);
        }

        if (validatedContent.length === 0) {
            console.log("ℹ️  No analyses passed validation - newsletter will not be sent");
            const digestNote = 'All screened names were held by the quality gate—see context below while we wait for better setups.';
            const contextPayload = { ...(marketContext || {}), digestNote };

            beginStep('Send newsletter');
            const result = await sendEmailDigest(RESEND_API_KEY, AUDIENCE_ID, [], contextPayload, {
                from: env.NEWSLETTER_FROM || env.NEWSLETTER_FROM_EMAIL || 'newsletter@ravishankars.com',
                subjectTag: 'Quality Gate Hold',
                opportunityCount: 0
            });
            summary.metrics.newsletterSent = true;
            summary.metrics.broadcastId = result.broadcastId;
            summary.metrics.recipientCount = result.recipientCount;
            summary.metrics.completedAt = result.timestamp;
            summary.metrics.newsletterReason = 'quality-gate';
            summary.metrics.newsletterNote = digestNote;
            completeStep('success', `Broadcast ${result.broadcastId} dispatched (quality gate hold)`);

            console.log(`🎉 Context-only update sent successfully!`);
            console.log(`   📧 Broadcast ID: ${result.broadcastId}`);
            console.log(`   🕒 Completed at: ${result.timestamp}`);

            return finalizeSummary(summary, startTime);
        }

        console.log(`✅ Generated ${validatedContent.length} validated analyses`);

        beginStep('Send newsletter');
        console.log("📧 Step 4: Sending newsletter...");
        const result = await sendEmailDigest(RESEND_API_KEY, AUDIENCE_ID, validatedContent, marketContext, {
            from: env.NEWSLETTER_FROM || env.NEWSLETTER_FROM_EMAIL || 'newsletter@ravishankars.com',
            opportunityCount: validatedContent.length
        });
        summary.metrics.newsletterSent = true;
        summary.metrics.broadcastId = result.broadcastId;
        summary.metrics.recipientCount = result.recipientCount;
        summary.metrics.completedAt = result.timestamp;
        summary.metrics.newsletterReason = 'opportunities-published';
        completeStep('success', `Broadcast ${result.broadcastId} dispatched`);

        console.log(`🎉 Newsletter sent successfully!`);
        console.log(`   📊 Opportunities analyzed: ${opportunities.length}`);
        console.log(`   ✅ Analyses passed validation: ${validatedContent.length}`);
        console.log(`   📧 Broadcast ID: ${result.broadcastId}`);
        console.log(`   🕒 Completed at: ${result.timestamp}`);

        return finalizeSummary(summary, startTime);
    } catch (error) {
        console.error('❌ Pipeline failure:', error);
        failStep(error.message || 'Unknown pipeline failure');
        summary.errors.push(formatError(error));
        return finalizeSummary(summary, startTime);
    }
}

async function deliverRunSummary(env, summary) {
    const rawRecipients = env.SUMMARY_EMAIL_RECIPIENT;
    const parsedRecipients = rawRecipients
        ? String(rawRecipients)
            .split(/[;,\n]/)
            .map(s => s.trim())
            .filter(Boolean)
        : [];
    const recipients = Array.from(new Map(parsedRecipients.map(e => [e.toLowerCase(), e])).values());

    if (!env.RESEND_API_KEY) {
        console.warn('⚠️  Skipping run summary email: RESEND_API_KEY not configured');
        return;
    }

    if (!recipients.length) {
        console.warn('⚠️  Skipping run summary email: no recipient configured');
        return;
    }

    try {
        await sendRunSummaryEmail(env.RESEND_API_KEY, summary, recipients, {
            from: env.SUMMARY_EMAIL_FROM || 'alerts@ravishankars.com'
        });
        console.log(`📬 Run summary email sent to: ${recipients.join(', ')}`);
    } catch (error) {
        console.error('❌ Failed to send run summary email:', error);
    }
}

function createRunSummary() {
    return {
        success: false,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        steps: [],
        metrics: {
            newsletterSent: false
        },
        errors: [],
        _activeStep: null
    };
}

function finalizeSummary(summary, startTime) {
    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startTime;
    summary.success = summary.errors.length === 0;
    delete summary._activeStep;
    return summary;
}

function buildEmergencySummary(error) {
    const summary = createRunSummary();
    summary.errors.push(formatError(error));
    summary.steps.push({ name: 'Pipeline', status: 'failed', detail: error.message || 'Unhandled failure' });
    return finalizeSummary(summary, Date.now());
}

function formatError(error) {
    return {
        message: error?.message || String(error),
        stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 5).join('\n') : null
    };
}

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }

    const length = Math.max(a.length, b.length);
    let result = a.length === b.length ? 0 : 1;

    for (let i = 0; i < length; i++) {
        const charCodeA = a.charCodeAt(i) || 0;
        const charCodeB = b.charCodeAt(i) || 0;
        result |= charCodeA ^ charCodeB;
    }

    return result === 0;
}

function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const value = email.trim();
    if (value.length > 254) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

function getAllowedOrigins(env) {
    const fromEnv = env.SIGNUP_ALLOWED_ORIGINS || env.SUBSCRIBE_ALLOWED_ORIGINS || env.ALLOWED_ORIGINS;
    if (fromEnv) {
        return fromEnv.split(',').map(origin => origin.trim()).filter(Boolean);
    }

    return [
        'https://options-insight.ravishankars.com',
        'https://options-insight.pages.dev',
        'https://optionsinsight.pages.dev',
        'https://options-insight-signup.pages.dev',
        'https://*.options-insight-signup.pages.dev',
        'http://localhost:8787',
        'http://localhost:4173',
        'http://127.0.0.1:8787'
    ];
}

function buildCorsHeaders(origin, env) {
    const allowedOrigins = getAllowedOrigins(env);
    const allowAll = allowedOrigins.includes('*');

    if (!origin) {
        return createCorsHeaderObject(allowAll ? '*' : allowedOrigins[0] || '*');
    }

    if (allowAll) {
        return createCorsHeaderObject('*');
    }

    const matchedOrigin = resolveAllowedOrigin(origin, allowedOrigins);
    if (matchedOrigin) {
        return createCorsHeaderObject(matchedOrigin === '*' ? '*' : origin);
    }

    return null;
}

function getDefaultCorsHeaders(env) {
    const allowedOrigins = getAllowedOrigins(env);
    if (!allowedOrigins.length) {
        return createCorsHeaderObject('*');
    }
    const allowAll = allowedOrigins.includes('*');
    return createCorsHeaderObject(allowAll ? '*' : allowedOrigins[0]);
}

function resolveAllowedOrigin(origin, allowedOrigins) {
    for (const allowed of allowedOrigins) {
        if (!allowed) {
            continue;
        }

        if (allowed === '*') {
            return '*';
        }

        if (!allowed.includes('*')) {
            if (allowed === origin) {
                return origin;
            }
            continue;
        }

        const pattern = allowed
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        if (regex.test(origin)) {
            return origin;
        }
    }

    return null;
}

function createCorsHeaderObject(allowOrigin) {
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function handleCorsPreflight(request, env) {
    const corsHeaders = buildCorsHeaders(request.headers.get('Origin'), env);
    if (!corsHeaders) {
        return new Response(null, { status: 403 });
    }

    const headers = new Headers(corsHeaders);
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    if (requestedHeaders) {
        headers.set('Access-Control-Allow-Headers', requestedHeaders);
    }

    return new Response(null, {
        status: 204,
        headers
    });
}

function respondWithCors(body, init = {}, corsHeaders = {}) {
    const responseHeaders = new Headers(init.headers || {});
    for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
    }
    if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/json');
    }

    return new Response(body, {
        ...init,
        headers: responseHeaders
    });
}
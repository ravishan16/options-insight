/**
 * Professional email template using template literals (JSX-free for Node.js compatibility)
 *
 * Modified for Issue: Fix 52-week range and add ticker hyperlinks to newsletter #16
 */

const palette = {
  background: "#FAF6F0",
  surface: "#FDFDFD",
  text: "#3A3A3A",
  muted: "#7C6F64",
  primary: "#DDBEA9",
  primaryDark: "#B45F4D",
  accent: "#E4C590",
  highlight: "#F3E2D5",
};

const EmailTemplate = ({
  opportunities = [],
  marketContext = {},
  date = new Date().toDateString(),
}) => {
  const digestNote = marketContext?.digestNote;

  const getSentimentColor = (score) => {
    if (score >= 8) return palette.primaryDark;
    if (score >= 6) return palette.primary;
    return palette.muted;
  };

  const getRecommendationStyle = (recommendation) => {
    const styles = {
      "STRONGLY CONSIDER": `background-color: ${palette.primaryDark}; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;`,
      NEUTRAL: `background-color: ${palette.primary}; color: ${palette.text}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;`,
      "STAY AWAY": `background-color: ${palette.muted}; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;`,
    };
    return styles[recommendation] || styles["NEUTRAL"];
  };

  // Generate compact opportunities display
  const opportunitiesHtml =
    opportunities.length > 0
      ? `
    <div style="margin: 16px 24px;">
      ${opportunities
        .map((item, index) => {
          const opp = item.opportunity;
          const analysis = item.analysis;
          const vol = opp.volatilityData || {};

          return `
          <div class="opportunity-card" style="margin: 12px 0; padding: 16px; border: 1px solid ${palette.accent}; border-radius: 8px; background-color: ${index % 2 === 0 ? palette.surface : palette.highlight};">
            <table class="header-table" style="width: 100%; margin-bottom: 8px;">
              <tr>
                <td style="width: 70%; vertical-align: middle;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 0; margin: 0;">
                        <h3 style="font-size: 18px; font-weight: bold; margin: 0; color: ${palette.text}; display: inline-block;">
                          <a href="https://finance.yahoo.com/quote/${opp.symbol}" target="_blank" style="color: ${palette.text}; text-decoration: none;">
                            ${opp.symbol}
                          </a>
                        </h3>
                        <span style="font-size: 12px; color: ${palette.muted}; margin-left: 12px;">$${vol.currentPrice?.toFixed(2) || "N/A"}</span>
                        <span style="font-size: 12px; color: ${palette.muted}; margin-left: 8px;">${new Date(opp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${opp.daysToEarnings}d)</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td class="sentiment-score" style="width: 30%; text-align: right; vertical-align: middle;">
                  <table style="margin: 0 auto;">
                    <tr>
                      <td style="text-align: center; padding-right: 8px;">
                        <div style="color: ${getSentimentColor(analysis.sentimentScore)}; font-weight: 600; font-size: 20px; margin: 0;">${analysis.sentimentScore || "N/A"}</div>
                        <div style="font-size: 10px; color: ${palette.muted}; margin: 0;">Sentiment</div>
                      </td>
                      <td style="text-align: center;">
                        <span class="recommendation-badge" style="${getRecommendationStyle(analysis.recommendation)}">
                          ${
                            analysis.recommendation === "STRONGLY CONSIDER"
                              ? "BUY"
                              : analysis.recommendation === "NEUTRAL"
                                ? "NEUTRAL"
                                : "AVOID"
                          }
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            
            <table class="metrics-table" style="width: 100%; font-size: 11px; color: ${palette.text}; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: 500; width: 20%;">IV/HV:</td>
                <td style="padding: 4px 8px 4px 0; width: 30%;">${vol.impliedVolatility?.toFixed(1) || "N/A"}% / ${vol.historicalVolatility?.toFixed(1) || "N/A"}%</td>
                <td style="padding: 4px 8px 4px 0; font-weight: 500; width: 20%;">Expected Move:</td>
                <td style="padding: 4px 0; width: 30%;">${
                  vol.expectedMove && vol.currentPrice
                    ? `${((vol.expectedMove / vol.currentPrice) * 100).toFixed(1)}% ($${vol.expectedMove.toFixed(2)})`
                    : "N/A"
                }</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: 500;">Quality:</td>
                <td style="padding: 4px 8px 4px 0; color: ${opp.qualityScore >= 70 ? palette.primaryDark : opp.qualityScore >= 40 ? palette.accent : palette.muted}; font-weight: 600;">
                  ${opp.qualityScore || "N/A"}/100
                </td>
                <td style="padding: 4px 8px 4px 0; font-weight: 500;">Vol Status:</td>
                <td style="padding: 4px 0; color: ${vol.impliedVolatility && vol.historicalVolatility && vol.impliedVolatility > vol.historicalVolatility ? palette.primaryDark : palette.muted}; font-weight: 500;">
                  ${
                    // Issue #22: Clarify Volatility Regime - Explicitly state IV vs HV
                    vol.impliedVolatility && vol.historicalVolatility
                      ? vol.impliedVolatility > vol.historicalVolatility
                        ? "High (IV > HV)"
                        : "Normal (IV <= HV)"
                      : "N/A"
                  }
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: 500;">RSI:</td>
                <td style="padding: 4px 8px 4px 0; color: ${
                  vol.technicalIndicators?.rsi
                    ? vol.technicalIndicators.rsi > 70
                      ? palette.primaryDark
                      : vol.technicalIndicators.rsi < 30
                        ? palette.primary
                        : palette.muted
                    : palette.muted
                };">
                  ${vol.technicalIndicators?.rsi?.toFixed(1) || "N/A"}
                </td>
                <td style="padding: 4px 8px 4px 0; font-weight: 500;">52W Range:</td>
                <td style="padding: 4px 0; font-size: 10px;">
                  ${
                    vol.fiftyTwoWeekLow != null && vol.fiftyTwoWeekHigh != null
                      ? `$${vol.fiftyTwoWeekLow.toFixed(2)} - $${vol.fiftyTwoWeekHigh.toFixed(2)}`
                      : "N/A"
                  }
                </td>
              </tr>
            </table>
            
            ${
              analysis.strategies && analysis.strategies.length > 0
                ? `
              <div style="margin-top: 8px; font-size: 11px;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${palette.text};">Strategies:</div>
                ${analysis.strategies
                  .slice(0, 2)
                  .map(
                    (strategy) => `
                  <div style="margin-bottom: 2px; color: ${palette.muted};">• ${strategy.name}</div>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>
        `;
        })
        .join("")}
    </div>
  `
      : `
    <div style="padding: 24px; text-align: center; color: ${palette.muted}; background-color: ${palette.highlight}; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-size: 14px;">No qualifying opportunities found today.</p>
      <p style="margin: 4px 0 0 0; font-size: 12px;">Check back tomorrow for new earnings opportunities.</p>
    </div>
  `;

  // Generate AI consolidated recommendation
  const aiRecommendation =
    opportunities.length > 0
      ? generateConsolidatedRecommendation(opportunities, marketContext)
      : "";

  const rawHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Options Insight Digest</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              border-radius: 0 !important;
            }
            .content {
              padding: 16px !important;
            }
            .header-padding {
              padding: 20px 16px !important;
            }
            .opportunity-card {
              margin: 8px 0 !important;
              padding: 12px !important;
            }
            .metrics-table {
              font-size: 10px !important;
            }
            .metrics-table td {
              padding: 3px 4px 3px 0 !important;
              vertical-align: top !important;
            }
            .header-table {
              display: block !important;
            }
            .header-table tr {
              display: block !important;
            }
            .header-table td {
              display: block !important;
              width: 100% !important;
              text-align: left !important;
              margin-bottom: 4px;
              padding: 2px 0 !important;
            }
            .sentiment-score {
              text-align: left !important;
              margin-top: 8px;
            }
            .sentiment-score table {
              margin: 0 !important;
            }
            .recommendation-badge {
              margin-left: 0 !important;
              margin-top: 4px !important;
              display: inline-block !important;
            }
            h1 {
              font-size: 22px !important;
            }
            h2 {
              font-size: 14px !important;
            }
            h3 {
              font-size: 13px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: ${palette.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${palette.text};">
        <div class="container" style="max-width: 600px; margin: 0 auto; background-color: ${palette.surface}; box-shadow: 0 12px 24px rgba(58, 58, 58, 0.15); border-radius: 12px; overflow: hidden;">
          
          <div class="header-padding" style="padding: 28px; background: linear-gradient(135deg, ${palette.primaryDark} 0%, ${palette.primary} 100%); text-align: center;">
            <h1 style="color: ${palette.surface}; margin: 0 0 8px 0; font-size: 26px; font-weight: bold; letter-spacing: 0.02em;">
              🎯 Options Insight
            </h1>
            <p style="color: ${palette.background}; margin: 0; font-size: 14px; font-weight: 500;">
              Quantitative Earnings Opportunities • ${date}
            </p>
          </div>

          <div class="content" style="padding: 22px 28px; background-color: ${palette.highlight}; border-bottom: 1px solid ${palette.accent};">
            <p style="margin: 0; font-size: 14px; color: ${palette.text}; line-height: 1.6;">
              Today's analysis identified <strong>${opportunities.length} high-quality earnings opportunities</strong> using volatility 
              analysis, technical indicators, and AI-powered sentiment scoring.
            </p>
            ${digestNote ? `<p style="margin: 12px 0 0 0; font-size: 13px; color: ${palette.muted}; line-height: 1.6;">${digestNote}</p>` : ""}
          </div>

          <div style="padding: 0;">
            <h2 style="font-size: 16px; font-weight: 600; margin: 24px 28px 8px 28px; color: ${palette.text}; text-transform: uppercase; letter-spacing: 0.08em;">
              📊 Earnings Opportunities
            </h2>
            ${opportunitiesHtml}
          </div>

          ${aiRecommendation}

          ${
            marketContext.vix
              ? `
            <div style="margin: 24px 28px; padding: 18px; background-color: ${palette.surface}; border: 1px solid ${palette.accent}; border-radius: 8px; box-shadow: 0 8px 20px rgba(228, 197, 144, 0.25);">
              <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: ${palette.primaryDark}; text-transform: uppercase; letter-spacing: 0.05em;">
                📈 Market Context
              </h3>
              <div style="font-size: 12px; color: ${palette.muted}; line-height: 1.5;">
                <div style="margin-bottom: 6px;"><strong style="color: ${palette.text};">VIX:</strong> ${marketContext.vix.toFixed(1)} (${getMarketRegimeDescription(marketContext.vix)})</div>
                <div style="margin-bottom: 6px;"><strong style="color: ${palette.text};">Market Regime:</strong> ${marketContext.marketRegime || "Normal"}</div>
                <div><strong style="color: ${palette.text};">Strategy Guidance:</strong> ${getVixGuidance(marketContext.vix)}</div>
              </div>
            </div>
          `
              : ""
          }

          <div style="margin: 24px 28px; padding: 18px; background-color: ${palette.surface}; border: 1px solid ${palette.accent}; border-radius: 8px;">
            <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: ${palette.primaryDark}; text-transform: uppercase; letter-spacing: 0.05em;">
              📚 Key Terms
            </h3>
            <div style="font-size: 11px; color: ${palette.muted}; line-height: 1.5;">
              <div style="margin-bottom: 6px;"><strong>IV (Implied Volatility):</strong> Market's expectation of future price movement</div>
              <div style="margin-bottom: 6px;"><strong>HV (Historical Volatility):</strong> Past 30-day realized price movement</div>
              <div style="margin-bottom: 6px;"><strong>RSI (Relative Strength Index):</strong> Momentum indicator (0-100); >70 overbought, <30 oversold</div>
              <div style="margin-bottom: 6px;"><strong>Expected Move:</strong> Predicted price range through earnings (1 std dev)</div>
              <div style="margin-bottom: 6px;"><strong>52W Range:</strong> 5-week high/low price range for recent context</div>
              <div><strong>Quality Score:</strong> Composite ranking based on liquidity, volume, and data reliability</div>
            </div>
          </div>

          <div style="margin: 24px 28px; padding: 22px; background-color: #F8E6DC; border: 2px solid ${palette.primaryDark}; border-radius: 10px;">
            <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 12px 0; color: ${palette.primaryDark}; display: flex; align-items: center; letter-spacing: 0.04em;">
              ⚠️ Important Disclaimer
            </h3>
            <div style="font-size: 12px; color: ${palette.text}; line-height: 1.5; margin-bottom: 12px;">
              <p style="margin: 0 0 8px 0; font-weight: 600;">
                NOT FINANCIAL ADVICE: This analysis is generated by an automated algorithm and AI (Google Gemini) 
                for educational purposes only. The complete source code is available on 
                <a href="https://github.com/ravishan16/options-insight" style="color: ${palette.primaryDark}; text-decoration: underline;">GitHub</a> 
                for transparency and verification.
              </p>
            </div>
            <div style="font-size: 11px; color: ${palette.muted}; line-height: 1.5;">
              Options trading involves substantial risk and may result in total loss. These are algorithmic 
              recommendations, not advice from any individual. All probability calculations are theoretical. Please 
              consult a qualified financial advisor and only risk capital you can afford to lose.
            </div>
          </div>

          <div style="padding: 22px 28px; background-color: ${palette.background}; border-top: 1px solid ${palette.accent}; text-align: center;">
            <p style="font-size: 11px; color: ${palette.muted}; margin: 0 0 8px 0; line-height: 1.5;">
              Powered by Finnhub, Yahoo Finance, and Google Gemini
            </p>
            <p style="font-size: 10px; color: ${palette.muted}; margin: 0; line-height: 1.4;">
              Options trading involves risk. Past performance does not guarantee future results. 
              This newsletter is for educational purposes only and should not be considered personalized investment advice.
            </p>
            <p style="font-size: 10px; color: ${palette.muted}; margin: 12px 0 0 0;">
              Options Insight Newsletter • Unsubscribe options available in email footer
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  // Added for Issue: Fix 52-week range and add ticker hyperlinks to newsletter #16
  return hyperlinkTickers(rawHtml);
};

// Helper function to generate consolidated AI recommendation
function generateConsolidatedRecommendation(opportunities, marketContext) {
  const stronglyConsider = opportunities.filter(
    (item) => item.analysis.recommendation === "STRONGLY CONSIDER"
  );
  const neutral = opportunities.filter(
    (item) => item.analysis.recommendation === "NEUTRAL"
  );
  const stayAway = opportunities.filter(
    (item) => item.analysis.recommendation === "STAY AWAY"
  );

  const avgSentiment =
    opportunities.reduce(
      (sum, item) => sum + (item.analysis.sentimentScore || 5),
      0
    ) / opportunities.length;

  if (stronglyConsider.length === 0) {
    return `
      <div style="margin: 24px 28px; padding: 18px; background-color: ${palette.highlight}; border: 1px solid ${palette.accent}; border-radius: 8px;">
        <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: ${palette.primaryDark}; text-transform: uppercase; letter-spacing: 0.05em;">
          🤖 AI Consolidated View
        </h3>
        <p style="font-size: 12px; line-height: 1.5; margin: 0; color: ${palette.muted};">
          <strong>NEUTRAL MARKET:</strong> No strongly recommended opportunities today. 
          Average sentiment: ${avgSentiment.toFixed(1)}/10. Consider waiting for better setups or focus on paper trading to refine strategy.
        </p>
      </div>
    `;
  }

  const topPicks = stronglyConsider
    .sort(
      (a, b) =>
        (b.analysis.sentimentScore || 0) - (a.analysis.sentimentScore || 0)
    )
    .slice(0, 2);

  return `
    <div style="margin: 24px 28px; padding: 18px; background-color: ${palette.surface}; border: 1px solid ${palette.accent}; border-radius: 8px; box-shadow: 0 10px 22px rgba(180, 95, 77, 0.2);">
      <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: ${palette.primaryDark}; text-transform: uppercase; letter-spacing: 0.05em;">
        🤖 AI Consolidated Recommendation
      </h3>
      <p style="font-size: 12px; line-height: 1.5; margin: 0 0 8px 0; color: ${palette.muted};">
        <strong>TOP PICKS:</strong> ${topPicks.map((item) => `${item.opportunity.symbol} (${item.analysis.sentimentScore}/10)`).join(", ")}
      </p>
      <p style="font-size: 12px; line-height: 1.5; margin: 0; color: ${palette.muted};">
        <strong>MARKET OUTLOOK:</strong> ${stronglyConsider.length} strong opportunities identified. 
        Avg sentiment: ${avgSentiment.toFixed(1)}/10. Focus on volatility-selling strategies in current ${marketContext.marketRegime || "normal"} regime.
      </p>
    </div>
  `;
}

function getMarketDescription(marketContext) {
  const vix = marketContext.vix || 0;
  if (vix < 15) return "Low fear, premium selling favored";
  if (vix < 25) return "Normal conditions, balanced strategies";
  return "High fear, consider premium buying";
}

function getMarketRegimeDescription(vix) {
  if (vix < 15) return "Low Volatility";
  if (vix < 25) return "Normal Volatility";
  if (vix < 35) return "High Volatility";
  return "Extreme Volatility";
}

function getVixGuidance(vix) {
  if (vix < 15) return "Low fear, premium selling favored";
  if (vix < 25) return "Normal conditions, balanced strategies";
  return "High fear, consider premium buying";
}

/**
 * Helper: Add clickable hyperlinks to ticker symbols in newsletter HTML.
 * Added for Issue: Fix 52-week range and add ticker hyperlinks to newsletter #16
 *
 * This function searches for patterns like $AAPL or $MSFT in the HTML
 * and replaces them with secure clickable links to Yahoo Finance.
 *
 * Example:
 * $AAPL → <a href="https://finance.yahoo.com/quote/AAPL" target="_blank" rel="noopener noreferrer">$AAPL</a>
 *
 * @param {string} html - The HTML content containing ticker symbols.
 * @returns {string} - The HTML content with ticker symbols hyperlinked.
 */
function hyperlinkTickers(html) {
  return html.replace(
    /\$([A-Z]{1,5})\b/g,
    (match, ticker) =>
      `<a href="https://finance.yahoo.com/quote/${ticker}" target="_blank" rel="noopener noreferrer">${match}</a>`
  );
}

export default EmailTemplate;

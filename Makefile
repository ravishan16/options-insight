# Enhanced Makefile for comprehensive testing and development

dev:
	@echo "🚀 Starting development server..."
	@wrangler dev

deploy:
	@echo "🚀 Deploying to Cloudflare Workers..."
	@VALIDATE_ENV_REQUIRED=1 node validate-config.js && wrangler deploy

deploy-pages:
	@echo "🌐 Deploying signup site to Cloudflare Pages..."
	@PROJECT_NAME=$${PROJECT_NAME:-options-insight-signup}; \
	wrangler pages deploy pages --project-name $$PROJECT_NAME

# Individual component testing
test-finnhub:
	@echo "📊 Testing Finnhub earnings data..."
	@node -r dotenv/config src/cli.js finnhub

test-alphavantage:
	@echo "📈 Testing Alpha Vantage market data..."
	@node -r dotenv/config src/cli.js alphavantage

test-volatility:
	@echo "📊 Testing volatility analysis pipeline..."
	@node -r dotenv/config src/cli.js volatility

test-gemini:
	@echo "🤖 Testing Gemini AI analysis..."
	@node -r dotenv/config src/cli.js gemini

test-email:
	@echo "📧 Testing email template and delivery..."
	@node -r dotenv/config src/cli.js email

test-summary-email:
	@echo "📧 Sending test run summary email..."
	@RECIPIENTS="$(RECIPIENTS)" node -r dotenv/config src/cli.js summary-email

test-scoring:
	@echo "🎯 Testing opportunity scoring algorithm..."
	@node -r dotenv/config src/cli.js scoring

# Integration testing  
test-pipeline:
	@echo "🔄 Testing complete data pipeline..."
	@node -r dotenv/config src/cli.js pipeline

test-full-run:
	@echo "🎯 Simulating complete daily run..."
	@node -r dotenv/config src/cli.js full-run

test-unit:
	@echo "🧪 Running unit tests (Vitest)..."
	@npx vitest run

# Preview and debugging
preview-email:
	@echo "👀 Previewing email template..."
	@node -r dotenv/config src/cli.js preview-email

debug-run:
	@echo "🔍 Running with debug output..."
	@DEBUG=1 node -r dotenv/config src/cli.js full-run

# Test specific stock
test-stock:
	@echo "📊 Testing analysis for $(SYMBOL)..."
	@SYMBOL=$(SYMBOL) node -r dotenv/config src/cli.js test-stock

# Production deployment helpers
push-secrets:
	@echo "🔑 Pushing environment variables to Cloudflare..."
	@test -f .env || (echo "❌ .env file not found" && exit 1)
	@export $$(cat .env | grep -v '^#' | xargs) && \
	if [ -z "$$FINNHUB_API_KEY" ]; then echo "❌ FINNHUB_API_KEY not set in .env"; exit 1; fi && \
	# Alpha Vantage is optional; skip validation if not present
	if [ -z "$$ALPHA_VANTAGE_API_KEY" ]; then echo "ℹ️  ALPHA_VANTAGE_API_KEY not set; skipping (optional)"; fi && \
	if [ -z "$$GEMINI_API_KEY" ]; then echo "❌ GEMINI_API_KEY not set in .env"; exit 1; fi && \
	if [ -z "$$RESEND_API_KEY" ]; then echo "❌ RESEND_API_KEY not set in .env"; exit 1; fi && \
	if [ -z "$$AUDIENCE_ID" ]; then echo "❌ AUDIENCE_ID not set in .env"; exit 1; fi && \
	if [ -z "$$TRIGGER_AUTH_SECRET" ]; then echo "❌ TRIGGER_AUTH_SECRET not set in .env"; exit 1; fi && \
	echo "✅ Environment variables validated" && \
	echo "🔄 Pushing FINNHUB_API_KEY..." && \
	echo "$$FINNHUB_API_KEY" | wrangler secret put FINNHUB_API_KEY && \
	if [ -n "$$ALPHA_VANTAGE_API_KEY" ]; then \
		echo "🔄 Pushing ALPHA_VANTAGE_API_KEY..." && \
		echo "$$ALPHA_VANTAGE_API_KEY" | wrangler secret put ALPHA_VANTAGE_API_KEY; \
	else \
		echo "ℹ️  Skipping ALPHA_VANTAGE_API_KEY (optional)"; \
	fi && \
	echo "🔄 Pushing GEMINI_API_KEY..." && \
	echo "$$GEMINI_API_KEY" | wrangler secret put GEMINI_API_KEY && \
	echo "🔄 Pushing RESEND_API_KEY..." && \
	echo "$$RESEND_API_KEY" | wrangler secret put RESEND_API_KEY && \
	echo "🔄 Pushing AUDIENCE_ID..." && \
	echo "$$AUDIENCE_ID" | wrangler secret put AUDIENCE_ID && \
	echo "🔄 Pushing TRIGGER_AUTH_SECRET..." && \
	echo "$$TRIGGER_AUTH_SECRET" | wrangler secret put TRIGGER_AUTH_SECRET && \
	if [ -n "$$SUMMARY_EMAIL_RECIPIENT" ]; then \
		echo "🔄 Pushing SUMMARY_EMAIL_RECIPIENT..." && \
		echo "$$SUMMARY_EMAIL_RECIPIENT" | wrangler secret put SUMMARY_EMAIL_RECIPIENT; \
	else \
		echo "ℹ️  SUMMARY_EMAIL_RECIPIENT not set; skipping"; \
	fi && \
	if [ -n "$$SUMMARY_EMAIL_FROM" ]; then \
		echo "🔄 Pushing SUMMARY_EMAIL_FROM..." && \
		echo "$$SUMMARY_EMAIL_FROM" | wrangler secret put SUMMARY_EMAIL_FROM; \
	else \
		echo "ℹ️  SUMMARY_EMAIL_FROM not set; skipping"; \
	fi && \
	if [ -n "$$SIGNUP_ALLOWED_ORIGINS" ]; then \
		echo "🔄 Pushing SIGNUP_ALLOWED_ORIGINS..." && \
		echo "$$SIGNUP_ALLOWED_ORIGINS" | wrangler secret put SIGNUP_ALLOWED_ORIGINS; \
	else \
		echo "ℹ️  SIGNUP_ALLOWED_ORIGINS not set; using defaults"; \
	fi && \
	echo "✅ All secrets pushed successfully"

verify-deployment:
	@echo "✅ Verifying production deployment..."
	@echo "🔍 Checking health endpoint..."
	@curl -s -f https://options-insight.ravishankar-sivasubramaniam.workers.dev/health > /dev/null && echo "✅ Health check passed" || echo "❌ Health check failed"
	@echo "🔍 Checking API configuration..."
	@curl -s https://options-insight.ravishankar-sivasubramaniam.workers.dev/status | jq -r 'if .ready then "✅ All API keys configured" else "❌ Missing API keys: " + ([.environment | to_entries[] | select(.value == false) | .key] | join(", ")) end' 2>/dev/null || echo "❌ Status check failed (jq required for detailed output)"

trigger-production:
	@echo "🚀 Triggering production newsletter run..."
	@export $$(cat .env 2>/dev/null | grep -v '^#' | xargs) >/dev/null 2>&1 || true; \
	if [ -z "$$TRIGGER_AUTH_SECRET" ]; then echo "❌ TRIGGER_AUTH_SECRET not set"; exit 1; fi; \
	curl -s -X POST -H "x-trigger-secret: $$TRIGGER_AUTH_SECRET" https://options-insight.ravishankar-sivasubramaniam.workers.dev/trigger | jq '.' || echo "Manual trigger completed"

logs:
	@echo "📋 Fetching deployment logs..."
	@wrangler tail

# API key validation
validate-keys:
	@echo "🔑 Validating API keys..."
	@node -r dotenv/config src/cli.js validate-keys

# Performance testing
benchmark:
	@echo "⏱️  Running performance benchmark..."
	@time make test-full-run

# Clean and reset
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf .wrangler
	@rm -rf node_modules/.cache

install:
	@echo "📦 Installing dependencies..."
	@npm install

# Help
help:
	@echo "🔧 Available commands:"
	@echo "  dev              - Start local development server"
	@echo "  deploy           - Deploy to production"
	@echo "  deploy-pages     - Deploy the Cloudflare Pages signup site"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  test-finnhub     - Test earnings data fetching"
	@echo "  test-alphavantage - Test stock prices & volatility data"
	@echo "  test-volatility  - Test volatility analysis"
	@echo "  test-gemini      - Test AI analysis"
	@echo "  test-email       - Test email template"
	@echo "  test-pipeline    - Test complete pipeline"
	@echo "  test-full-run    - Simulate daily run"
	@echo ""
	@echo "🔍 Debugging:"
	@echo "  debug-run        - Run with debug output"
	@echo "  preview-email    - Preview email template"
	@echo "  test-stock SYMBOL=AAPL - Test specific stock"
	@echo "  validate-keys    - Check API key validity"
	@echo ""
	@echo "🚀 Production:"
	@echo "  push-secrets     - Push API keys to Cloudflare"
	@echo "  verify-deployment - Check production health"
	@echo "  trigger-production - Manually trigger newsletter"
	@echo "  logs             - View deployment logs"

.PHONY: dev deploy test-finnhub test-alphavantage test-volatility test-gemini test-email test-scoring test-pipeline test-full-run preview-email debug-run push-secrets verify-deployment trigger-production logs validate-keys benchmark clean install help
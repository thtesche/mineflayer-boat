.PHONY: help build test test-unit test-integration docker-build docker-up docker-down test-docker test-docker-1.21.4 test-docker-26.1 clean

help:
	@echo "mineflayer-boat test targets:"
	@echo ""
	@echo "Unit & Integration Tests:"
	@echo "  make test              - Run unit tests only"
	@echo "  make test-unit         - Same as 'make test'"
	@echo "  make test-integration  - Run integration tests"
	@echo "  make test-all          - Run all tests (unit + integration)"
	@echo ""
	@echo "Docker Multi-Version Testing:"
	@echo "  make docker-build      - Build Docker images for both versions"
	@echo "  make docker-up         - Start both Minecraft servers in Docker"
	@echo "  make docker-down       - Stop Docker servers"
	@echo "  make test-docker-1.21.4 - Test against Minecraft 1.21.4 in Docker"
	@echo "  make test-docker-26.1  - Test against Minecraft 26.1 in Docker"
	@echo "  make test-docker       - Test against both versions (full suite)"
	@echo ""
	@echo "Local Spike Testing:"
	@echo "  make spike-setup       - Download local vanilla 1.21.4 server"
	@echo "  make spike-server      - Start local spike server (blocking)"
	@echo "  make spike             - Run spike test against local server"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean             - Remove built artifacts & Docker containers"

build:
	npm run build

test test-unit:
	npm run test

test-integration:
	npm run test:integration

test-all:
	npm run test:all

docker-build:
	@docker compose version >/dev/null 2>&1 || { echo "❌ 'docker compose' (v2) not found. Install: https://docs.docker.com/compose/install/"; exit 1; }
	npm run docker:build

docker-up:
	@docker compose version >/dev/null 2>&1 || { echo "❌ 'docker compose' (v2) not found. Install: https://docs.docker.com/compose/install/"; exit 1; }
	npm run docker:up

docker-down:
	@docker compose version >/dev/null 2>&1 || { echo "⚠️  'docker compose' not available, skipping"; exit 0; }
	npm run docker:down

test-docker-1.21.4:
	npm run test:docker:1.21.4

test-docker-26.1:
	npm run test:docker:26.1

test-docker: test-docker-1.21.4 test-docker-26.1

spike-setup:
	npm run server:setup

spike-server:
	bash spike/server/start.sh

spike:
	npm run spike

clean:
	rm -rf dist/
	docker compose down -v
	rm -rf spike/server/run/

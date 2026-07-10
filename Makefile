.PHONY: help up down build logs seed

COMPOSE := docker compose

help:
	@echo "Atlas — available targets"
	@echo ""
	@echo "  make up      Start Atlas web + shared PocketBase backend (:4179 / :8094)"
	@echo "  make down    Stop the stack"
	@echo "  make build   (Re)build images — run after package.json changes"
	@echo "  make logs    Follow stack logs"
	@echo "  make seed    Seed the backend's TESS candidates"

up:
	$(COMPOSE) up -d --remove-orphans backend atlas
	@echo "Atlas:      http://localhost:4179"
	@echo "PocketBase: http://localhost:8094/_/"

down:
	$(COMPOSE) down --remove-orphans

build:
	$(COMPOSE) build backend atlas

logs:
	$(COMPOSE) logs -f backend atlas

seed:
	cd ../backend && go run ./cmd/seed --dir ./pb_data

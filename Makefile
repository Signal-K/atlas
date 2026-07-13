.PHONY: help up down build logs seed demo stop

COMPOSE := docker compose
DEMO_PID_FILE := .demo.pid
DEMO_LOG_FILE := .demo.log

help:
	@echo "Atlas — available targets"
	@echo ""
	@echo "  make up          Start Atlas web + shared PocketBase backend (:4179 / :8094)"
	@echo "  make down        Stop the stack"
	@echo "  make build       (Re)build images — run after package.json changes"
	@echo "  make logs        Follow stack logs"
	@echo "  make seed        Seed the backend's TESS candidates"
	@echo "  make demo        Run the frontend only (no Docker), pre-set to demo mode"
	@echo "  make demo stop   Stop the demo dev server started by 'make demo'"

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

# No Docker/PocketBase required: VITE_DEMO_MODE short-circuits every backend
# call (see src/lib/demoMode.ts) so this only ever runs against the local
# `vite dev` server, never a built/deployed bundle.
#
# `make demo stop` (or plain `make stop`) is handled via the MAKECMDGOALS
# check below rather than a real prerequisite, so `demo` can mean either
# "start" or "stop" depending on whether "stop" is also on the command line.
ifneq ($(filter stop,$(MAKECMDGOALS)),)
demo: stop
	@:

stop:
	@if [ -f $(DEMO_PID_FILE) ] && kill -0 $$(cat $(DEMO_PID_FILE)) 2>/dev/null; then \
		kill $$(cat $(DEMO_PID_FILE)); \
		rm -f $(DEMO_PID_FILE); \
		echo "Demo dev server stopped."; \
	else \
		rm -f $(DEMO_PID_FILE); \
		echo "Demo dev server is not running."; \
	fi
else
demo:
	@if [ -f $(DEMO_PID_FILE) ] && kill -0 $$(cat $(DEMO_PID_FILE)) 2>/dev/null; then \
		echo "Demo dev server already running (PID $$(cat $(DEMO_PID_FILE))). Stop it with: make demo stop"; \
	else \
		VITE_DEMO_MODE=1 nohup npm run dev > $(DEMO_LOG_FILE) 2>&1 & echo $$! > $(DEMO_PID_FILE); \
		sleep 1; \
		echo "Demo dev server starting in the background (PID $$(cat $(DEMO_PID_FILE)))."; \
		echo "Logs: tail -f $(DEMO_LOG_FILE)"; \
		echo "Stop with: make demo stop"; \
	fi

stop:
	@echo "Demo dev server is not running."
endif

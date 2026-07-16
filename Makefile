.PHONY: help up dev down build logs seed demo stop

COMPOSE := docker compose
DEMO_PID_FILE := .demo.pid
DEMO_LOG_FILE := .demo.log

help:
	@echo "Atlas — available targets"
	@echo ""
	@echo "  make up          Start Atlas (Vite dev server, hot-reloads on source edits) + PocketBase (:4179 / :8094)"
	@echo "  make dev         Same, but Vite runs on the host instead of in Docker (:5179 / :8094)"
	@echo "  make preview     Build + run the real production bundle for a final check, alongside 'up' (:4180)"
	@echo "  make down        Stop the stack (add 'preview' to also stop the preview container)"
	@echo "  make build       Rebuild the dev-stage image — run after package.json changes"
	@echo "  make logs        Follow stack logs"
	@echo "  make seed        Seed the backend's TESS candidates"
	@echo "  make demo        Run the frontend only (no Docker), pre-set to demo mode"
	@echo "  make demo stop   Stop the demo dev server started by 'make demo'"

# atlas here is the Vite *dev server* (Dockerfile's `dev` stage) with the repo
# bind-mounted in -- source edits on the host hot-reload immediately, no
# rebuild step. --build is unconditional because compose won't notice a
# changed `target:`/volumes on its own and would otherwise happily run a
# stale image built for a different stage. Ordinary source edits after this
# don't need `make up` run again at all -- Vite picks them up live.
up:
	$(COMPOSE) up -d --build --remove-orphans backend atlas
	@echo "Atlas:      http://localhost:4179 (hot reload)"
	@echo "PocketBase: http://localhost:8094/_/"

dev:
	$(COMPOSE) up -d --remove-orphans backend
	@echo "Atlas dev:  http://localhost:5179"
	@echo "PocketBase: http://localhost:8094/_/"
	VITE_PB_URL=http://localhost:8094 npm run dev -- --host 0.0.0.0 --port 5179

# The actual `npm run build` + `vite preview` production bundle, for
# confirming a real build works before shipping. Profile-gated so it never
# starts as a side effect of `make up` / plain `docker compose up`.
preview:
	$(COMPOSE) --profile preview up -d --build backend atlas-preview
	@echo "Atlas preview (production build): http://localhost:4180"

down:
	$(COMPOSE) --profile preview down --remove-orphans

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

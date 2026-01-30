.PHONY: help dev dev-build prod prod-build down logs clean

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Lance les services en mode développement (avec hot reload)
	docker-compose -f docker-compose-v2.dev.yml up

dev-build: ## Build et lance les services en mode développement
	docker-compose -f docker-compose-v2.dev.yml up --build

prod: ## Lance les services en mode production
	docker-compose -f docker-compose-v2.yml up

prod-build: ## Build et lance les services en mode production
	docker-compose -f docker-compose-v2.yml up --build

build:
	docker compose -f docker-compose-v2.yml build

push:
	docker compose -f docker-compose-v2.yml push

down: ## Arrête tous les services
	docker-compose -f docker-compose-v2.dev.yml down
	docker-compose -f docker-compose-v2.yml down

logs: ## Affiche les logs de tous les services
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml logs -f

logs-nextjs: ## Affiche les logs de NextJS
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml logs -f nextjs

logs-fastapi: ## Affiche les logs de FastAPI
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml logs -f fastapi

logs-caddy: ## Affiche les logs de Caddy
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml logs -f caddy

shell-nextjs: ## Ouvre un shell dans le conteneur NextJS
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml exec nextjs sh

shell-fastapi: ## Ouvre un shell dans le conteneur FastAPI
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml exec fastapi sh

clean: ## Nettoie les volumes et images Docker
	docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml down -v
	docker-compose -f docker-compose-v2.yml down -v

copy-exports: ## Get the exports folder from the container NextJS
	docker cp presenton-nextjs-1:/app_data/exports/ ./.exports

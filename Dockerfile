# Étape 1: Builder le frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copier les fichiers de configuration et d'installation
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copier le code source du frontend
COPY frontend/ ./

# Builder l'application frontend
RUN npm run build

# Étape 2: Builder le backend
FROM golang:1.24-alpine AS backend-builder

WORKDIR /app

# Installation des dépendances nécessaires
RUN apk add --no-cache git

# Copier les fichiers go.mod et go.sum
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copier le code source du backend
COPY backend/ ./

# Compiler l'application backend en statique pour être compatible avec Alpine
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o swarm-manager .

# Étape 3: Image finale légère
FROM alpine:latest

WORKDIR /app

# Installation des certificats CA et des dépendances minimales
RUN apk --no-cache add ca-certificates tzdata && \
    update-ca-certificates

# Copier le binaire compilé et lui donner les permissions d'exécution
COPY --from=backend-builder /app/swarm-manager /app/
RUN chmod +x /app/swarm-manager

# Copier les fichiers statiques du frontend
COPY --from=frontend-builder /app/frontend/dist/ /app/static/

# Exposer le port utilisé par l'application
EXPOSE 5000

# Définir la variable d'environnement pour le port
ENV PORT=5000

# Lancer l'application
CMD ["/app/swarm-manager"]
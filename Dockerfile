# syntax=docker/dockerfile:1
###############################################################################
# Image de production d'outerpedia (Next.js 16, sortie "standalone").
#
# Build multi-stage :
#   deps    -> installe les dépendances (cache Docker sur package*.json)
#   builder -> set-version + conversion images (sharp) + pipeline --prod + next build
#   runner  -> image finale minimale (server.js standalone, non-root)
#
# Le build N'A PAS besoin de : réseau, base de données, dossier datamine
# (les étapes du pipeline qui en dépendent se skippent gracieusement).
###############################################################################

# ---- Base commune ----
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Étape 1 : dépendances ----
FROM base AS deps
# On copie d'abord uniquement les manifestes : tant qu'ils ne changent pas,
# Docker réutilise le cache de cette couche (npm ci n'est pas rejoué).
COPY package.json package-lock.json ./
RUN npm ci

# ---- Étape 2 : build ----
FROM base AS builder
# NEXT_PUBLIC_BASE_DOMAIN est "baké" dans le bundle client AU BUILD.
# Défaut = outerpedia.com ; surchargeable via --build-arg si besoin.
ARG NEXT_PUBLIC_BASE_DOMAIN=outerpedia.com
ENV NEXT_PUBLIC_BASE_DOMAIN=${NEXT_PUBLIC_BASE_DOMAIN}
ENV NODE_ENV=production
# Marge mémoire pour next build sur gros site (évite les OOM).
ENV NODE_OPTIONS=--max-old-space-size=6144

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Lance le build complet (cf. script "build" du package.json).
RUN npm run build

# ---- Étape 3 : runner (image finale) ----
FROM base AS runner
ENV NODE_ENV=production
# Next standalone lit ces variables au démarrage.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root pour faire tourner l'app.
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Sortie standalone : contient server.js + un node_modules minimal.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Les assets statiques et le dossier public ne sont PAS inclus dans standalone :
# il faut les copier explicitement (documentation Next.js).
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Données JSON : copiées par sécurité au cas où la data access layer les lit
# au runtime (peut être retiré plus tard si le tracing standalone suffit).
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

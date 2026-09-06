FROM node:22-alpine AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend ./frontend
ARG BUILD_SHA=dev
ENV VITE_BUILD_SHA=${BUILD_SHA}
RUN npm run build

FROM rust:1-slim AS server
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime
RUN groupadd --gid 10001 kindred && useradd --uid 10001 --gid kindred --create-home kindred \
    && mkdir -p /app/dist /data && chown -R kindred:kindred /app /data
WORKDIR /app
COPY --from=server /build/target/release/kindred-coop /app/kindred-coop
COPY --from=web /build/dist /app/dist
ENV PORT=8080
ENV DIST_DIR=/app/dist
USER kindred
EXPOSE 8080
CMD ["/app/kindred-coop"]

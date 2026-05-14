# syntax=docker/dockerfile:1.6
#
# Build context is the backend/ directory (see docker-compose.yml and the
# Railway service settings: Root Directory = /backend, Dockerfile Path =
# Dockerfile). All COPY paths are relative to backend/. The image bundles
# three runtime pieces the issuer-service /prove/groth16 endpoint needs:
#   1. The three service binaries (api-gateway, issuer-service, indexer)
#   2. The Sunspot Go CLI, built from source at the same rev pinned by the
#      gnark-verifier-solana Cargo dep in programs/zksettle/Cargo.toml
#   3. The pre-built circuit artefacts (ACIR JSON, gnark CCS, Groth16 PK)
#      under backend/artefacts/. These are produced by `nargo compile` +
#      `sunspot setup` (which writes to circuits/target/) and copied into
#      backend/artefacts/ as a regen step. Regenerating them requires
#      updating DEFAULT_ACIR_SHA256 in crates/issuer-service/src/config.rs.

FROM golang:1.24-bookworm AS sunspot-builder
WORKDIR /src
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/reilabs/sunspot.git . \
 && git checkout ce4765ccdf050507874bbb544be992a11dc48ffc \
 && cd go && go build -o /out/sunspot .

FROM rust:1.82-slim AS builder
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends clang libclang-dev libssl-dev pkg-config \
 && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY programs/ programs/
COPY crates/ crates/
RUN cargo build --release --locked -p api-gateway -p issuer-service -p indexer

FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -s /usr/sbin/nologin appuser
COPY --from=builder /app/target/release/api-gateway /usr/local/bin/
COPY --from=builder /app/target/release/issuer-service /usr/local/bin/
COPY --from=builder /app/target/release/indexer /usr/local/bin/
COPY --from=sunspot-builder /out/sunspot /usr/local/bin/sunspot
COPY --chown=appuser:appuser artefacts/zksettle_slice.json /artefacts/zksettle_slice.json
COPY --chown=appuser:appuser artefacts/zksettle_slice.ccs  /artefacts/zksettle_slice.ccs
COPY --chown=appuser:appuser artefacts/zksettle_slice.pk   /artefacts/zksettle_slice.pk
USER appuser
CMD ["sh", "-c", "exec ${SERVICE:-api-gateway}"]

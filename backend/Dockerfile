FROM rust:1.82-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends clang libclang-dev libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim AS api-gateway
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /usr/sbin/nologin appuser
COPY --from=builder /app/target/release/api-gateway /usr/local/bin/
USER appuser
CMD ["api-gateway"]

FROM debian:bookworm-slim AS issuer-service
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /usr/sbin/nologin appuser
COPY --from=builder /app/target/release/issuer-service /usr/local/bin/
USER appuser
CMD ["issuer-service"]

FROM debian:bookworm-slim AS indexer
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /usr/sbin/nologin appuser
COPY --from=builder /app/target/release/indexer /usr/local/bin/
USER appuser
CMD ["indexer"]

//! POST /prove/groth16 — server-side Sunspot Groth16 prover.
//!
//! Request body: raw octet-stream containing the gzipped Noir witness emitted
//! by `noir.execute(...)` in the browser. The handler writes that to a temp
//! file, shells out to the pinned `sunspot prove ...` CLI, and returns the
//! concatenated `proof || public-witness` bundle that the on-chain Gnark
//! verifier expects. `X-Proof-Len` / `X-Witness-Len` headers let the caller
//! slice the body without re-parsing.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Bytes;
use axum::extract::Extension;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::json;
use sha2::{Digest, Sha256};
use tempfile::TempDir;
use tokio::process::Command;
use tokio::sync::Semaphore;
use tracing::Instrument;

use crate::auth::{parse_replay_timestamp, verify_wallet_signature, AllowUnauthenticated};

/// 12-byte gnark witness header + 11 × 32-byte BE field elements = 364 bytes.
/// Must stay in sync with `expected_witness_len` on-chain.
pub const EXPECTED_WITNESS_LEN: usize = 12 + 11 * 32;

const MAX_BODY_BYTES: usize = 1024 * 1024; // 1 MiB — Noir witness < 50 kB in practice
const SEMAPHORE_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(2);
const STDERR_EXCERPT_CHARS: usize = 512;

#[derive(Clone)]
pub struct ProverPaths {
    pub bin: PathBuf,
    pub acir: PathBuf,
    pub ccs: PathBuf,
    pub pk: PathBuf,
    pub timeout: Duration,
}

#[derive(Clone)]
pub struct ProverPermits(pub Arc<Semaphore>);

#[derive(Debug)]
pub enum ProveError {
    InvalidWitness(String),
    Unauthorized(String),
    ProverBusy,
    ProverTimeout,
    ProverFailed(String),
}

impl IntoResponse for ProveError {
    fn into_response(self) -> Response {
        let (status, code, msg) = match self {
            ProveError::InvalidWitness(m) => (StatusCode::BAD_REQUEST, "invalid_witness", m),
            ProveError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, "unauthorized", m),
            ProveError::ProverBusy => (
                StatusCode::SERVICE_UNAVAILABLE,
                "prover_busy",
                "prover saturated".to_string(),
            ),
            ProveError::ProverTimeout => (
                StatusCode::GATEWAY_TIMEOUT,
                "prover_timeout",
                "prover exceeded deadline".to_string(),
            ),
            ProveError::ProverFailed(m) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "prover_failed",
                m,
            ),
        };
        let body = axum::Json(json!({ "error": code, "message": msg }));
        (status, body).into_response()
    }
}

pub async fn handler(
    Extension(paths): Extension<ProverPaths>,
    Extension(permits): Extension<ProverPermits>,
    Extension(AllowUnauthenticated(allow_unauth)): Extension<AllowUnauthenticated>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, ProveError> {
    if body.is_empty() {
        return Err(ProveError::InvalidWitness("empty body".into()));
    }
    if body.len() > MAX_BODY_BYTES {
        return Err(ProveError::InvalidWitness(format!(
            "witness too large: {} bytes (max {MAX_BODY_BYTES})",
            body.len()
        )));
    }

    // Hash the body BEFORE signature check so the signed message binds the
    // exact witness the prover will consume — captured headers cannot be
    // replayed against a different witness even within the 5-min replay
    // window. Frontend mirrors this in `apiFetchBinary` (`client.ts`).
    let wallet_hex = verify_wallet_headers(&headers, &body, allow_unauth)?;

    let permit = match tokio::time::timeout(
        SEMAPHORE_ACQUIRE_TIMEOUT,
        permits.0.clone().acquire_owned(),
    )
    .await
    {
        Ok(Ok(p)) => p,
        Ok(Err(_closed)) => {
            return Err(ProveError::ProverFailed("semaphore closed".into()));
        }
        Err(_elapsed) => return Err(ProveError::ProverBusy),
    };

    // Sunspot writes `<ccs_stem>.proof` / `<ccs_stem>.pw` into the CCS's
    // *parent directory* — not the witness's, not the ACIR's. Symlinks are
    // dereferenced. To get isolated, concurrency-safe output paths we stage
    // both ACIR (~76 kB) and CCS (~1.9 MB) into the per-request tempdir
    // under a fresh stem; outputs land alongside, and the whole dir is wiped
    // on Drop. PK (~7 MB, read-only) stays at its real path — we never read
    // proof/pw from there. Concurrent calls each get their own dir, so the
    // fixed output filename never clashes even with the semaphore widened.
    let bundle = tokio::task::spawn_blocking({
        let body = body.clone();
        let acir_real = paths.acir.clone();
        let ccs_real = paths.ccs.clone();
        move || -> std::io::Result<(
            TempDir,
            std::path::PathBuf,
            std::path::PathBuf,
            std::path::PathBuf,
            std::path::PathBuf,
            std::path::PathBuf,
        )> {
            let tmp = TempDir::new()?;
            let acir_copy = tmp.path().join("wit.json");
            let ccs_copy = tmp.path().join("wit.ccs");
            std::fs::copy(&acir_real, &acir_copy)?;
            std::fs::copy(&ccs_real, &ccs_copy)?;
            let witness = tmp.path().join("wit.gz");
            std::fs::write(&witness, &body)?;
            let proof_out = tmp.path().join("wit.proof");
            let pw_out = tmp.path().join("wit.pw");
            Ok((tmp, acir_copy, ccs_copy, witness, proof_out, pw_out))
        }
    });
    let (tmp, acir_path, ccs_path, witness_path, proof_out, pw_out) = bundle
        .await
        .map_err(|e| ProveError::ProverFailed(format!("temp setup join: {e}")))?
        .map_err(|e| ProveError::ProverFailed(format!("temp setup: {e}")))?;

    let span = tracing::info_span!(
        "groth16_prove",
        witness_bytes = body.len(),
        wallet = %wallet_hex,
    );

    // Wrap the prover-invocation block in `.instrument(span)` so the span
    // context follows the future across thread switches at every `.await`.
    // Holding `span.enter()`'s sync guard across an `.await` would attach the
    // span to whatever task happened to run on this thread next.
    let (proof, pw) = async {
        tracing::debug!("sunspot prove starting");

        let mut cmd = Command::new(&paths.bin);
        cmd.kill_on_drop(true)
            .arg("prove")
            .arg(&acir_path)
            .arg(&witness_path)
            .arg(&ccs_path)
            .arg(&paths.pk);

        let result = tokio::time::timeout(paths.timeout, cmd.output()).await;
        drop(permit);

        let output = match result {
            Ok(Ok(o)) => o,
            Ok(Err(e)) => {
                return Err(ProveError::ProverFailed(format!("spawn: {e}")));
            }
            Err(_) => return Err(ProveError::ProverTimeout),
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let excerpt: String = stderr.chars().take(STDERR_EXCERPT_CHARS).collect();
            tracing::warn!(exit = ?output.status.code(), stderr = %excerpt, "sunspot prove failed");
            return Err(ProveError::ProverFailed(format!(
                "sunspot exit {:?}: {excerpt}",
                output.status.code()
            )));
        }

        let proof = tokio::fs::read(&proof_out)
            .await
            .map_err(|e| ProveError::ProverFailed(format!("read proof: {e}")))?;
        let pw = tokio::fs::read(&pw_out)
            .await
            .map_err(|e| ProveError::ProverFailed(format!("read pw: {e}")))?;
        Ok((proof, pw))
    }
    .instrument(span.clone())
    .await?;
    drop(tmp);

    if pw.len() != EXPECTED_WITNESS_LEN {
        return Err(ProveError::ProverFailed(format!(
            "public witness length {} (expected {EXPECTED_WITNESS_LEN})",
            pw.len()
        )));
    }

    let mut bundle_bytes = Vec::with_capacity(proof.len() + pw.len());
    bundle_bytes.extend_from_slice(&proof);
    bundle_bytes.extend_from_slice(&pw);

    let _enter = span.enter();
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );
    resp_headers.insert(
        "x-proof-len",
        HeaderValue::from_str(&proof.len().to_string()).unwrap(),
    );
    resp_headers.insert(
        "x-witness-len",
        HeaderValue::from_str(&pw.len().to_string()).unwrap(),
    );

    tracing::info!(proof_bytes = proof.len(), witness_bytes = pw.len(), "groth16 proof generated");
    Ok((resp_headers, bundle_bytes).into_response())
}

fn header_str<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

fn body_hash_hex(body: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(body);
    hex::encode(hasher.finalize())
}

fn verify_wallet_headers(
    headers: &HeaderMap,
    body: &[u8],
    allow_unauth: bool,
) -> Result<String, ProveError> {
    let wallet_hex_raw = header_str(headers, "x-wallet-pubkey")
        .ok_or_else(|| ProveError::Unauthorized("missing X-Wallet-Pubkey header".into()))?;
    let wallet_hex = wallet_hex_raw.to_ascii_lowercase();
    let stripped = wallet_hex.strip_prefix("0x").unwrap_or(&wallet_hex);
    let wallet_bytes: [u8; 32] = hex::decode(stripped)
        .map_err(|e| ProveError::Unauthorized(format!("invalid wallet hex: {e}")))
        .and_then(|b| {
            b.try_into()
                .map_err(|_| ProveError::Unauthorized("wallet must be 32 bytes".into()))
        })?;

    if allow_unauth {
        return Ok(wallet_hex);
    }

    let sig_header = header_str(headers, "x-wallet-signature")
        .ok_or_else(|| ProveError::Unauthorized("missing X-Wallet-Signature header".into()))?;
    let ts_header = header_str(headers, "x-wallet-timestamp")
        .ok_or_else(|| ProveError::Unauthorized("missing X-Wallet-Timestamp header".into()))?;

    let timestamp = parse_replay_timestamp(ts_header)
        .map_err(|e| ProveError::Unauthorized(e.into()))?;

    // Bind the witness body to the signed message: `sha256(body)` is hex-encoded
    // and folded into the message after `timestamp`. Without this, captured
    // wallet-auth headers could be replayed against a different witness within
    // the 5-min `REPLAY_WINDOW_SECS`.
    let body_hash = body_hash_hex(body);
    let message = format!("zksettle:{wallet_hex}:{timestamp}:{body_hash}");
    verify_wallet_signature(&wallet_bytes, sig_header, message.as_bytes())
        .map_err(|e| ProveError::Unauthorized(e.into()))?;

    Ok(wallet_hex)
}

/// Compute hex sha256 of a file. Used at startup to enforce ACIR pinning.
pub fn sha256_file_hex(path: &std::path::Path) -> std::io::Result<String> {
    use std::io::Read;
    let mut f = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_sdk::signature::Keypair;
    use solana_sdk::signer::Signer;

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    const TEST_BODY: &[u8] = b"witness-bytes-placeholder";

    fn signed_headers(kp: &Keypair) -> HeaderMap {
        signed_headers_for(kp, TEST_BODY, now_secs())
    }

    fn signed_headers_for(kp: &Keypair, body: &[u8], ts: u64) -> HeaderMap {
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));
        let body_hash = body_hash_hex(body);
        let message = format!("zksettle:{wallet_hex}:{ts}:{body_hash}");
        let sig = kp.sign_message(message.as_bytes()).to_string();
        let mut h = HeaderMap::new();
        h.insert("x-wallet-pubkey", wallet_hex.parse().unwrap());
        h.insert("x-wallet-signature", sig.parse().unwrap());
        h.insert("x-wallet-timestamp", ts.to_string().parse().unwrap());
        h
    }

    #[test]
    fn wallet_headers_happy_path() {
        let kp = Keypair::new();
        let h = signed_headers(&kp);
        let hex = verify_wallet_headers(&h, TEST_BODY, false).expect("should pass");
        assert!(hex.starts_with("0x"));
    }

    #[test]
    fn wallet_headers_reject_different_body() {
        // Same headers + DIFFERENT body must fail — this is the replay
        // protection that pt-1 of the security review flagged.
        let kp = Keypair::new();
        let h = signed_headers_for(&kp, TEST_BODY, now_secs());
        let e = verify_wallet_headers(&h, b"other-witness", false).unwrap_err();
        assert!(matches!(e, ProveError::Unauthorized(_)));
    }

    #[test]
    fn wallet_headers_missing_pubkey_returns_401() {
        let h = HeaderMap::new();
        let e = verify_wallet_headers(&h, TEST_BODY, false).unwrap_err();
        assert!(matches!(e, ProveError::Unauthorized(_)));
    }

    #[test]
    fn wallet_headers_expired_returns_401() {
        let kp = Keypair::new();
        let h = signed_headers_for(
            &kp,
            TEST_BODY,
            now_secs() - crate::auth::REPLAY_WINDOW_SECS - 10,
        );
        let e = verify_wallet_headers(&h, TEST_BODY, false).unwrap_err();
        assert!(matches!(e, ProveError::Unauthorized(_)));
    }

    #[test]
    fn wallet_headers_wrong_key_returns_401() {
        let kp = Keypair::new();
        let other = Keypair::new();
        let wallet_hex = format!("0x{}", hex::encode(kp.pubkey().to_bytes()));
        let ts = now_secs();
        let body_hash = body_hash_hex(TEST_BODY);
        let message = format!("zksettle:{wallet_hex}:{ts}:{body_hash}");
        let sig = other.sign_message(message.as_bytes()).to_string();
        let mut h = HeaderMap::new();
        h.insert("x-wallet-pubkey", wallet_hex.parse().unwrap());
        h.insert("x-wallet-signature", sig.parse().unwrap());
        h.insert("x-wallet-timestamp", ts.to_string().parse().unwrap());
        let e = verify_wallet_headers(&h, TEST_BODY, false).unwrap_err();
        assert!(matches!(e, ProveError::Unauthorized(_)));
    }

    #[test]
    fn allow_unauth_skips_signature_check() {
        let mut h = HeaderMap::new();
        h.insert("x-wallet-pubkey", format!("0x{}", hex::encode([7u8; 32])).parse().unwrap());
        // no sig/ts — but allow_unauth bypasses (body content irrelevant here)
        let hex = verify_wallet_headers(&h, b"", true).expect("bypass");
        assert_eq!(hex, format!("0x{}", hex::encode([7u8; 32])));
    }

    #[test]
    fn sha256_hex_known_file() {
        let mut tf = tempfile::NamedTempFile::new().unwrap();
        use std::io::Write;
        tf.write_all(b"hello").unwrap();
        tf.flush().unwrap();
        let got = sha256_file_hex(tf.path()).unwrap();
        // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        assert_eq!(got, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    }

    // ===================================================================
    // Router-level tests. Use tower oneshot to drive the handler in-process
    // — no live HTTP server. Heavy round-trip is gated behind SUNSPOT_E2E=1.
    // ===================================================================

    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::post;
    use axum::{Extension, Router};
    use http_body_util::BodyExt;
    use std::path::PathBuf;
    use std::sync::Arc as StdArc;
    use std::time::Duration;
    use tokio::sync::Semaphore;
    use tower::ServiceExt;

    fn dummy_paths() -> ProverPaths {
        ProverPaths {
            bin: PathBuf::from("/nonexistent"),
            acir: PathBuf::from("/nonexistent"),
            ccs: PathBuf::from("/nonexistent"),
            pk: PathBuf::from("/nonexistent"),
            timeout: Duration::from_secs(1),
        }
    }

    fn build_app(paths: ProverPaths, allow_unauth: bool) -> Router {
        Router::new()
            .route("/prove/groth16", post(handler))
            .layer(Extension(paths))
            .layer(Extension(ProverPermits(StdArc::new(Semaphore::new(1)))))
            .layer(Extension(AllowUnauthenticated(allow_unauth)))
    }

    #[tokio::test]
    async fn empty_body_returns_400_without_invoking_prover() {
        // dummy paths would explode if reached — confirms framing fails fast.
        let app = build_app(dummy_paths(), true);
        let wallet = format!("0x{}", hex::encode([3u8; 32]));
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/prove/groth16")
                    .header("x-wallet-pubkey", wallet)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn missing_wallet_signature_returns_401_when_auth_required() {
        let app = build_app(dummy_paths(), false);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/prove/groth16")
                    .body(Body::from(vec![0u8; 64]))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    fn env_path(key: &str) -> Option<PathBuf> {
        std::env::var(key).ok().filter(|s| !s.is_empty()).map(PathBuf::from)
    }

    fn maybe_e2e_paths() -> Option<(ProverPaths, PathBuf, PathBuf)> {
        if std::env::var("SUNSPOT_E2E").ok().as_deref() != Some("1") {
            return None;
        }
        let bin = env_path("SUNSPOT_BIN")?;
        let acir = env_path("SUNSPOT_ACIR_PATH")?;
        let ccs = env_path("SUNSPOT_CCS_PATH")?;
        let pk = env_path("SUNSPOT_PK_PATH")?;
        let vk = env_path("SUNSPOT_VK_PATH")?;
        let witness = env_path("SUNSPOT_WITNESS_PATH")?;
        for (label, p) in [
            ("bin", &bin),
            ("acir", &acir),
            ("ccs", &ccs),
            ("pk", &pk),
            ("vk", &vk),
            ("witness", &witness),
        ] {
            if !p.exists() {
                eprintln!("{label} path {} not found — skipping e2e", p.display());
                return None;
            }
        }
        Some((
            ProverPaths {
                bin,
                acir,
                ccs,
                pk,
                timeout: Duration::from_secs(180),
            },
            vk,
            witness,
        ))
    }

    /// Real prove → verify round-trip. Confirms the bundle format the route
    /// emits parses through the same gnark deserialiser the on-chain program
    /// uses (via the `sunspot verify` CLI which links the same verifier-lib).
    ///
    /// Heavy: invokes the real `sunspot prove` (PK is ~7 MiB; ~5–30 s wall).
    /// Run with:
    /// `SUNSPOT_E2E=1 SUNSPOT_BIN=... cargo test -p issuer-service -- --ignored prove_groth16_round_trips`
    #[tokio::test]
    #[ignore = "requires sunspot CLI + circuit artefacts; set SUNSPOT_E2E=1"]
    async fn prove_groth16_round_trips_through_verify() {
        let Some((paths, vk_path, witness_path)) = maybe_e2e_paths() else {
            eprintln!("SUNSPOT_E2E not set or paths missing — skipping");
            return;
        };
        let witness_body = std::fs::read(&witness_path).expect("read fixture witness");
        let wallet_hex = format!("0x{}", hex::encode([1u8; 32]));

        let app = build_app(paths, true);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/prove/groth16")
                    .header("content-type", "application/octet-stream")
                    .header("x-wallet-pubkey", &wallet_hex)
                    .body(Body::from(witness_body))
                    .unwrap(),
            )
            .await
            .expect("oneshot");

        if resp.status() != StatusCode::OK {
            let status = resp.status();
            let body = resp.into_body().collect().await.unwrap().to_bytes();
            panic!(
                "handler must return 200 — got {status}\nbody: {}",
                String::from_utf8_lossy(&body),
            );
        }
        let proof_len: usize = resp
            .headers()
            .get("x-proof-len")
            .expect("X-Proof-Len header")
            .to_str()
            .unwrap()
            .parse()
            .unwrap();
        let witness_len: usize = resp
            .headers()
            .get("x-witness-len")
            .expect("X-Witness-Len header")
            .to_str()
            .unwrap()
            .parse()
            .unwrap();
        assert_eq!(witness_len, EXPECTED_WITNESS_LEN);

        let body = resp.into_body().collect().await.unwrap().to_bytes();
        assert_eq!(body.len(), proof_len + witness_len);
        let (proof, pw) = body.split_at(proof_len);

        let tmp = tempfile::TempDir::new().unwrap();
        let proof_file = tmp.path().join("out.proof");
        let pw_file = tmp.path().join("out.pw");
        std::fs::write(&proof_file, proof).unwrap();
        std::fs::write(&pw_file, pw).unwrap();

        let sunspot_bin = env_path("SUNSPOT_BIN").unwrap();
        let output = std::process::Command::new(&sunspot_bin)
            .arg("verify")
            .arg(&vk_path)
            .arg(&proof_file)
            .arg(&pw_file)
            .output()
            .expect("spawn sunspot verify");
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(
            output.status.success(),
            "sunspot verify failed (exit={:?})\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}",
            output.status.code(),
        );
    }
}

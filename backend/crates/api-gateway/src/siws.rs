use ed25519_dalek::{Signature, VerifyingKey};

use crate::error::GatewayError;

#[derive(Debug)]
pub struct SiwsMessage {
    pub domain: String,
    pub address: String,
    pub statement: Option<String>,
    pub uri: Option<String>,
    pub version: Option<String>,
    pub chain_id: Option<String>,
    pub nonce: String,
    pub issued_at: String,
    pub expiration_time: Option<String>,
}

pub fn parse_message(message: &str) -> Result<SiwsMessage, GatewayError> {
    let lines: Vec<&str> = message.lines().collect();
    if lines.len() < 2 {
        return Err(GatewayError::InvalidMessage);
    }

    let domain = lines[0]
        .strip_suffix(" wants you to sign in with your Solana account:")
        .ok_or(GatewayError::InvalidMessage)?
        .to_owned();

    let address = lines[1].trim().to_owned();
    if address.is_empty() {
        return Err(GatewayError::InvalidMessage);
    }

    let (statement, field_start) = parse_statement(&lines);
    let fields = parse_fields(&lines[field_start..]);

    let nonce = fields.nonce.ok_or(GatewayError::InvalidMessage)?;
    let issued_at = fields.issued_at.ok_or(GatewayError::InvalidMessage)?;

    Ok(SiwsMessage {
        domain,
        address,
        statement,
        uri: fields.uri,
        version: fields.version,
        chain_id: fields.chain_id,
        nonce,
        issued_at,
        expiration_time: fields.expiration_time,
    })
}

struct ParsedFields {
    uri: Option<String>,
    version: Option<String>,
    chain_id: Option<String>,
    nonce: Option<String>,
    issued_at: Option<String>,
    expiration_time: Option<String>,
}

fn parse_statement(lines: &[&str]) -> (Option<String>, usize) {
    if lines.len() <= 2 || !lines[2].is_empty() {
        return (None, 2);
    }

    let mut stmt_lines = Vec::new();
    let mut i = 3;
    while i < lines.len() && !lines[i].is_empty() && !lines[i].contains(": ") {
        stmt_lines.push(lines[i]);
        i += 1;
    }

    if stmt_lines.is_empty() {
        return (None, 3);
    }

    let mut field_start = i;
    if field_start < lines.len() && lines[field_start].is_empty() {
        field_start += 1;
    }
    (Some(stmt_lines.join("\n")), field_start)
}

fn parse_fields(lines: &[&str]) -> ParsedFields {
    let mut fields = ParsedFields {
        uri: None,
        version: None,
        chain_id: None,
        nonce: None,
        issued_at: None,
        expiration_time: None,
    };

    for line in lines {
        let (key, val) = match line.split_once(": ") {
            Some(pair) => pair,
            None => continue,
        };
        match key {
            "URI" => fields.uri = Some(val.to_owned()),
            "Version" => fields.version = Some(val.to_owned()),
            "Chain ID" => fields.chain_id = Some(val.to_owned()),
            "Nonce" => fields.nonce = Some(val.to_owned()),
            "Issued At" => fields.issued_at = Some(val.to_owned()),
            "Expiration Time" => fields.expiration_time = Some(val.to_owned()),
            _ => {}
        }
    }

    fields
}

pub fn verify_signature(
    address: &str,
    message: &[u8],
    signature: &[u8],
) -> Result<(), GatewayError> {
    let pubkey_bytes: [u8; 32] = bs58::decode(address)
        .into_vec()
        .map_err(|_| GatewayError::InvalidWallet)?
        .try_into()
        .map_err(|_| GatewayError::InvalidWallet)?;

    let verifying_key =
        VerifyingKey::from_bytes(&pubkey_bytes).map_err(|_| GatewayError::InvalidWallet)?;

    let sig =
        Signature::from_slice(signature).map_err(|_| GatewayError::InvalidSignature)?;

    verifying_key
        .verify_strict(message, &sig)
        .map_err(|_| GatewayError::InvalidSignature)
}

pub fn validate_message(
    msg: &SiwsMessage,
    now: u64,
    expected_domain: Option<&str>,
) -> Result<(), GatewayError> {
    if let Some(domain) = expected_domain {
        if msg.domain != domain {
            return Err(GatewayError::InvalidMessage);
        }
    }

    // Nonce: at least 8 alphanumeric chars
    if msg.nonce.len() < 8 || !msg.nonce.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(GatewayError::InvalidMessage);
    }

    let issued_ts = parse_iso8601(&msg.issued_at).ok_or(GatewayError::InvalidMessage)?;
    if now.abs_diff(issued_ts) > 300 {
        return Err(GatewayError::MessageExpired);
    }

    if let Some(ref exp) = msg.expiration_time {
        let exp_ts = parse_iso8601(exp).ok_or(GatewayError::InvalidMessage)?;
        if now > exp_ts {
            return Err(GatewayError::MessageExpired);
        }
    }

    Ok(())
}

fn parse_iso8601(s: &str) -> Option<u64> {
    let s = s.trim();

    let (datetime_str, offset_secs) = if let Some(rest) = s.strip_suffix('Z') {
        (rest, 0i64)
    } else if let Some(idx) = s.rfind('+').or_else(|| {
        let t_pos = s.find('T')?;
        s[t_pos..].rfind('-').map(|i| i + t_pos)
    }) {
        let offset_str = &s[idx..];
        let sign: i64 = if offset_str.starts_with('-') { -1 } else { 1 };
        let hm = &offset_str[1..];
        let (oh, om) = hm.split_once(':')?;
        let offset = sign * (oh.parse::<i64>().ok()? * 3600 + om.parse::<i64>().ok()? * 60);
        (&s[..idx], offset)
    } else {
        return None;
    };

    let (date_part, time_part) = datetime_str.split_once('T')?;
    let mut date_iter = date_part.split('-');
    let year: u64 = date_iter.next()?.parse().ok()?;
    let month: u64 = date_iter.next()?.parse().ok()?;
    let day: u64 = date_iter.next()?.parse().ok()?;

    let time_part = time_part.split('.').next()?;
    let mut time_iter = time_part.split(':');
    let hour: u64 = time_iter.next()?.parse().ok()?;
    let minute: u64 = time_iter.next()?.parse().ok()?;
    let second: u64 = time_iter.next()?.parse().ok()?;

    if !(1..=12).contains(&month) || day == 0 || hour > 23 || minute > 59 || second > 59 {
        return None;
    }

    let is_leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max_day = match month {
        2 => if is_leap { 29 } else { 28 },
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if day > max_day {
        return None;
    }

    let y = if month <= 2 { year - 1 } else { year };
    let m = if month <= 2 { month + 9 } else { month - 3 };
    let days = 365 * y + y / 4 - y / 100 + y / 400 + (m * 306 + 5) / 10 + day - 719469;

    let utc_secs = (days * 86400 + hour * 3600 + minute * 60 + second) as i64 - offset_secs;
    u64::try_from(utc_secs).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_MESSAGE: &str = "\
localhost wants you to sign in with your Solana account:
4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

Sign in to the dashboard

URI: http://localhost:3000
Version: 1
Chain ID: mainnet
Nonce: abcd1234efgh
Issued At: 2026-05-02T12:00:00Z
Expiration Time: 2026-05-02T13:00:00Z";

    #[test]
    fn parse_valid_message() {
        let msg = parse_message(SAMPLE_MESSAGE).unwrap();
        assert_eq!(msg.domain, "localhost");
        assert_eq!(msg.address, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
        assert_eq!(msg.statement.as_deref(), Some("Sign in to the dashboard"));
        assert_eq!(msg.uri.as_deref(), Some("http://localhost:3000"));
        assert_eq!(msg.version.as_deref(), Some("1"));
        assert_eq!(msg.chain_id.as_deref(), Some("mainnet"));
        assert_eq!(msg.nonce, "abcd1234efgh");
        assert_eq!(msg.issued_at, "2026-05-02T12:00:00Z");
        assert_eq!(msg.expiration_time.as_deref(), Some("2026-05-02T13:00:00Z"));
    }

    #[test]
    fn parse_minimal_message() {
        let msg_text = "\
example.com wants you to sign in with your Solana account:
4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

Nonce: abcdefgh
Issued At: 2026-05-02T12:00:00Z";
        let msg = parse_message(msg_text).unwrap();
        assert_eq!(msg.domain, "example.com");
        assert!(msg.statement.is_none());
        assert!(msg.expiration_time.is_none());
    }

    #[test]
    fn parse_rejects_empty() {
        assert!(parse_message("").is_err());
    }

    #[test]
    fn parse_rejects_bad_header() {
        assert!(parse_message("not a valid header\naddress").is_err());
    }

    #[test]
    fn validate_rejects_short_nonce() {
        let mut msg = parse_message(SAMPLE_MESSAGE).unwrap();
        msg.nonce = "abc".into();
        assert!(validate_message(&msg, 1777723200, None).is_err());
    }

    #[test]
    fn validate_rejects_non_alphanumeric_nonce() {
        let mut msg = parse_message(SAMPLE_MESSAGE).unwrap();
        msg.nonce = "abcd!@#$efgh".into();
        assert!(validate_message(&msg, 1777723200, None).is_err());
    }

    #[test]
    fn validate_rejects_wrong_domain() {
        let msg = parse_message(SAMPLE_MESSAGE).unwrap();
        assert!(validate_message(&msg, 1777723200, Some("other.com")).is_err());
    }

    #[test]
    fn validate_accepts_correct_domain() {
        let msg = parse_message(SAMPLE_MESSAGE).unwrap();
        assert!(validate_message(&msg, 1777723200, Some("localhost")).is_ok());
    }

    #[test]
    fn validate_rejects_stale_issued_at() {
        let msg = parse_message(SAMPLE_MESSAGE).unwrap();
        // 1777723200 is 2026-05-02T12:00:00Z, +600 exceeds ±5min
        assert!(validate_message(&msg, 1777723200 + 600, None).is_err());
    }

    #[test]
    fn validate_accepts_within_drift() {
        let msg = parse_message(SAMPLE_MESSAGE).unwrap();
        assert!(validate_message(&msg, 1777723200 + 200, None).is_ok());
    }

    #[test]
    fn validate_rejects_expired() {
        let msg = parse_message(SAMPLE_MESSAGE).unwrap();
        // Expiration is 2026-05-02T13:00:00Z = 1777726800
        assert!(validate_message(&msg, 1777726801, None).is_err());
    }

    #[test]
    fn parse_iso8601_basic() {
        assert_eq!(parse_iso8601("2026-05-02T12:00:00Z"), Some(1777723200));
    }

    #[test]
    fn parse_iso8601_with_fractional() {
        assert_eq!(parse_iso8601("2026-05-02T12:00:00.000Z"), Some(1777723200));
    }

    #[test]
    fn parse_iso8601_with_offset() {
        assert_eq!(parse_iso8601("2026-05-02T12:00:00+00:00"), Some(1777723200));
    }

    #[test]
    fn parse_iso8601_positive_offset() {
        // +05:30 → subtract 5h30m from local to get UTC
        assert_eq!(parse_iso8601("2026-05-02T17:30:00+05:30"), Some(1777723200));
    }

    #[test]
    fn parse_iso8601_negative_offset() {
        // -04:00 → add 4h to local to get UTC
        assert_eq!(parse_iso8601("2026-05-02T08:00:00-04:00"), Some(1777723200));
    }

    #[test]
    fn parse_iso8601_rejects_feb_31() {
        assert_eq!(parse_iso8601("2026-02-31T12:00:00Z"), None);
    }

    #[test]
    fn parse_iso8601_rejects_apr_31() {
        assert_eq!(parse_iso8601("2026-04-31T12:00:00Z"), None);
    }

    #[test]
    fn parse_iso8601_accepts_feb_28_non_leap() {
        assert!(parse_iso8601("2026-02-28T12:00:00Z").is_some());
    }

    #[test]
    fn parse_iso8601_rejects_feb_29_non_leap() {
        assert_eq!(parse_iso8601("2026-02-29T12:00:00Z"), None);
    }

    #[test]
    fn parse_iso8601_accepts_feb_29_leap_year() {
        assert!(parse_iso8601("2024-02-29T12:00:00Z").is_some());
    }

    #[test]
    fn verify_signature_rejects_bad_address() {
        assert!(verify_signature("not-base58!", b"msg", &[0u8; 64]).is_err());
    }

    #[test]
    fn verify_signature_rejects_wrong_length_address() {
        let short = bs58::encode(&[0u8; 16]).into_string();
        assert!(verify_signature(&short, b"msg", &[0u8; 64]).is_err());
    }

    #[test]
    fn verify_signature_rejects_bad_signature_length() {
        let addr = bs58::encode(&[1u8; 32]).into_string();
        assert!(verify_signature(&addr, b"msg", &[0u8; 32]).is_err());
    }

    #[test]
    fn verify_signature_end_to_end() {
        use ed25519_dalek::{Signer, SigningKey};
        let signing_key = SigningKey::from_bytes(&[42u8; 32]);
        let verifying_key = signing_key.verifying_key();
        let address = bs58::encode(verifying_key.as_bytes()).into_string();
        let message = b"test message to sign";
        let sig = signing_key.sign(message);
        assert!(verify_signature(&address, message, &sig.to_bytes()).is_ok());
    }

    #[test]
    fn verify_signature_rejects_wrong_message() {
        use ed25519_dalek::{Signer, SigningKey};
        let signing_key = SigningKey::from_bytes(&[42u8; 32]);
        let verifying_key = signing_key.verifying_key();
        let address = bs58::encode(verifying_key.as_bytes()).into_string();
        let sig = signing_key.sign(b"original");
        assert!(verify_signature(&address, b"tampered", &sig.to_bytes()).is_err());
    }
}

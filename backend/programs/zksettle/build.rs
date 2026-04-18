use gnark_verifier_solana::vk::generate_key_file;
use std::{env, path::Path};

fn main() {
    println!("cargo:rerun-if-env-changed=VK_PATH");

    let vk_path = env::var("VK_PATH").unwrap_or_else(|_| "default.vk".to_string());

    if Path::new(&vk_path).exists() {
        println!("cargo:rerun-if-changed={}", vk_path);
    }

    if let Err(e) = generate_key_file(&vk_path, "src/generated_vk.rs") {
        panic!("Failed to generate VK file '{}': {e}", vk_path);
    }
}

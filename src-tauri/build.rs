fn main() {
    // Expose the Cargo TARGET triple as a compile-time env var so lib.rs can
    // resolve the correct Kubo binary name (e.g. ipfs-x86_64-unknown-linux-gnu).
    let target = std::env::var("TARGET").unwrap_or_else(|_| "x86_64-unknown-linux-gnu".to_string());
    println!("cargo:rustc-env=TARGET_TRIPLE={}", target);
    tauri_build::build()
}

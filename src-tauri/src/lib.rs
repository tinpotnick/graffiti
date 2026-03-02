use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

// Embedded at compile time by build.rs — e.g. "x86_64-unknown-linux-gnu"
const TARGET_TRIPLE: &str = env!("TARGET_TRIPLE");

// ── Tauri managed state ───────────────────────────────────────────────────────

pub struct IpfsState {
    daemon: Mutex<Option<Child>>,
}

// ── Path helpers ──────────────────────────────────────────────────────────────

/// Path to the bundled Kubo binary.
/// Dev: <project>/src-tauri/binaries/ipfs-<triple>
/// Prod: <resource_dir>/ipfs-<triple>
///
/// In dev mode the binary is compiled inside Docker, so CARGO_MANIFEST_DIR is
/// baked in as the Docker-internal path (/app/src-tauri).  When the binary runs
/// on the host that path does not exist.  We therefore prefer the
/// GRAFFITI_PROJECT_ROOT env var (set by tauri-dev.sh), falling back to the
/// compile-time path (which works when running directly inside Docker).
fn ipfs_binary(app: &AppHandle) -> PathBuf {
    let name = format!("ipfs-{}", TARGET_TRIPLE);
    if cfg!(debug_assertions) {
        let project_root = std::env::var("GRAFFITI_PROJECT_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                // Compile-time fallback: works when running inside Docker.
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
            });
        project_root.join("src-tauri").join("binaries").join(name)
    } else {
        app.path()
            .resource_dir()
            .expect("resource dir not found")
            .join(name)
    }
}

/// IPFS repo lives in the app's data dir so it never conflicts with an existing
/// ~/.ipfs installation the user might have.
fn ipfs_repo(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("app data dir not found")
        .join("ipfs")
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Run a one-shot ipfs sub-command (init, config, etc.) and return stdout.
async fn run_ipfs(app: &AppHandle, args: &[&str]) -> Result<String, String> {
    let output = Command::new(ipfs_binary(app))
        .arg("--repo-dir")
        .arg(ipfs_repo(app))
        .args(args)
        .output()
        .await
        .map_err(|e| format!("ipfs command failed: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

/// Poll localhost:5001 until the TCP port is open (daemon ready) or timeout.
async fn wait_for_api(secs: u64) -> Result<(), String> {
    timeout(Duration::from_secs(secs), async {
        loop {
            if TcpStream::connect("127.0.0.1:5001").await.is_ok() {
                return;
            }
            tokio::time::sleep(Duration::from_millis(300)).await;
        }
    })
    .await
    .map_err(|_| format!("IPFS daemon did not respond within {secs}s"))
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Start the Kubo daemon. Initialises the repo on first run and configures
/// CORS so the Tauri webview can reach the API on http://127.0.0.1:5001.
/// Blocks until the API port is open (max 30 s), then returns.
#[tauri::command]
async fn ipfs_start(
    app: AppHandle,
    state: State<'_, IpfsState>,
) -> Result<(), String> {
    let mut guard = state.daemon.lock().await;
    if guard.is_some() {
        return Ok(()); // already running
    }

    let repo = ipfs_repo(&app);

    // ── First-run initialisation ──────────────────────────────────────────────
    if !repo.join("config").exists() {
        run_ipfs(&app, &["init"]).await?;

        // Allow the Tauri webview (both dev and prod origins) to call the API.
        for (key, value) in [
            (
                "API.HTTPHeaders.Access-Control-Allow-Origin",
                r#"["http://localhost:1420","tauri://localhost"]"#,
            ),
            (
                "API.HTTPHeaders.Access-Control-Allow-Methods",
                r#"["GET","POST","PUT"]"#,
            ),
            (
                "API.HTTPHeaders.Access-Control-Allow-Headers",
                r#"["Authorization"]"#,
            ),
        ] {
            run_ipfs(&app, &["config", "--json", key, value]).await?;
        }
    }

    // ── Spawn daemon ──────────────────────────────────────────────────────────
    let child = Command::new(ipfs_binary(&app))
        .arg("--repo-dir")
        .arg(&repo)
        .arg("daemon")
        // Suppress output — we poll the TCP port instead of parsing stdout
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to spawn ipfs daemon: {e}"))?;

    *guard = Some(child);

    // ── Wait for API readiness ────────────────────────────────────────────────
    if let Err(e) = wait_for_api(30).await {
        // Kill the child we just stored before returning the error
        if let Some(mut c) = guard.take() {
            c.kill().await.ok();
        }
        return Err(e);
    }

    Ok(())
}

/// Kill the daemon gracefully.
#[tauri::command]
async fn ipfs_stop(state: State<'_, IpfsState>) -> Result<(), String> {
    let mut guard = state.daemon.lock().await;
    if let Some(mut child) = guard.take() {
        child.kill().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Returns true if the daemon process is currently tracked as running.
#[tauri::command]
async fn ipfs_status(state: State<'_, IpfsState>) -> Result<bool, String> {
    Ok(state.daemon.lock().await.is_some())
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(IpfsState {
            daemon: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![ipfs_start, ipfs_stop, ipfs_status])
        // Kill the daemon when the last window is destroyed
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app.try_state::<IpfsState>() {
                        let mut guard = state.daemon.lock().await;
                        if let Some(mut child) = guard.take() {
                            child.kill().await.ok();
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

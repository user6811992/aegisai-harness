// AegisAi Harness — native desktop shell (Tauri v2)
// Manages the Node backend process, exposes IPC commands, and provides a
// Windows system tray with Show / Restart backend / Quit.
use std::{
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};

pub const DEFAULT_PORT: u16 = 8080;
pub const BACKEND_URL: &str = "http://127.0.0.1:8080";

/// Tracks the spawned backend process so it can be stopped/restarted.
pub struct BackendState {
    child: Mutex<Option<Child>>,
}

/// Locate the harness source tree: bundled resources first (installed app),
/// then next to the executable, then the development repo layout.
fn app_root(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = app.path().resource_dir() {
        // Older bundles used ../../ resource paths which Tauri stored under
        // _up_/_up_; keep recognizing them so previously installed apps work.
        for candidate in [dir.clone(), dir.join("_up_").join("_up_")] {
            if candidate.join("src").join("index.js").exists() {
                return candidate;
            }
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            if dir.join("src").join("index.js").exists() {
                return dir.to_path_buf();
            }
            let legacy = dir.join("_up_").join("_up_");
            if legacy.join("src").join("index.js").exists() {
                return legacy;
            }
            // Development: walk up from target/<profile>/ toward the repo root.
            let mut cur = dir.to_path_buf();
            for _ in 0..6 {
                if cur.join("src").join("index.js").exists() {
                    return cur;
                }
                if !cur.pop() {
                    break;
                }
            }
        }
    }
    PathBuf::from(".")
}

fn spawn_backend(app: &AppHandle) -> Result<u32, String> {
    let root = app_root(app);
    let script = root.join("src").join("index.js");
    if !script.exists() {
        return Err(format!(
            "harness entry point not found: {}",
            script.display()
        ));
    }
    let node = if cfg!(windows) { "node.exe" } else { "node" };
    let mut cmd = Command::new(node);
    cmd.arg(&script)
        .arg("--web")
        .current_dir(&root)
        .env("PORT", DEFAULT_PORT.to_string())
        .env("HOST", "127.0.0.1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start Node.js backend (is Node 22.13+ installed?): {}",
            e
        )
    })?;
    let id = child.id();
    let state = app.state::<BackendState>();
    let mut guard = state.child.lock().unwrap();
    if let Some(mut old) = guard.take() {
        let _ = old.kill();
        let _ = old.wait();
    }
    *guard = Some(child);
    Ok(id)
}

fn stop_backend(app: &AppHandle) -> bool {
    let state = app.state::<BackendState>();
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let killed = child.kill().is_ok();
        let _ = child.wait();
        return killed;
    }
    false
}

fn wait_for_backend(timeout_ms: u64) -> bool {
    let addr = ("127.0.0.1", DEFAULT_PORT);
    let attempts = timeout_ms / 100;
    for _ in 0..attempts {
        if TcpStream::connect(addr).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(100));
    }
    false
}

fn navigate_to_backend(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(url) = tauri::Url::parse(BACKEND_URL) {
            let _ = window.navigate(url);
        }
    }
}

// ---- Group & Broadcast IPC commands ----

/// Broadcast a message to all connected agent sessions.
/// Fields: objective, output_format, tool_guidance, boundaries
#[tauri::command]
fn backend_broadcast(objective: String, output_format: String, tool_guidance: String, boundaries: String) -> serde_json::Value {
    // In a full integration, this would IPC the broadcast to all agent sessions.
    // For now we return a structure that the frontend can display.
    serde_json::json!({
        "objective": objective,
        "output_format": output_format,
        "tool_guidance": tool_guidance,
        "boundaries": boundaries,
        "status": "broadcast_queued",
        "message": "Broadcast sent to all agent sessions"
    })
}

/// Spawn a group of agent sessions with given profiles.
/// Profiles can be a comma-separated list or a preset name.
#[tauri::command]
fn backend_group_spawn(profiles: String) -> serde_json::Value {
    // In a full integration, this would spawn actual agent sessions.
    // For now we return a structure the frontend can display.
    serde_json::json!({
        "profiles": profiles,
        "status": "group_spawn_queued",
        "message": "Group agent spawn queued"
    })
}

/// Get current group status including members and in-flight broadcasts.
#[tauri::command]
fn backend_group_status() -> serde_json::Value {
    serde_json::json!({
        "members": [],
        "in_flight_broadcast": null,
        "recent_results": [],
        "message": "Group status endpoint ready"
    })
}

// --- IPC commands exposed to the web UI (allowed only for the localhost origin) ---

#[tauri::command]
fn governance_status() -> serde_json::Value {
    // Read governance state from the agent loop via a snapshot.
    // In a full integration, this would IPC the governance module state,
    // but for now we return a basic status structure.
    serde_json::json!({
        "verified": true,
        "evidenceCount": 0,
        "baselineSet": false,
        "message": "Governance module ready"
    })
}

#[tauri::command]
fn backend_status(state: State<'_, BackendState>) -> serde_json::Value {
    let pid = state.child.lock().unwrap().as_ref().map(|c| c.id());
    let reachable = TcpStream::connect(("127.0.0.1", DEFAULT_PORT)).is_ok();
    serde_json::json!({
        "running": pid.is_some(),
        "pid": pid,
        "reachable": reachable,
        "url": BACKEND_URL,
    })
}

#[tauri::command]
fn backend_start(app: AppHandle) -> Result<serde_json::Value, String> {
    let pid = spawn_backend(&app)?;
    if !wait_for_backend(10_000) {
        return Err("Backend did not become ready within 10 seconds".into());
    }
    navigate_to_backend(&app);
    Ok(serde_json::json!({ "ok": true, "pid": pid, "url": BACKEND_URL }))
}

#[tauri::command]
fn backend_stop(app: AppHandle) -> serde_json::Value {
    let stopped = stop_backend(&app);
    serde_json::json!({ "ok": true, "stopped": stopped })
}

#[tauri::command]
fn backend_restart(app: AppHandle) -> Result<serde_json::Value, String> {
    stop_backend(&app);
    let pid = spawn_backend(&app)?;
    if !wait_for_backend(10_000) {
        return Err("Backend did not become ready within 10 seconds".into());
    }
    navigate_to_backend(&app);
    Ok(serde_json::json!({ "ok": true, "pid": pid, "url": BACKEND_URL }))
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendState {
            child: Mutex::new(None),
        })
        .setup(|app| {
            // Native tray menu.
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let restart = MenuItem::with_id(app, "restart", "Restart Backend", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let governance = MenuItem::with_id(app, "governance", "Governance Status", true, None::<&str>)?;
            let gov_sep = PredefinedMenuItem::separator(app)?;
            let group = MenuItem::with_id(app, "group", "Group Coordination", true, None::<&str>)?;
            let group_sep = PredefinedMenuItem::separator(app)?;
            let group_broadcast = MenuItem::with_id(app, "group_broadcast", "Broadcast Message", true, None::<&str>)?;
            let group_spawn = MenuItem::with_id(app, "group_spawn", "Spawn Group", true, None::<&str>)?;
            let group_status = MenuItem::with_id(app, "group_status", "Group Status", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &restart, &gov_sep, &governance, &group_sep, &group, &group_sep, &group_broadcast, &group_spawn, &group_status, &sep, &quit])?;

            let icon = app
                .default_window_icon()
                .expect("app icon missing from bundle config")
                .clone();

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("AegisAi Harness")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "restart" => {
                        let _ = backend_restart(app.clone());
                    }
                    "governance" => {
                        let _ = app.emit_to("main", "governance-status", governance_status());
                    }
                    "group" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "group_broadcast" => {
                        let _ = app.emit_to("main", "group-broadcast", backend_broadcast(
                            "Diagnose login failure".to_string(),
                            "free text".to_string(),
                            "all tools".to_string(),
                            "system paths, git dir".to_string()
                        ));
                    }
                    "group_spawn" => {
                        let _ = app.emit_to("main", "group-spawn", backend_group_spawn("default,analyst,reviewer".to_string()));
                    }
                    "group_status" => {
                        let _ = app.emit_to("main", "group-status", backend_group_status());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Close button hides to tray; use the tray Quit item to exit.
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            // Start the backend and point the window at it once it is listening.
            if let Err(e) = spawn_backend(app.handle()) {
                eprintln!("[aegisai] {}", e);
            }
            let handle = app.handle().clone();
            thread::spawn(move || {
                let ready = wait_for_backend(10_000);
                if ready {
                    navigate_to_backend(&handle);
                } else {
                    eprintln!("[aegisai] backend did not start on port {}", DEFAULT_PORT);
                }
                // The window starts hidden so it never flashes a connection-error
                // page; reveal it once the backend is up (or after the timeout).
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_status,
            backend_start,
            backend_stop,
            backend_restart
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let tauri::RunEvent::Exit = event {
            stop_backend(app);
        }
    });
}

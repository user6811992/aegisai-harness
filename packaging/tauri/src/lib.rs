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
    command,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
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
        if dir.join("src").join("index.js").exists() {
            return dir;
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            if dir.join("src").join("index.js").exists() {
                return dir.to_path_buf();
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

// --- IPC commands exposed to the web UI (allowed only for the localhost origin) ---

#[command]
pub fn backend_status(state: State<'_, BackendState>) -> serde_json::Value {
    let pid = state.child.lock().unwrap().as_ref().map(|c| c.id());
    let reachable = TcpStream::connect(("127.0.0.1", DEFAULT_PORT)).is_ok();
    serde_json::json!({
        "running": pid.is_some(),
        "pid": pid,
        "reachable": reachable,
        "url": BACKEND_URL,
    })
}

#[command]
pub fn backend_start(app: AppHandle) -> Result<serde_json::Value, String> {
    let pid = spawn_backend(&app)?;
    if !wait_for_backend(10_000) {
        return Err("Backend did not become ready within 10 seconds".into());
    }
    navigate_to_backend(&app);
    Ok(serde_json::json!({ "ok": true, "pid": pid, "url": BACKEND_URL }))
}

#[command]
pub fn backend_stop(app: AppHandle) -> serde_json::Value {
    let stopped = stop_backend(&app);
    serde_json::json!({ "ok": true, "stopped": stopped })
}

#[command]
pub fn backend_restart(app: AppHandle) -> Result<serde_json::Value, String> {
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
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &restart, &sep, &quit])?;

            let icon = match app.default_window_icon() {
                Some(i) => i.clone(),
                None => {
                    tauri::image::Image::from_bytes(include_bytes!("../../../public/icon-192.png"))
                        .expect("invalid tray icon")
                }
            };

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
            if let Err(e) = spawn_backend(app) {
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

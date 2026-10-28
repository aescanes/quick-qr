// All QR logic lives in the TypeScript frontend (src/render.ts); Rust only hosts the webview
// and provides native save dialogs / file writes.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running QuickQR");
}

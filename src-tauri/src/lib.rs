mod stt;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
async fn transcribe_voice(model_path: String, app: tauri::AppHandle) -> Result<String, String> {
    tokio::task::spawn_blocking(move || stt::record_and_transcribe(&model_path, app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn default_model_path() -> String {
    dirs::home_dir()
        .map(|h| h.join(".pressm").join("ggml-tiny.en.bin"))
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let visible = window.is_visible().unwrap_or(false);
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("shortcut-triggered", ());
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            app.global_shortcut().register("Shift+M")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![transcribe_voice, default_model_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

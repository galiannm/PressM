use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const TARGET_SAMPLE_RATE: u32 = 16_000;
const MAX_DURATION_SECS: f32 = 8.0;
const SILENCE_THRESHOLD: f32 = 0.008;
const SILENCE_DURATION_SECS: f32 = 1.2;
const MIN_RECORDING_SECS: f32 = 0.5;
const LEVEL_EMIT_INTERVAL_MS: u64 = 40;

pub fn record_and_transcribe(model_path: &str, app: AppHandle) -> Result<String, String> {
    let audio = record_audio(&app).map_err(|e| e.to_string())?;
    let _ = app.emit("audio-level", 0.0_f32);
    transcribe(model_path, &audio)
}

fn record_audio(app: &AppHandle) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No microphone found")?;

    let default_config = device.default_input_config()?;
    let sample_rate = default_config.sample_rate().0;
    let channels = default_config.channels() as usize;

    let config = cpal::StreamConfig {
        channels: channels as u16,
        sample_rate: cpal::SampleRate(sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };

    let raw_samples: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_clone = raw_samples.clone();
    let start = Instant::now();
    let last_sound = Arc::new(Mutex::new(Instant::now()));
    let last_sound_clone = last_sound.clone();
    let finished = Arc::new(Mutex::new(false));
    let finished_clone = finished.clone();
    // Smoothed RMS level shared between stream callback and emit loop
    let current_level: Arc<Mutex<f32>> = Arc::new(Mutex::new(0.0));
    let level_clone = current_level.clone();

    let stream = device.build_input_stream(
        &config,
        move |data: &[f32], _| {
            let mono: Vec<f32> = data
                .chunks(channels)
                .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                .collect();

            let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();

            // Smooth: fast attack, slow release
            let mut lvl = level_clone.lock().unwrap();
            *lvl = if rms > *lvl { rms * 0.8 + *lvl * 0.2 } else { rms * 0.1 + *lvl * 0.9 };

            if rms > SILENCE_THRESHOLD {
                *last_sound_clone.lock().unwrap() = Instant::now();
            }

            samples_clone.lock().unwrap().extend(mono);

            let elapsed = start.elapsed().as_secs_f32();
            let silence = last_sound_clone.lock().unwrap().elapsed().as_secs_f32();
            if elapsed >= MAX_DURATION_SECS
                || (elapsed > MIN_RECORDING_SECS && silence > SILENCE_DURATION_SECS)
            {
                *finished_clone.lock().unwrap() = true;
            }
        },
        |err| eprintln!("Audio stream error: {err}"),
        None,
    )?;

    stream.play()?;

    // Emit audio level at ~25fps until recording is done
    loop {
        std::thread::sleep(Duration::from_millis(LEVEL_EMIT_INTERVAL_MS));
        let level = *current_level.lock().unwrap();
        let _ = app.emit("audio-level", (level * 8.0).min(1.0));
        if *finished.lock().unwrap() {
            break;
        }
    }

    drop(stream);

    let raw = raw_samples.lock().unwrap().clone();
    Ok(resample(&raw, sample_rate, TARGET_SAMPLE_RATE))
}

fn resample(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return input.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let output_len = (input.len() as f64 / ratio) as usize;
    (0..output_len)
        .map(|i| {
            let pos = i as f64 * ratio;
            let idx = pos as usize;
            let frac = (pos - idx as f64) as f32;
            let a = input.get(idx).copied().unwrap_or(0.0);
            let b = input.get(idx + 1).copied().unwrap_or(0.0);
            a + frac * (b - a)
        })
        .collect()
}

fn transcribe(model_path: &str, audio: &[f32]) -> Result<String, String> {
    let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|e| format!("Failed to load Whisper model: {e}"))?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create Whisper state: {e}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state
        .full(params, audio)
        .map_err(|e| format!("Transcription failed: {e}"))?;

    let num_segments = state
        .full_n_segments()
        .map_err(|e| format!("Failed to get segments: {e}"))?;

    let text = (0..num_segments)
        .filter_map(|i| state.full_get_segment_text(i).ok())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    Ok(text)
}

import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { MicOff, Loader } from "lucide-react";
import "./App.css";

const STATUS = {
  LISTENING: "listening",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
};

const BAR_COUNT = 5;
const BAR_PHASES = [0, 0.4, 0.8, 0.4, 0]; // symmetric spread

function App() {
  const [status, setStatus] = useState(STATUS.LISTENING);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [level, setLevel] = useState(0);
  const hideTimerRef = useRef(null);
  const modelPathRef = useRef(null);

  const hideWindow = async () => {
    await getCurrentWindow().hide();
    setTranscript("");
    setStatus(STATUS.LISTENING);
    setErrorMsg("");
    setLevel(0);
  };

  const startListening = async () => {
    setStatus(STATUS.LISTENING);
    setTranscript("");
    setErrorMsg("");
    setLevel(0);

    try {
      if (!modelPathRef.current) {
        modelPathRef.current = await invoke("default_model_path");
      }

      const result = await invoke("transcribe_voice", {
        modelPath: modelPathRef.current,
      });

      setStatus(STATUS.PROCESSING);

      if (result && result.trim()) {
        setTranscript(result.trim());
        setStatus(STATUS.DONE);
        // Stage 3 will handle the command here
        hideTimerRef.current = setTimeout(hideWindow, 1800);
      } else {
        await hideWindow();
      }
    } catch (err) {
      const msg = String(err);
      setErrorMsg(msg.includes("model") || msg.includes("No such file")
        ? "Model not found — see setup instructions"
        : msg);
      setStatus(STATUS.ERROR);
      hideTimerRef.current = setTimeout(hideWindow, 3000);
    }
  };

  useEffect(() => {
    const unlistenShortcut = listen("shortcut-triggered", () => {
      clearTimeout(hideTimerRef.current);
      startListening();
    });

    const unlistenLevel = listen("audio-level", (e) => {
      setLevel(e.payload);
    });

    const handleClick = async (e) => {
      const overlay = document.getElementById("overlay");
      if (overlay && !overlay.contains(e.target)) {
        clearTimeout(hideTimerRef.current);
        await hideWindow();
      }
    };
    window.addEventListener("click", handleClick);

    return () => {
      unlistenShortcut.then((fn) => fn());
      unlistenLevel.then((fn) => fn());
      window.removeEventListener("click", handleClick);
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div className="app-root">
      <div id="overlay" className={`overlay ${transcript ? "has-transcript" : ""}`}>
        <LeftIcon status={status} />
        <div className="text-area">
          {transcript ? (
            <p className="transcript">{transcript}</p>
          ) : status === STATUS.LISTENING ? (
            <Waveform level={level} />
          ) : status === STATUS.PROCESSING ? (
            <p className="main-text">Processing…</p>
          ) : (
            <>
              <p className="main-text">Error</p>
              <p className="hint-text">{errorMsg}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Waveform({ level }) {
  return (
    <div className="waveform">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const barLevel = Math.max(0.08, level * (0.5 + BAR_PHASES[i] * 0.8));
        return (
          <div
            key={i}
            className="waveform-bar"
            style={{ "--bar-level": barLevel }}
          />
        );
      })}
    </div>
  );
}

function LeftIcon({ status }) {
  if (status === STATUS.PROCESSING) {
    return <div className="icon-wrap processing"><Loader size={22} strokeWidth={2} /></div>;
  }
  if (status === STATUS.ERROR) {
    return <div className="icon-wrap error"><MicOff size={22} strokeWidth={2} /></div>;
  }
  if (status === STATUS.DONE) {
    return <div className="icon-wrap done">✓</div>;
  }
  return null;
}

export default App;

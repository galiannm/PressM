import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { MicOff, Loader } from "lucide-react";
import { parseCommand, INTENT } from "./lib/parser.js";
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
  const [parsedIntent, setParsedIntent] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [level, setLevel] = useState(0);
  const hideTimerRef = useRef(null);
  const modelPathRef = useRef(null);
  const statusRef = useRef(STATUS.LISTENING);

  const hideWindow = async () => {
    await getCurrentWindow().hide();
    setTranscript("");
    setParsedIntent(null);
    setStatus(STATUS.LISTENING);
    setErrorMsg("");
    setLevel(0);
  };

  const startListening = async () => {
    statusRef.current = STATUS.LISTENING;
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
        const trimmed = result.trim();
        const intent = parseCommand(trimmed);
        setTranscript(trimmed);
        setParsedIntent(intent);
        statusRef.current = STATUS.DONE;
        setStatus(STATUS.DONE);
        // Stage 4 will execute the intent here
        console.log("[PressM] parsed intent:", intent);
        hideTimerRef.current = setTimeout(hideWindow, 1800);
      } else {
        await hideWindow();
      }
    } catch (err) {
      const msg = String(err);
      setErrorMsg(msg.includes("model") || msg.includes("No such file")
        ? "Model not found — see setup instructions"
        : msg);
      statusRef.current = STATUS.ERROR;
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

    // While the overlay is open, pressing M alone re-triggers recording
    const handleKeyDown = (e) => {
      if (e.key === "m" || e.key === "M") {
        const s = statusRef.current;
        if (s === STATUS.DONE || s === STATUS.ERROR) {
          clearTimeout(hideTimerRef.current);
          startListening();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

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
      window.removeEventListener("keydown", handleKeyDown);
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
            <>
              <p className="transcript">{transcript}</p>
              {parsedIntent && parsedIntent.intent !== "unknown" && (
                <p className="intent-badge">{intentLabel(parsedIntent)}</p>
              )}
            </>
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

function intentLabel({ intent, provider, isLibrary }) {
  const providerStr = provider ? ` · ${provider.replace("_", " ")}` : "";
  const libraryStr = isLibrary ? " · library" : "";
  return `${intent}${libraryStr}${providerStr}`;
}

export default App;

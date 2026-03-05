import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Mic, MicOff, Loader } from "lucide-react";
import "./App.css";

const STATUS = {
  LISTENING: "listening",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
};

function App() {
  const [status, setStatus] = useState(STATUS.LISTENING);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef(null);
  const hideTimerRef = useRef(null);

  const hideWindow = async () => {
    await getCurrentWindow().hide();
    setTranscript("");
    setStatus(STATUS.LISTENING);
    setErrorMsg("");
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus(STATUS.ERROR);
      setErrorMsg("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setStatus(STATUS.LISTENING);
      setTranscript("");
    };

    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setTranscript(text);

      if (e.results[e.results.length - 1].isFinal) {
        setStatus(STATUS.DONE);
        // Stage 3 will pick up the final transcript here
        hideTimerRef.current = setTimeout(hideWindow, 1500);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech") {
        hideWindow();
        return;
      }
      setStatus(STATUS.ERROR);
      setErrorMsg(e.error);
      hideTimerRef.current = setTimeout(hideWindow, 2000);
    };

    recognition.onend = () => {
      if (status !== STATUS.DONE && status !== STATUS.ERROR) {
        hideWindow();
      }
    };

    recognition.start();
  };

  useEffect(() => {
    const unlisten = listen("shortcut-triggered", () => {
      clearTimeout(hideTimerRef.current);
      setTranscript("");
      setErrorMsg("");
      setStatus(STATUS.LISTENING);
      // Small delay to let the window render before starting mic
      setTimeout(startListening, 100);
    });

    const handleClick = async (e) => {
      const overlay = document.getElementById("overlay");
      if (overlay && !overlay.contains(e.target)) {
        recognitionRef.current?.abort();
        await hideWindow();
      }
    };
    window.addEventListener("click", handleClick);

    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener("click", handleClick);
      recognitionRef.current?.abort();
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div className="app-root">
      <div id="overlay" className={`overlay ${transcript ? "has-transcript" : ""}`}>
        <StatusIcon status={status} />
        <div className="text-area">
          {transcript ? (
            <p className="transcript">{transcript}</p>
          ) : (
            <>
              <p className="listening-text">
                {status === STATUS.ERROR ? "Error" : "Listening…"}
              </p>
              {status === STATUS.ERROR ? (
                <p className="hint-text">{errorMsg}</p>
              ) : (
                <p className="hint-text">speak your command</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === STATUS.PROCESSING) {
    return (
      <div className="icon-wrap processing">
        <Loader size={26} strokeWidth={2} />
      </div>
    );
  }
  if (status === STATUS.ERROR) {
    return (
      <div className="icon-wrap error">
        <MicOff size={26} strokeWidth={2} />
      </div>
    );
  }
  return (
    <div className={`icon-wrap ${status === STATUS.DONE ? "done" : "listening"}`}>
      <Mic size={26} strokeWidth={2} />
    </div>
  );
}

export default App;

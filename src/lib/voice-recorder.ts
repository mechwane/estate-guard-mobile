import { useCallback, useEffect, useRef, useState } from "react";

const pickMimeType = () => {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
};

const extFor = (mime: string) =>
  mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";

/**
 * Microphone recorder for chat voice notes. Returns a `File` on stop so the
 * caller can reuse the existing attachment upload path.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!supported) throw new Error("Voice notes are not supported on this device.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.start(250);
    recorder.current = rec;
    setRecording(true);
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [supported]);

  /** Stops recording; resolves with the recorded file, or null when discarded. */
  const stop = useCallback(
    (discard = false) =>
      new Promise<File | null>((resolve) => {
        const rec = recorder.current;
        if (!rec) {
          cleanup();
          resolve(null);
          return;
        }
        rec.onstop = () => {
          const type = rec.mimeType || "audio/webm";
          const blob = new Blob(chunks.current, { type });
          chunks.current = [];
          cleanup();
          if (discard || blob.size === 0) {
            resolve(null);
            return;
          }
          resolve(
            new File([blob], `voice-note-${Date.now()}.${extFor(type)}`, {
              type: type.split(";")[0] ?? "audio/webm",
            }),
          );
        };
        rec.stop();
      }),
    [cleanup],
  );

  return { supported, recording, seconds, start, stop };
}

export const formatDuration = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

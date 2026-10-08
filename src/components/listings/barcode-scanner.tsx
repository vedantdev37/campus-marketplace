"use client";

import { useEffect, useRef, useState } from "react";

import { isBookBarcode } from "@/lib/isbn";

type BarcodeScannerProps = {
  /** Called once, with a check-digit-valid ISBN-13 read from the camera. */
  onDetected: (isbn: string) => void;
  onClose: () => void;
};

/** The slice of the BarcodeDetector API used here. */
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

type DetectorConstructor = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

/**
 * The browser's own detector where it exists and can read EAN-13, otherwise a
 * WebAssembly implementation of the same interface.
 *
 * Chrome on Android ships a native BarcodeDetector backed by the OS, which is
 * fast and costs no download. Safari and Firefox do not have one, so the
 * fallback is loaded on demand with a dynamic import - the roughly 1 MB of
 * WebAssembly is only fetched by a browser that needs it, and only when the
 * scanner is actually opened.
 */
async function createDetector(): Promise<Detector> {
  const native = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;

  if (native?.getSupportedFormats) {
    const formats = await native.getSupportedFormats().catch(() => [] as string[]);

    if (formats.includes("ean_13")) {
      return new native({ formats: ["ean_13"] });
    }
  }

  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: ["ean_13"] });
}

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access is blocked. Allow it in your browser settings, or type the ISBN instead.";
  }

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device. Type the ISBN instead.";
  }

  if (name === "NotReadableError") {
    return "The camera is being used by another app. Close it and try again, or type the ISBN.";
  }

  return "The scanner could not start. Type the ISBN instead.";
}

/**
 * Full-screen camera sheet that reads a book's barcode.
 *
 * A book's barcode is its ISBN-13 printed as an EAN-13, so no lookup is needed
 * to turn one into the other - the digits are the ISBN.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Kept in refs so the effect below can run exactly once per mount without
  // listing the callbacks as dependencies and restarting the camera on every
  // parent re-render.
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          // "ideal" rather than "exact": a laptop has no rear camera, and an
          // exact constraint would fail there instead of using the webcam.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          return;
        }

        video.srcObject = stream;
        await video.play();

        const detector = await createDetector();
        if (cancelled) {
          return;
        }

        setStatus("scanning");

        const scan = async () => {
          if (cancelled) {
            return;
          }

          try {
            const codes = await detector.detect(video);
            const book = codes.find((code) => isBookBarcode(code.rawValue));

            if (book) {
              // Stop before reporting, so a second frame cannot report twice.
              cancelled = true;
              onDetectedRef.current(book.rawValue);
              return;
            }
          } catch {
            // A single unreadable frame is normal while the camera focuses.
          }

          // A few frames a second is plenty for a barcode held still, and
          // leaves the phone cool. Scheduled after each attempt finishes, so
          // slow frames cannot pile up.
          timer = setTimeout(scan, 200);
        };

        void scan();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(describeCameraError(error));
          setStatus("error");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      // Without this the camera light stays on after the sheet closes.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // A modal sheet: Escape closes it, focus starts on the close button, and the
  // page behind does not scroll under it.
  useEffect(() => {
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan a book barcode"
      className="fixed inset-0 z-50 flex flex-col overscroll-contain bg-[#111111] text-white"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-base font-medium">Scan the barcode</p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex size-12 items-center justify-center rounded-full bg-white/15 text-xl leading-none hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative aspect-3/2 w-full max-w-md overflow-hidden rounded-[14px] bg-black">
          {/* playsInline stops iOS Safari from taking the video full screen. */}
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

          {status === "scanning" ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-6">
              <span className="absolute top-0 left-0 size-6 rounded-tl-lg border-t-2 border-l-2 border-white" />
              <span className="absolute top-0 right-0 size-6 rounded-tr-lg border-t-2 border-r-2 border-white" />
              <span className="absolute bottom-0 left-0 size-6 rounded-bl-lg border-b-2 border-l-2 border-white" />
              <span className="absolute right-0 bottom-0 size-6 rounded-br-lg border-r-2 border-b-2 border-white" />
            </div>
          ) : null}
        </div>

        <p role="status" className="mt-5 max-w-md text-center text-sm text-white/85">
          {status === "starting" ? "Starting the camera…" : null}
          {status === "scanning"
            ? "Hold the barcode on the back cover inside the frame. It is read automatically."
            : null}
          {status === "error" ? errorMessage : null}
        </p>
      </div>

      <div className="px-6 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          className="mx-auto flex h-12 w-full max-w-md items-center justify-center rounded-lg border border-white/70 text-base font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          Type the ISBN instead
        </button>
      </div>
    </div>
  );
}

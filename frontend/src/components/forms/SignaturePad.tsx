/**
 * components/forms/SignaturePad.tsx
 * Real signature capture component using the `signature_pad` library.
 * Renders a canvas the user draws on with mouse or touch/stylus.
 *
 * Usage:
 *   <SignaturePad
 *     label="Patient Signature"
 *     required
 *     onCapture={(dataUrl) => handleFieldChange('patient_signature', dataUrl)}
 *   />
 *
 * The dataUrl (PNG base64) is stored as the field value, then later
 * drawn onto the PDF page via pdfService before SharePoint upload.
 *
 * Owner: Meya / Dennise
 */

import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';

interface SignaturePadProps {
  label: string;
  required?: boolean;
  defaultValue?: string; // existing dataUrl if resuming a session
  onCapture: (dataUrl: string) => void;
}

export const SignaturePad = ({ label, required, defaultValue, onCapture }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize signature_pad
    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: '#1e2fb0',
      minWidth: 1,
      maxWidth: 2.5,
    });

    // Pre-fill if resuming a session
    if (defaultValue) {
      padRef.current.fromDataURL(defaultValue);
      setIsEmpty(false);
    }

    // Track empty state and notify parent on each stroke end
    padRef.current.addEventListener('endStroke', () => {
      const empty = padRef.current?.isEmpty() ?? true;
      setIsEmpty(empty);
      if (!empty && padRef.current) {
        onCapture(padRef.current.toDataURL('image/png'));
      }
    });

    // Handle canvas resize (window resize or container change)
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
      setIsEmpty(true);
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    return () => {
      observer.disconnect();
      padRef.current?.off();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
    onCapture('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-32 touch-none cursor-crosshair"
          style={{ display: 'block' }}
        />
        {/* Placeholder text shown when pad is empty */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-gray-300 select-none">Sign here</p>
          </div>
        )}
      </div>

      {/* Baseline */}
      <div className="mt-1 mx-4 border-b border-gray-300" />
      <p className="text-xs text-gray-400 text-center mt-1">Draw signature above</p>
    </div>
  );
};

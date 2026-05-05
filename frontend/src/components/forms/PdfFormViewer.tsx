/**
 * components/forms/PdfFormViewer.tsx
 * Renders a PDF form in the browser with interactive field overlays.
 *
 * Flow:
 *   1. Fetch the PDF bytes from the backend (/api/forms/:slug/pdf)
 *   2. Render each page to a <canvas> with pdfjs-dist
 *   3. Use pdf-lib to parse AcroForm field positions and types
 *   4. Overlay transparent HTML inputs exactly where the PDF fields are
 *   5. Signature fields are shown as signature pads at the bottom
 *
 * Owner: Dennise / Anthony
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFNumber,
  PDFString,
} from 'pdf-lib';
import { SignaturePad } from './SignaturePad';

// Set up the PDF.js worker (Vite resolves this URL at build time)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const SCALE = 1.5;

interface PdfField {
  name: string;
  type: 'text' | 'checkbox' | 'signature';
  rect: { x: number; y: number; width: number; height: number };
  pageIndex: number;
}

interface PageSize {
  width: number;   // canvas px
  height: number;  // canvas px
}

interface Props {
  slug: string;
  initialValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function PdfFormViewer({ slug, initialValues, onChange }: Props) {
  const [pdfPages, setPdfPages] = useState<pdfjsLib.PDFPageProxy[]>([]);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [fields, setFields] = useState<PdfField[]>([]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allRendered, setAllRendered] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Always-current ref so the canvas callback never captures a stale closure
  const pdfPagesRef = useRef<pdfjsLib.PDFPageProxy[]>([]);
  pdfPagesRef.current = pdfPages; // updated synchronously during render, before ref callbacks fire

  const renderedCountRef = useRef(0);
  const startedPagesRef = useRef(new Set<number>());

  // Keep local values in sync when parent reloads saved data
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('carelink_token') ?? '';

    (async () => {
      try {
        const res = await fetch(`/api/forms/${slug}/pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Could not load PDF');

        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // ── pdfjs: render pages to canvas ────────────────────────────────────
        const pdfjsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        const loadedPages: pdfjsLib.PDFPageProxy[] = [];
        const sizes: PageSize[] = [];

        for (let i = 1; i <= pdfjsDoc.numPages; i++) {
          const p = await pdfjsDoc.getPage(i);
          const vp = p.getViewport({ scale: SCALE });
          loadedPages.push(p);
          sizes.push({ width: vp.width, height: vp.height });
        }

        setPdfPages(loadedPages);
        setPageSizes(sizes);

        // ── pdf-lib: extract AcroForm field positions ─────────────────────────
        const pdfLibDoc = await PDFDocument.load(bytes.slice());
        setFields(extractFields(pdfLibDoc));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Reset render-tracking state whenever a new PDF slug is loaded
  useEffect(() => {
    setAllRendered(false);
    renderedCountRef.current = 0;
    startedPagesRef.current = new Set();
  }, [slug]);

  // Called by the canvas ref callback the moment a canvas mounts in the DOM.
  // Using a ref callback (not useEffect) guarantees the canvas exists when we
  // attempt to render — the old useEffect approach was racy because pdfPages
  // could be set before React committed the <canvas> elements.
  const bindCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, pageIndex: number) => {
      canvasRefs.current[pageIndex] = canvas;
      if (!canvas) return;
      if (startedPagesRef.current.has(pageIndex)) return; // already rendering

      const page = pdfPagesRef.current[pageIndex];
      if (!page) return;

      startedPagesRef.current.add(pageIndex);
      const viewport = page.getViewport({ scale: SCALE });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      page.render({ canvas, viewport }).promise
        .then(() => {
          renderedCountRef.current += 1;
          if (renderedCountRef.current >= pdfPagesRef.current.length) {
            setAllRendered(true);
          }
        })
        .catch(() => {});
    },
    [],
  );

  const handleChange = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      onChange(key, value);
    },
    [onChange],
  );

  const sigFields = fields.filter((f) => f.type === 'signature');
  const inputFields = fields.filter((f) => f.type !== 'signature');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ── PDF pages with overlaid inputs ──────────────────────────────────── */}
      {pageSizes.map((size, pi) => (
        <div
          key={pi}
          className="relative shadow-sm border border-gray-200 rounded overflow-hidden bg-white"
          style={{ width: size.width, maxWidth: '100%' }}
        >
          <canvas
            ref={(el) => bindCanvas(el, pi)}
            style={{ display: 'block', width: '100%' }}
          />

          {/* Input overlays only shown after all pages have finished rendering */}
          <div
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: size.width, height: size.height }}
          >
            {allRendered && inputFields
              .filter((f) => f.pageIndex === pi)
              .map((f) => {
                // Convert PDF coords (bottom-left origin) → CSS coords (top-left origin)
                const left = f.rect.x * SCALE;
                const top = size.height - (f.rect.y + f.rect.height) * SCALE;
                const width = f.rect.width * SCALE;
                const height = f.rect.height * SCALE;
                const fontSize = Math.max(8, Math.min(height * 0.62, 13));

                if (f.type === 'checkbox') {
                  return (
                    <input
                      key={f.name}
                      type="checkbox"
                      title={f.name}
                      checked={
                        values[f.name] === 'Yes' ||
                        values[f.name] === 'true' ||
                        values[f.name] === 'On'
                      }
                      onChange={(e) =>
                        handleChange(f.name, e.target.checked ? 'Yes' : 'Off')
                      }
                      className="pointer-events-auto cursor-pointer accent-primary"
                      style={{
                        position: 'absolute',
                        left,
                        top: top + height / 2 - 7,
                        width: Math.min(width, 16),
                        height: Math.min(height, 16),
                      }}
                    />
                  );
                }

                return (
                  <input
                    key={f.name}
                    type="text"
                    title={f.name}
                    value={values[f.name] ?? ''}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    className="pointer-events-auto"
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      width,
                      height,
                      fontSize,
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      color: '#111827',
                      background: 'rgba(219, 234, 254, 0.35)',
                      border: 'none',
                      outline: 'none',
                      padding: '0 3px',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.background = 'rgba(219, 234, 254, 0.8)';
                      e.currentTarget.style.outline = '1.5px solid #3b82f6';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = 'rgba(219, 234, 254, 0.35)';
                      e.currentTarget.style.outline = 'none';
                    }}
                  />
                );
              })}
          </div>
        </div>
      ))}

      {/* ── Signature pads at bottom — only after all pages are rendered ──────── */}
      {allRendered && sigFields.length > 0 && (
        <div className="pt-6 mt-2 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Signatures
          </p>
          <div className="grid grid-cols-2 gap-6">
            {sigFields.map((f) => (
              <SignaturePad
                key={f.name}
                label={sigLabel(f.name)}
                required
                defaultValue={values[f.name]}
                onCapture={(dataUrl) => handleChange(f.name, dataUrl)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Human-readable label for a signature field */
function sigLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('counselor')) return 'Counselor Signature';
  if (lower.includes('patient') || lower.includes('patients')) return 'Patient Signature';
  if (lower.includes('physician') || lower.includes('medical') || lower.includes('doctor'))
    return 'Physician Signature';
  if (lower.includes('witness')) return 'Witness Signature';
  if (lower.includes('representative')) return 'Representative Signature';
  return name;
}

/**
 * Extracts interactive field metadata (name, type, position, page) from a
 * pdf-lib PDFDocument. Uses two passes:
 *   Pass 1 — pdf-lib form API for text and checkbox fields.
 *   Pass 2 — iterate page Widget annotations for /Sig signature fields
 *            (pdf-lib doesn't expose a typed PDFSignature class).
 */
function extractFields(pdfDoc: PDFDocument): PdfField[] {
  const pages = pdfDoc.getPages();
  const results: PdfField[] = [];
  const seen = new Set<string>();

  // ── Pass 1: text + checkbox via form API ────────────────────────────────────
  try {
    const form = pdfDoc.getForm();
    for (const field of form.getFields()) {
      try {
        const name = field.getName();
        if (seen.has(name)) continue;

        // Read FT from the underlying dict (may need to fall back to parent)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const acro = (field as any).acroField;
        let ftNode = acro.dict.lookupMaybe(PDFName.of('FT'), PDFName);
        if (!ftNode) {
          const parentRef = acro.dict.lookupMaybe(PDFName.of('Parent'), PDFRef);
          if (parentRef) {
            const parentDict = pdfDoc.context.lookupMaybe(parentRef, PDFDict);
            ftNode = parentDict?.lookupMaybe(PDFName.of('FT'), PDFName);
          }
        }
        const ft: string = ftNode?.toString() ?? '/Tx';

        // Signature fields handled in pass 2
        if (ft === '/Sig') continue;

        const type: PdfField['type'] = ft === '/Btn' ? 'checkbox' : 'text';
        const widgets: unknown[] = acro.getWidgets?.() ?? [];
        if (widgets.length === 0) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const widget = widgets[0] as any;
        const rect = widget.getRectangle() as { x: number; y: number; width: number; height: number };

        let pageIndex = 0;
        try {
          const pageRef = widget.P?.();
          if (pageRef) {
            const pi = pages.findIndex(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p) => (p as any).ref.toString() === pageRef.toString(),
            );
            if (pi >= 0) pageIndex = pi;
          }
        } catch { /* fall back to page 0 */ }

        seen.add(name);
        results.push({ name, type, rect, pageIndex });
      } catch { /* skip malformed field */ }
    }
  } catch { /* form API unavailable */ }

  // ── Pass 2: signature fields via annotation dicts ────────────────────────────
  pages.forEach((page, pageIdx) => {
    try {
      const annotsRef = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      if (!annotsRef) return;

      for (let i = 0; i < annotsRef.size(); i++) {
        try {
          const item = annotsRef.get(i);
          let dict: PDFDict;
          if (item instanceof PDFRef) {
            dict = pdfDoc.context.lookup(item, PDFDict);
          } else if (item instanceof PDFDict) {
            dict = item;
          } else {
            continue;
          }

          const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName);
          if (subtype?.toString() !== '/Widget') continue;

          // Resolve FT — may live on a parent node
          let ftNode = dict.lookupMaybe(PDFName.of('FT'), PDFName);
          if (!ftNode) {
            const parentRef = dict.lookupMaybe(PDFName.of('Parent'), PDFRef);
            if (parentRef) {
              const parentDict = pdfDoc.context.lookupMaybe(parentRef, PDFDict);
              ftNode = parentDict?.lookupMaybe(PDFName.of('FT'), PDFName);
            }
          }
          if (ftNode?.toString() !== '/Sig') continue;

          // Field name from T entry
          const tNode = dict.lookupMaybe(PDFName.of('T'), PDFString);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const name: string = (tNode as any)?.decodeText?.() ?? tNode?.toString() ?? '';
          if (!name || seen.has(name)) continue;

          const rectArr = dict.lookupMaybe(PDFName.of('Rect'), PDFArray);
          if (!rectArr) continue;

          const x1 = (rectArr.get(0) as PDFNumber).asNumber();
          const y1 = (rectArr.get(1) as PDFNumber).asNumber();
          const x2 = (rectArr.get(2) as PDFNumber).asNumber();
          const y2 = (rectArr.get(3) as PDFNumber).asNumber();

          seen.add(name);
          results.push({
            name,
            type: 'signature',
            rect: {
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              width: Math.abs(x2 - x1),
              height: Math.abs(y2 - y1),
            },
            pageIndex: pageIdx,
          });
        } catch { /* skip bad annotation */ }
      }
    } catch { /* skip bad page */ }
  });

  return results;
}

/**
 * pages/AdminFormsPage.tsx
 * Admin — view, activate/deactivate, upload PDFs, and configure required fields
 * for form templates.
 * Owner: Success / Anthony
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '@/services/api';
import type { FormTemplate, FieldDefinition, FieldType } from '@/types';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFNumber,
  PDFString,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PREVIEW_SCALE = 0.72; // ~440 px wide for US Letter

// ── Types ──────────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'signature', label: 'Signature' },
];

interface FormEditorState {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  fieldDefinitions: FieldDefinition[];
}

interface ReqFieldState {
  key: string;
  type: 'text' | 'checkbox' | 'signature';
  required: boolean;
  requiredGroup: string;
  rect: { x: number; y: number; width: number; height: number };
  pageIndex: number;
}

const blankField = (): FieldDefinition => ({
  key: `field_${Date.now()}`,
  label: '',
  type: 'text',
  required: false,
});

const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFormId = useRef<string | null>(null);

  // Form editor modal (create/edit metadata — kept for future use)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [editor, setEditor] = useState<FormEditorState>({
    name: '', slug: '', description: '', sortOrder: 0, fieldDefinitions: [blankField()],
  });
  const [saving, setSaving] = useState(false);

  // Requirements modal — field list
  const [reqModal, setReqModal] = useState<{ form: FormTemplate } | null>(null);
  const [reqFields, setReqFields] = useState<ReqFieldState[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqSaving, setReqSaving] = useState(false);
  const [reqHoveredIdx, setReqHoveredIdx] = useState<number | null>(null);

  // Requirements modal — PDF preview
  const [reqPdfPages, setReqPdfPages] = useState<pdfjsLib.PDFPageProxy[]>([]);
  const [reqPageSizes, setReqPageSizes] = useState<{ width: number; height: number }[]>([]);
  const reqPdfPagesRef = useRef<pdfjsLib.PDFPageProxy[]>([]);
  reqPdfPagesRef.current = reqPdfPages;
  const reqCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const reqStartedPages = useRef(new Set<number>());
  const reqPageDivRefs = useRef<(HTMLDivElement | null)[]>([]);

  const load = () => adminApi.listForms().then((r) => setForms(r.data));
  useEffect(() => { load(); }, []);

  // ── Form editor handlers ────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingForm(null);
    setEditor({ name: '', slug: '', description: '', sortOrder: forms.length + 1, fieldDefinitions: [blankField()] });
    setModalOpen(true);
  };

  const openEdit = (form: FormTemplate) => {
    setEditingForm(form);
    setEditor({
      name: form.name,
      slug: form.slug,
      description: form.description ?? '',
      sortOrder: form.sortOrder,
      fieldDefinitions: (form.fieldDefinitions as FieldDefinition[]).length > 0
        ? (form.fieldDefinitions as FieldDefinition[])
        : [blankField()],
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingForm(null); };

  const handleNameChange = (name: string) => {
    setEditor((e) => ({ ...e, name, slug: editingForm ? e.slug : toSlug(name) }));
  };

  const addField = () => {
    setEditor((e) => ({ ...e, fieldDefinitions: [...e.fieldDefinitions, blankField()] }));
  };

  const removeField = (idx: number) => {
    setEditor((e) => ({ ...e, fieldDefinitions: e.fieldDefinitions.filter((_, i) => i !== idx) }));
  };

  const updateField = (idx: number, patch: Partial<FieldDefinition>) => {
    setEditor((e) => ({
      ...e,
      fieldDefinitions: e.fieldDefinitions.map((f, i) => i === idx ? { ...f, ...patch } : f),
    }));
  };

  const handleSave = async () => {
    if (!editor.name.trim() || !editor.slug.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: editor.name.trim(),
        slug: editor.slug.trim(),
        description: editor.description.trim() || undefined,
        sortOrder: editor.sortOrder,
        fieldDefinitions: editor.fieldDefinitions.filter((f) => f.label.trim()),
      };
      if (editingForm) {
        await adminApi.updateForm(editingForm.id, payload);
      } else {
        await adminApi.createForm(payload);
      }
      closeModal();
      load();
    } catch {
      alert('Failed to save form template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── PDF upload handlers ─────────────────────────────────────────────────────

  const handleToggleActive = async (form: FormTemplate) => {
    await adminApi.updateForm(form.id, { isActive: !form.isActive });
    load();
  };

  const openFilePicker = (formId: string) => {
    pendingFormId.current = formId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = pendingFormId.current;
    if (!file || !id) return;
    e.target.value = '';

    if (file.type !== 'application/pdf') {
      setUploadMessage({ id, text: 'Only PDF files are accepted.', ok: false });
      return;
    }

    setUploadingId(id);
    setUploadMessage(null);
    try {
      await adminApi.uploadFormPdf(id, file);
      setUploadMessage({ id, text: 'PDF updated — new sessions will use this version.', ok: true });
      load();
    } catch {
      setUploadMessage({ id, text: 'Upload failed. Please try again.', ok: false });
    } finally {
      setUploadingId(null);
    }
  };

  // ── Requirements modal handlers ─────────────────────────────────────────────

  const closeReqModal = () => {
    setReqModal(null);
    setReqFields([]);
    setReqPdfPages([]);
    setReqPageSizes([]);
    setReqHoveredIdx(null);
    reqStartedPages.current = new Set();
  };

  // Callback ref — renders a preview canvas the moment it mounts in the DOM,
  // avoiding the race condition where useEffect fires before canvases exist.
  const bindReqCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, pageIndex: number) => {
      reqCanvasRefs.current[pageIndex] = canvas;
      if (!canvas || reqStartedPages.current.has(pageIndex)) return;
      const page = reqPdfPagesRef.current[pageIndex];
      if (!page) return;
      reqStartedPages.current.add(pageIndex);
      const viewport = page.getViewport({ scale: PREVIEW_SCALE });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvas, viewport }).promise.catch(() => {});
    },
    [],
  );

  const openRequirements = async (form: FormTemplate) => {
    if (!form.pdfPath) {
      alert('Upload a PDF for this form first — field names are read directly from the PDF.');
      return;
    }
    setReqModal({ form });
    setReqLoading(true);
    reqStartedPages.current = new Set();
    try {
      const token = localStorage.getItem('carelink_token') ?? '';
      const res = await fetch(`/api/forms/${form.slug}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('fetch failed');

      const bytes = new Uint8Array(await res.arrayBuffer());

      // Load with pdfjs for preview rendering
      const pdfjsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      const loadedPages: pdfjsLib.PDFPageProxy[] = [];
      const sizes: { width: number; height: number }[] = [];
      for (let i = 1; i <= pdfjsDoc.numPages; i++) {
        const p = await pdfjsDoc.getPage(i);
        const vp = p.getViewport({ scale: PREVIEW_SCALE });
        loadedPages.push(p);
        sizes.push({ width: vp.width, height: vp.height });
      }
      setReqPdfPages(loadedPages);
      setReqPageSizes(sizes);

      // Load with pdf-lib to extract AcroForm field positions
      const pdfDoc = await PDFDocument.load(bytes.slice());
      const extracted = extractFieldMeta(pdfDoc);

      // Merge with any previously saved requirements
      const existingDefs = form.fieldDefinitions as FieldDefinition[];
      const existingByKey = new Map(existingDefs.map((d) => [d.key, d]));

      setReqFields(
        extracted.map((f) => {
          const ex = existingByKey.get(f.name);
          return {
            key: f.name,
            type: f.type,
            rect: f.rect,
            pageIndex: f.pageIndex,
            required: ex?.required ?? f.type === 'signature',
            requiredGroup: ex?.requiredGroup ?? '',
          };
        }),
      );
    } catch {
      alert('Could not load PDF fields. Make sure a PDF is uploaded for this form.');
      closeReqModal();
    } finally {
      setReqLoading(false);
    }
  };

  const updateReqField = (idx: number, patch: Partial<ReqFieldState>) => {
    setReqFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleSaveRequirements = async () => {
    if (!reqModal) return;
    setReqSaving(true);
    try {
      const fieldDefinitions: FieldDefinition[] = reqFields.map((f) => ({
        key: f.key,
        label: f.key,
        type: f.type as FieldType,
        required: f.required,
        ...(f.requiredGroup.trim() ? { requiredGroup: f.requiredGroup.trim().toLowerCase() } : {}),
      }));
      await adminApi.updateForm(reqModal.form.id, { fieldDefinitions });
      setReqModal(null);
      load();
    } catch {
      alert('Failed to save requirements. Please try again.');
    } finally {
      setReqSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden file input shared across all rows */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Form Template Management</h1>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Form Name</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Order</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">PDF</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Requirements</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => {
              const reqCount = (form.fieldDefinitions as FieldDefinition[]).filter((d) => d.required).length;
              return (
                <tr key={form.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!form.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{form.name}</p>
                    {form.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{form.description}</p>
                    )}
                    {uploadMessage?.id === form.id && (
                      <p className={`text-xs mt-1 font-medium ${uploadMessage.ok ? 'text-green-600' : 'text-red-500'}`}>
                        {uploadMessage.text}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center text-gray-500">{form.sortOrder}</td>
                  <td className="px-6 py-3 text-center">
                    {form.pdfPath ? (
                      <span className="text-xs text-green-600 font-medium">✓ Linked</span>
                    ) : (
                      <span className="text-xs text-amber-500 font-medium">No PDF</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {reqCount > 0 ? (
                      <span className="text-xs text-green-600 font-medium">{reqCount} required</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={form.isActive ? 'badge-completed' : 'badge-not-started'}>
                      {form.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openRequirements(form)}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Requirements
                      </button>
                      <button
                        onClick={() => openFilePicker(form.id)}
                        disabled={uploadingId === form.id}
                        className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
                      >
                        {uploadingId === form.id ? 'Uploading…' : 'Replace PDF'}
                      </button>
                      <button
                        onClick={() => handleToggleActive(form)}
                        className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                      >
                        {form.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        "Replace PDF" uploads a new template. In-progress counselor sessions are not affected. Required field settings apply to all sessions immediately.
      </p>

      {/* ── Requirements Modal (split: PDF preview left, field list right) ──── */}
      {reqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Required Fields</h2>
                <p className="text-sm text-gray-400 mt-0.5">{reqModal.form.name}</p>
              </div>
              <button onClick={closeReqModal} className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5">✕</button>
            </div>

            {reqLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Body — two columns */}
                <div className="flex flex-1 min-h-0">

                  {/* LEFT: PDF preview */}
                  <div className="w-[44%] border-r border-gray-100 overflow-y-auto bg-gray-50 p-4 space-y-3 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
                    {reqPageSizes.map((size, pi) => (
                      <div
                        key={pi}
                        ref={(el) => { reqPageDivRefs.current[pi] = el; }}
                        className="relative shadow border border-gray-200 bg-white overflow-hidden"
                        style={{ width: size.width }}
                      >
                        <canvas
                          ref={(el) => bindReqCanvas(el, pi)}
                          style={{ display: 'block' }}
                        />
                        {/* Field highlight overlays */}
                        {reqFields.map((f, fi) => {
                          if (f.pageIndex !== pi || (f.rect.width === 0 && f.rect.height === 0)) return null;
                          const left  = f.rect.x * PREVIEW_SCALE;
                          const top   = size.height - (f.rect.y + f.rect.height) * PREVIEW_SCALE;
                          const w     = f.rect.width  * PREVIEW_SCALE;
                          const h     = f.rect.height * PREVIEW_SCALE;
                          const hovered = reqHoveredIdx === fi;
                          const color = f.type === 'signature' ? '139,92,246' : f.type === 'checkbox' ? '59,130,246' : '16,185,129';
                          return (
                            <div
                              key={f.key}
                              style={{
                                position: 'absolute',
                                left, top, width: w, height: h,
                                background: hovered
                                  ? `rgba(${color},0.35)`
                                  : f.required ? `rgba(${color},0.12)` : 'rgba(156,163,175,0.08)',
                                border: hovered
                                  ? `2px solid rgba(${color},0.9)`
                                  : f.required ? `1px solid rgba(${color},0.4)` : 'none',
                                borderRadius: 2,
                                pointerEvents: 'none',
                                transition: 'background 0.1s, border 0.1s',
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* RIGHT: field checklist */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex-shrink-0">
                      <p className="text-xs text-amber-800">
                        Hover a row to highlight it in the preview. Signature fields are always required.
                        Give two "either/or" fields the <strong>same Group Tag</strong> — at least one must be filled.
                      </p>
                    </div>

                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                          <tr>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Field Name</th>
                            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Type</th>
                            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Required</th>
                            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">
                              Group Tag <span className="font-normal text-gray-400">(either/or)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqFields.map((f, i) => (
                            <tr
                              key={f.key}
                              className={`border-b border-gray-50 cursor-default transition-colors ${reqHoveredIdx === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                              onMouseEnter={() => {
                                setReqHoveredIdx(i);
                                reqPageDivRefs.current[f.pageIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              }}
                              onMouseLeave={() => setReqHoveredIdx(null)}
                            >
                              <td className="px-5 py-2.5 font-mono text-xs text-gray-700 max-w-[160px] truncate" title={f.key}>
                                {f.key}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  f.type === 'signature' ? 'bg-purple-50 text-purple-600'
                                  : f.type === 'checkbox' ? 'bg-blue-50 text-blue-600'
                                  : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {f.type}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={f.required}
                                  disabled={f.type === 'signature'}
                                  onChange={(e) => updateReqField(i, {
                                    required: e.target.checked,
                                    requiredGroup: e.target.checked ? f.requiredGroup : '',
                                  })}
                                  className="w-4 h-4 accent-primary disabled:opacity-40"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                {f.required && f.type !== 'signature' && (
                                  <input
                                    type="text"
                                    placeholder="e.g. location"
                                    value={f.requiredGroup}
                                    onChange={(e) => updateReqField(i, { requiredGroup: e.target.value })}
                                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder-gray-300"
                                  />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer inside the right panel */}
                    <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                      <p className="text-xs text-gray-400">
                        {reqFields.filter((f) => f.required).length} of {reqFields.length} fields marked required
                      </p>
                      <div className="flex gap-3">
                        <button onClick={closeReqModal} className="btn-ghost">Cancel</button>
                        <button onClick={handleSaveRequirements} disabled={reqSaving} className="btn-primary">
                          {reqSaving ? 'Saving…' : 'Save Requirements'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Suppress unused-var warnings — editor modal retained for future use */}
      <div style={{ display: 'none' }}>
        {String(modalOpen)}{String(saving)}
        {openCreate.toString()}{openEdit.toString()}
        {closeModal.toString()}{handleNameChange.toString()}
        {addField.toString()}{removeField.toString()}{updateField.toString()}
        {handleSave.toString()}{FIELD_TYPES.toString()}{String(editor.name)}
      </div>
    </div>
  );
}

// ── PDF field extraction with name, type, and PDF-coordinate position ──────────

interface FieldMeta {
  name: string;
  type: 'text' | 'checkbox' | 'signature';
  rect: { x: number; y: number; width: number; height: number };
  pageIndex: number;
}

function extractFieldMeta(pdfDoc: PDFDocument): FieldMeta[] {
  const pages = pdfDoc.getPages();
  const results: FieldMeta[] = [];
  const seen = new Set<string>();

  const fallbackRect = { x: 0, y: 0, width: 0, height: 0 };

  // Pass 1: text + checkbox fields via form API
  try {
    const form = pdfDoc.getForm();
    for (const field of form.getFields()) {
      try {
        const name = field.getName();
        if (seen.has(name)) continue;
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
        const ft = ftNode?.toString() ?? '/Tx';
        if (ft === '/Sig') continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const widgets: any[] = acro.getWidgets?.() ?? [];
        if (widgets.length === 0) continue;
        const widget = widgets[0];
        const rawRect = widget.getRectangle?.() as { x: number; y: number; width: number; height: number } | undefined;
        const rect = rawRect ?? fallbackRect;

        let pageIndex = 0;
        try {
          const pageRef = widget.P?.();
          if (pageRef) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pi = pages.findIndex((p) => (p as any).ref.toString() === pageRef.toString());
            if (pi >= 0) pageIndex = pi;
          }
        } catch { /* default page 0 */ }

        seen.add(name);
        results.push({ name, type: ft === '/Btn' ? 'checkbox' : 'text', rect, pageIndex });
      } catch { /* skip malformed field */ }
    }
  } catch { /* form API unavailable */ }

  // Pass 2: signature fields via annotation dicts
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
          } else continue;

          const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName);
          if (subtype?.toString() !== '/Widget') continue;

          let ftNode = dict.lookupMaybe(PDFName.of('FT'), PDFName);
          if (!ftNode) {
            const parentRef = dict.lookupMaybe(PDFName.of('Parent'), PDFRef);
            if (parentRef) {
              const parentDict = pdfDoc.context.lookupMaybe(parentRef, PDFDict);
              ftNode = parentDict?.lookupMaybe(PDFName.of('FT'), PDFName);
            }
          }
          if (ftNode?.toString() !== '/Sig') continue;

          const tNode = dict.lookupMaybe(PDFName.of('T'), PDFString);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const name: string = (tNode as any)?.decodeText?.() ?? tNode?.toString() ?? '';
          if (!name || seen.has(name)) continue;

          const rectArr = dict.lookupMaybe(PDFName.of('Rect'), PDFArray);
          let rect = fallbackRect;
          if (rectArr) {
            const x1 = (rectArr.get(0) as PDFNumber).asNumber();
            const y1 = (rectArr.get(1) as PDFNumber).asNumber();
            const x2 = (rectArr.get(2) as PDFNumber).asNumber();
            const y2 = (rectArr.get(3) as PDFNumber).asNumber();
            rect = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
          }

          seen.add(name);
          results.push({ name, type: 'signature', rect, pageIndex: pageIdx });
        } catch { /* skip bad annotation */ }
      }
    } catch { /* skip bad page */ }
  });

  return results;
}

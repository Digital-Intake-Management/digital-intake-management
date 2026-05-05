/**
 * services/sharepoint.ts
 * Writes exported PDF files to the configured SharePoint folder.
 *
 * In production, the SharePoint folder is mounted as a network share on the
 * server (e.g. via SMB/CIFS or OneDrive sync). This service treats it as a
 * normal file system path — no Graph API credentials required.
 *
 * Folder structure:
 *   {sharePointRoot}/{patientId}/{PatientID}_{FormName}_{YYYY-MM-DD}.pdf
 *
 * Example:
 *   /secure/carelink/intake-forms/PT-00001/PT-00001_Assessment_Disclosure_2026-05-04.pdf
 *
 * The root path is read from SystemConfig (set by admin in settings UI),
 * with a fallback to the SHAREPOINT_FOLDER env var.
 */

import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/database';

/**
 * Writes a single PDF to a per-patient subfolder inside the SharePoint root.
 * Creates both the root and patient subfolder if they don't exist yet.
 *
 * @param pdfBytes         - Raw PDF content as a Buffer
 * @param patientIdString  - e.g. "PT-00001"
 * @param formName         - Human-readable form name, e.g. "Assessment Disclosure"
 * @returns                  The absolute path where the file was written
 */
export async function uploadToSharePoint(
  pdfBytes: Buffer,
  patientIdString: string,
  formName: string,
): Promise<string> {
  const root = await getSharePointRoot();

  // One subfolder per patient so each patient's forms stay together
  const patientFolder = path.join(root, patientIdString);
  await fs.mkdir(patientFolder, { recursive: true });

  const filename = buildFilename(patientIdString, formName);
  const filePath = path.join(patientFolder, filename);

  await fs.writeFile(filePath, pdfBytes);

  return filePath;
}

/**
 * Builds the PDF filename to match the naming convention of the source forms:
 *   {PatientID}_{FormName}_{YYYY-MM-DD}.pdf
 *
 * Spaces → underscores; special characters stripped.
 * Example: "PT-00001_Assessment_Disclosure_2026-05-04.pdf"
 */
export function buildFilename(patientIdString: string, formName: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const safeName = formName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return `${patientIdString}_${safeName}_${date}.pdf`;
}

/**
 * Resolves the SharePoint root folder.
 * Priority: SystemConfig DB → SHAREPOINT_FOLDER env var → safe default.
 */
async function getSharePointRoot(): Promise<string> {
  const config = await prisma.systemConfig.findUnique({
    where: { configKey: 'sharepoint_folder_path' },
  });

  if (config?.configValue) return config.configValue;
  if (process.env.SHAREPOINT_FOLDER) return process.env.SHAREPOINT_FOLDER;

  return '/secure/carelink/intake-forms/';
}

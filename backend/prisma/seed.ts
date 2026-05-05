/// <reference types="node" />
/**
 * prisma/seed.ts
 * Run with: npm run db:seed
 * Seeds admin/counselor users and all 15 CareLink form templates linked to their PDF files.
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminPassword, role: UserRole.ADMIN },
  });
  console.log(`✅ Admin user: ${admin.username}`);

  // ── Default counselor ────────────────────────────────────────────────────────
  const counselorPassword = await bcrypt.hash('counselor123', 12);
  const counselor = await prisma.user.upsert({
    where: { username: 'counselor1' },
    update: {},
    create: { username: 'counselor1', passwordHash: counselorPassword, role: UserRole.COUNSELOR },
  });
  console.log(`✅ Counselor user: ${counselor.username}`);

  // ── Form templates — all 15 PDFs from the forms folder ──────────────────────
  // fieldDefinitions kept as [] — fields are now read directly from the PDF at runtime.
  const forms = [
    {
      name: 'Assessment Disclosure',
      slug: 'assessment-disclosure',
      description: 'Patient acknowledgment of assessment process',
      sortOrder: 1,
      pdfPath: 'Assessment Disclosure.pdf',
    },
    {
      name: 'Assessment Disclosure (Updated)',
      slug: 'assessment-disclosure-updated',
      description: 'Updated assessment disclosure form (July 2025)',
      sortOrder: 2,
      pdfPath: 'Assessment Disclosure 7 25.pdf',
    },
    {
      name: 'Authorization of Release',
      slug: 'authorization-of-release',
      description: 'Authorization to release medical information',
      sortOrder: 3,
      pdfPath: 'AUTHORIZATION OF RELEASE.pdf',
    },
    {
      name: 'Center Detox Policy',
      slug: 'center-detox-policy',
      description: 'Acknowledgment of center detox policies and procedures',
      sortOrder: 4,
      pdfPath: 'CENTER DETOX POLICY.pdf',
    },
    {
      name: 'Consent for Follow Up',
      slug: 'consent-for-follow-up',
      description: 'Patient consent for follow-up contact',
      sortOrder: 5,
      pdfPath: 'CONSENT FOR FOLLOW UP.pdf',
    },
    {
      name: 'Family Counseling',
      slug: 'family-counseling',
      description: 'Family counseling participation agreement',
      sortOrder: 6,
      pdfPath: 'FAMILY COUNSELING.pdf',
    },
    {
      name: 'Georgia Prescription Verification',
      slug: 'georgia-prescription-verification',
      description: 'Required Georgia state prescription drug monitoring verification',
      sortOrder: 7,
      pdfPath: 'Georgia Prescription Verification.pdf',
    },
    {
      name: 'HIV/AIDS Intake',
      slug: 'hiv-aids-intake',
      description: 'HIV/AIDS intake and education assessment',
      sortOrder: 8,
      pdfPath: 'HIV AIDS INTAKE.pdf',
    },
    {
      name: 'Methadone Call Back / Diversion Control',
      slug: 'methadone-call-back',
      description: 'Methadone call back and diversion control form',
      sortOrder: 9,
      pdfPath: 'METHADONE CALL BACK DIVERSION CONTROL FORM.pdf',
    },
    {
      name: 'Patient Referral Form',
      slug: 'patient-referral',
      description: 'Patient referral to external services',
      sortOrder: 10,
      pdfPath: 'PATIENT REFERRAL FORM.pdf',
    },
    {
      name: 'Patient Admission Form',
      slug: 'patient-admission-form',
      description: 'Patient admission form (July 2025)',
      sortOrder: 11,
      pdfPath: 'Patient Admission Form 7 25.pdf',
    },
    {
      name: 'Patient Re-Admit Form',
      slug: 'patient-readmit-form',
      description: 'Patient re-admission form',
      sortOrder: 12,
      pdfPath: 'Patient Re-Admit Form.pdf',
    },
    {
      name: 'Pregnancy Treatment Notification',
      slug: 'pregnancy-treatment-notification',
      description: 'Pregnancy treatment notification form',
      sortOrder: 13,
      pdfPath: 'Pregnancy Treatment Notification Form.pdf',
    },
    {
      name: 'Assignment of Benefits / TB Consent',
      slug: 'assignment-of-benefits',
      description: 'Assignment of benefits and tuberculosis consent',
      sortOrder: 14,
      pdfPath: 'Assignment of Benefits Form and Tuberculosis Consent.pdf',
    },
    {
      name: 'Medical History Examination',
      slug: 'medical-history-examination',
      description: 'Examination, medical history, and evaluation (July 2025)',
      sortOrder: 15,
      pdfPath: 'Examination -Medical History - Evaluation 7 25.pdf',
    },
  ];

  for (const form of forms) {
    await prisma.formTemplate.upsert({
      where: { slug: form.slug },
      update: { name: form.name, description: form.description, sortOrder: form.sortOrder, pdfPath: form.pdfPath },
      create: { ...form, fieldDefinitions: [] },
    });
    console.log(`✅ Form: ${form.name}`);
  }

  // ── Default system config ────────────────────────────────────────────────────
  const configs = [
    { configKey: 'sharepoint_folder_path', configValue: '/Users/denni/Desktop/carelink-demo-output/' },
    { configKey: 'weekly_report_email', configValue: 'dennise.gonzalezgarcia@gmail.com' },
    { configKey: 'pdf_naming_convention', configValue: '{patientId}_{formName}_{date}.pdf' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { configKey: config.configKey },
      update: {},
      create: config,
    });
  }
  console.log('✅ System config seeded');

  console.log('\n🎉 Seed complete!');
  console.log('Default credentials:');
  console.log('  Admin     → username: admin       / password: admin123');
  console.log('  Counselor → username: counselor1  / password: counselor123');
  console.log('\n⚠️  Change these passwords before deploying to production!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

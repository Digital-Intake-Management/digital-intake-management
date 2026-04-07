/**
 * prisma/seed.ts
 * Run with: npm run db:seed
 * Seeds the database with an admin user and the 6 default form templates from CareLink.
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
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ Admin user created: ${admin.username}`);

  // ── Default counselor ────────────────────────────────────────────────────────
  const counselorPassword = await bcrypt.hash('counselor123', 12);
  const counselor = await prisma.user.upsert({
    where: { username: 'counselor1' },
    update: {},
    create: {
      username: 'counselor1',
      passwordHash: counselorPassword,
      role: UserRole.COUNSELOR,
    },
  });
  console.log(`✅ Counselor user created: ${counselor.username}`);

  // ── Form templates (from CareLink's actual intake forms) ─────────────────────
  // Field definitions follow this shape:
  // { key: string, label: string, type: 'text'|'checkbox'|'radio'|'date'|'signature', required: boolean }

  const forms = [
    {
      name: 'Assessment Disclosure',
      slug: 'assessment-disclosure',
      description: 'Patient acknowledgment of assessment process',
      sortOrder: 1,
      fieldDefinitions: [
        { key: 'patient_name', label: "Patient's Name", type: 'text', required: true },
        { key: 'patient_address', label: "Patient's Address", type: 'text', required: true },
        { key: 'patient_dob', label: "Patient's Date of Birth", type: 'date', required: true },
        { key: 'counselor_name', label: 'Counselor Name', type: 'text', required: true },
        { key: 'patient_signature', label: 'Patient Signature', type: 'signature', required: true },
        { key: 'counselor_signature', label: 'Counselor Signature', type: 'signature', required: true },
      ],
    },
    {
      name: 'Authorization of Release',
      slug: 'authorization-of-release',
      description: 'Authorization to release medical information',
      sortOrder: 2,
      fieldDefinitions: [
        { key: 'patient_name', label: "Patient's Name", type: 'text', required: true },
        { key: 'release_to', label: 'Release Information To', type: 'text', required: true },
        { key: 'patient_signature', label: 'Patient Signature', type: 'signature', required: true },
        { key: 'counselor_signature', label: 'Counselor Signature', type: 'signature', required: true },
      ],
    },
    {
      name: 'Center Detox Policy',
      slug: 'center-detox-policy',
      description: 'Acknowledgment of center detox policies and procedures',
      sortOrder: 3,
      fieldDefinitions: [
        { key: 'patient_name', label: "Patient's Name", type: 'text', required: true },
        { key: 'policy_understood', label: 'I understand the detox policies', type: 'checkbox', required: true },
        { key: 'no_contraband', label: 'I agree not to bring contraband', type: 'checkbox', required: true },
        { key: 'medication_policy', label: 'I understand the medication policy', type: 'checkbox', required: true },
        { key: 'patient_signature', label: 'Patient Signature', type: 'signature', required: true },
        { key: 'counselor_signature', label: 'Counselor Signature', type: 'signature', required: true },
      ],
    },
    {
      name: 'Consent for Follow Up',
      slug: 'consent-for-follow-up',
      description: 'Patient consent for follow-up contact',
      sortOrder: 4,
      fieldDefinitions: [
        { key: 'patient_name', label: "Patient's Name", type: 'text', required: true },
        { key: 'contact_phone', label: 'Preferred Contact Phone', type: 'text', required: false },
        { key: 'consent_given', label: 'I consent to follow-up contact', type: 'checkbox', required: true },
        { key: 'patient_signature', label: 'Patient Signature', type: 'signature', required: true },
      ],
    },
    {
      name: 'Family Counseling',
      slug: 'family-counseling',
      description: 'Family counseling participation agreement',
      sortOrder: 5,
      fieldDefinitions: [
        { key: 'patient_name', label: "Patient's Name", type: 'text', required: true },
        { key: 'family_member', label: 'Family Member Participating', type: 'text', required: false },
        { key: 'patient_signature', label: 'Patient Signature', type: 'signature', required: true },
        { key: 'counselor_signature', label: 'Counselor Signature', type: 'signature', required: true },
      ],
    },
    {
      name: 'Georgia Prescription Verification',
      slug: 'georgia-prescription-verification',
      description: 'Required Georgia state prescription drug monitoring verification',
      sortOrder: 6,
      fieldDefinitions: [
        { key: 'patient_name', label: "Patient's Name", type: 'text', required: true },
        { key: 'patient_address', label: "Patient's Address", type: 'text', required: true },
        { key: 'patient_dob', label: "Patient's Birthday", type: 'date', required: true },
        { key: 'id_card', label: 'ID Card #', type: 'text', required: true },
        { key: 'counselor_signature', label: 'Counselor Signature', type: 'signature', required: true },
      ],
    },
  ];

  for (const form of forms) {
    await prisma.formTemplate.upsert({
      where: { slug: form.slug },
      update: {},
      create: form,
    });
    console.log(`✅ Form template: ${form.name}`);
  }

  // ── Default system config ────────────────────────────────────────────────────
  const configs = [
    { configKey: 'sharepoint_folder_path', configValue: '/secure/carelink/intake-forms/' },
    { configKey: 'weekly_report_email', configValue: 'admin@carelink-georgia.org' },
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
  console.log('  Admin    → username: admin      / password: admin123');
  console.log('  Counselor→ username: counselor1 / password: counselor123');
  console.log('\n⚠️  Change these passwords before deploying to production!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('COUNSELOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'LINKED_IN_METHASOFT');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'COUNSELOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_ids" (
    "id" TEXT NOT NULL,
    "patient_id_string" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "patient_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_sessions" (
    "id" TEXT NOT NULL,
    "session_code" TEXT NOT NULL,
    "patient_id_string" TEXT NOT NULL,
    "counselor_id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "methasoft_linked_at" TIMESTAMP(3),
    "pdf_export_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "intake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "field_definitions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_forms" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "form_template_id" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_field_values" (
    "id" TEXT NOT NULL,
    "session_form_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "action" TEXT NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "patient_ids_patient_id_string_key" ON "patient_ids"("patient_id_string");

-- CreateIndex
CREATE UNIQUE INDEX "intake_sessions_session_code_key" ON "intake_sessions"("session_code");

-- CreateIndex
CREATE UNIQUE INDEX "form_templates_slug_key" ON "form_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "session_forms_session_id_form_template_id_key" ON "session_forms"("session_id", "form_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_field_values_session_form_id_field_key_key" ON "form_field_values"("session_form_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_config_key_key" ON "system_config"("config_key");

-- AddForeignKey
ALTER TABLE "patient_ids" ADD CONSTRAINT "patient_ids_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_patient_id_string_fkey" FOREIGN KEY ("patient_id_string") REFERENCES "patient_ids"("patient_id_string") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_counselor_id_fkey" FOREIGN KEY ("counselor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_forms" ADD CONSTRAINT "session_forms_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "intake_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_forms" ADD CONSTRAINT "session_forms_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_field_values" ADD CONSTRAINT "form_field_values_session_form_id_fkey" FOREIGN KEY ("session_form_id") REFERENCES "session_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "intake_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

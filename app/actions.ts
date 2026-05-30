"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { db } from "@/db";
import {
  activityLogs,
  caseActions,
  clients,
  documents,
  financeEntries,
  hearings,
  legalCases,
  rolePermissions,
  tasks,
  users,
} from "@/db/schema";
import {
  UPLOAD_ROOT,
  caseActionSchema,
  clientSchema,
  createSession,
  destroySession,
  documentSchema,
  ensureSystemSeeded,
  financeSchema,
  getFirstError,
  getFormBoolean,
  getFormString,
  getUploadPath,
  hashPassword,
  logActivity,
  makeDashboardUrl,
  parseSection,
  permissionSchema,
  requireModulePermission,
  taskSchema,
  userSchema,
  verifyPassword,
  legalCaseSchema,
  hearingSchema,
  type SectionKey,
} from "@/lib/core";

function getSection(formData: FormData, fallback: SectionKey) {
  return parseSection(getFormString(formData, "redirectSection") || fallback);
}

function redirectWithError(section: SectionKey, error: unknown) {
  redirect(makeDashboardUrl(section, { error: getFirstError(error) }));
}

function rethrowIfRedirectError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

function successRedirect(section: SectionKey, message: string) {
  revalidatePath("/dashboard");
  redirect(makeDashboardUrl(section, { success: message }));
}

export async function loginAction(formData: FormData) {
  await ensureSystemSeeded();

  const loginSchema = z.object({
    email: z.string().trim().email("البريد الإلكتروني غير صحيح"),
    password: z.string().trim().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  });

  try {
    const data = loginSchema.parse({
      email: getFormString(formData, "email"),
      password: getFormString(formData, "password"),
    });

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, data.email), eq(users.active, true)));

    if (!user) {
      redirect("/login?error=invalid");
    }

    const passwordMatches = await verifyPassword(data.password, user.passwordHash);
    if (!passwordMatches) {
      redirect("/login?error=invalid");
    }

    await createSession(user.id);
    await logActivity(user.id, "login", "auth", user.id, `تسجيل دخول ناجح للمستخدم ${user.fullName}`);
    redirect("/dashboard?section=overview&success=welcome");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/login?error=${encodeURIComponent(getFirstError(error))}`);
  }
}

export async function logoutAction() {
  const context = await requireModulePermission("dashboard", "view");
  await logActivity(context.user.id, "logout", "auth", context.user.id, `تسجيل خروج المستخدم ${context.user.fullName}`);
  await destroySession();
  redirect("/login?success=logout");
}

export async function upsertClientAction(formData: FormData) {
  const section = getSection(formData, "clients");
  const id = getFormString(formData, "id");
  const context = await requireModulePermission("clients", id ? "edit" : "create");

  try {
    const data = clientSchema.parse({
      id,
      fullName: getFormString(formData, "fullName"),
      identityNumber: getFormString(formData, "identityNumber"),
      phone: getFormString(formData, "phone"),
      email: getFormString(formData, "email"),
      address: getFormString(formData, "address"),
      notes: getFormString(formData, "notes"),
    });

    if (data.id) {
      await db
        .update(clients)
        .set({
          fullName: data.fullName,
          identityNumber: data.identityNumber,
          phone: data.phone,
          email: data.email || null,
          address: data.address,
          notes: data.notes,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, data.id));

      await logActivity(context.user.id, "update", "client", data.id, `تم تحديث بيانات العميل ${data.fullName}`);
      successRedirect(section, "client-updated");
    }

    const [created] = await db
      .insert(clients)
      .values({
        fullName: data.fullName,
        identityNumber: data.identityNumber,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        notes: data.notes,
      })
      .returning({ id: clients.id });

    await logActivity(context.user.id, "create", "client", created.id, `تم إنشاء عميل جديد باسم ${data.fullName}`);
    successRedirect(section, "client-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteClientAction(formData: FormData) {
  const section = getSection(formData, "clients");
  const context = await requireModulePermission("clients", "delete");
  const id = getFormString(formData, "id");

  if (!id) redirectWithError(section, new Error("معرف العميل غير صالح"));

  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) redirectWithError(section, new Error("العميل غير موجود"));

  await db.delete(clients).where(eq(clients.id, id));
  await logActivity(context.user.id, "delete", "client", id, `تم حذف العميل ${client.fullName}`);
  successRedirect(section, "client-deleted");
}

export async function upsertCaseAction(formData: FormData) {
  const section = getSection(formData, "cases");
  const id = getFormString(formData, "id");
  const context = await requireModulePermission("cases", id ? "edit" : "create");

  try {
    const data = legalCaseSchema.parse({
      id,
      caseNumber: getFormString(formData, "caseNumber"),
      caseName: getFormString(formData, "caseName"),
      caseType: getFormString(formData, "caseType"),
      court: getFormString(formData, "court"),
      circuit: getFormString(formData, "circuit"),
      status: getFormString(formData, "status"),
      startDate: getFormString(formData, "startDate"),
      clientId: getFormString(formData, "clientId"),
      lawyerId: getFormString(formData, "lawyerId"),
      opponent: getFormString(formData, "opponent"),
      details: getFormString(formData, "details"),
    });

    if (data.id) {
      await db
        .update(legalCases)
        .set({
          caseNumber: data.caseNumber,
          caseName: data.caseName,
          caseType: data.caseType,
          court: data.court,
          circuit: data.circuit,
          status: data.status,
          startDate: data.startDate,
          clientId: data.clientId,
          lawyerId: data.lawyerId,
          opponent: data.opponent,
          details: data.details,
          updatedAt: new Date(),
        })
        .where(eq(legalCases.id, data.id));

      await logActivity(context.user.id, "update", "case", data.id, `تم تحديث القضية ${data.caseNumber}`);
      successRedirect(section, "case-updated");
    }

    const [created] = await db
      .insert(legalCases)
      .values({
        caseNumber: data.caseNumber,
        caseName: data.caseName,
        caseType: data.caseType,
        court: data.court,
        circuit: data.circuit,
        status: data.status,
        startDate: data.startDate,
        clientId: data.clientId,
        lawyerId: data.lawyerId,
        opponent: data.opponent,
        details: data.details,
      })
      .returning({ id: legalCases.id });

    await logActivity(context.user.id, "create", "case", created.id, `تم إنشاء القضية ${data.caseNumber}`);
    successRedirect(section, "case-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteCaseAction(formData: FormData) {
  const section = getSection(formData, "cases");
  const context = await requireModulePermission("cases", "delete");
  const id = getFormString(formData, "id");
  if (!id) redirectWithError(section, new Error("معرف القضية غير صالح"));

  const [record] = await db.select().from(legalCases).where(eq(legalCases.id, id));
  if (!record) redirectWithError(section, new Error("القضية غير موجودة"));

  await db.delete(legalCases).where(eq(legalCases.id, id));
  await logActivity(context.user.id, "delete", "case", id, `تم حذف القضية ${record.caseNumber}`);
  successRedirect(section, "case-deleted");
}

export async function addCaseActionLogAction(formData: FormData) {
  const section = getSection(formData, "cases");
  const context = await requireModulePermission("cases", "edit");

  try {
    const data = caseActionSchema.parse({
      caseId: getFormString(formData, "caseId"),
      actionTitle: getFormString(formData, "actionTitle"),
      details: getFormString(formData, "details"),
      actionDate: getFormString(formData, "actionDate"),
    });

    const [created] = await db
      .insert(caseActions)
      .values({
        caseId: data.caseId,
        actionTitle: data.actionTitle,
        details: data.details,
        actionDate: data.actionDate,
        createdBy: context.user.id,
      })
      .returning({ id: caseActions.id });

    await logActivity(context.user.id, "create", "case-action", created.id, `تمت إضافة إجراء للقضية ${data.caseId}`);
    successRedirect(section, "case-action-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function upsertHearingAction(formData: FormData) {
  const section = getSection(formData, "hearings");
  const id = getFormString(formData, "id");
  const context = await requireModulePermission("hearings", id ? "edit" : "create");

  try {
    const data = hearingSchema.parse({
      id,
      hearingDate: getFormString(formData, "hearingDate"),
      hearingTime: getFormString(formData, "hearingTime"),
      court: getFormString(formData, "court"),
      hall: getFormString(formData, "hall"),
      caseId: getFormString(formData, "caseId"),
      lawyerId: getFormString(formData, "lawyerId"),
      result: getFormString(formData, "result"),
      notes: getFormString(formData, "notes"),
      reminderMinutes: getFormString(formData, "reminderMinutes"),
      status: getFormString(formData, "status"),
    });

    if (data.id) {
      await db
        .update(hearings)
        .set({
          hearingDate: data.hearingDate,
          hearingTime: data.hearingTime,
          court: data.court,
          hall: data.hall,
          caseId: data.caseId,
          lawyerId: data.lawyerId,
          result: data.result,
          notes: data.notes,
          reminderMinutes: data.reminderMinutes,
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(hearings.id, data.id));

      await logActivity(context.user.id, "update", "hearing", data.id, `تم تحديث جلسة مرتبطة بالقضية ${data.caseId}`);
      successRedirect(section, "hearing-updated");
    }

    const [created] = await db
      .insert(hearings)
      .values({
        hearingDate: data.hearingDate,
        hearingTime: data.hearingTime,
        court: data.court,
        hall: data.hall,
        caseId: data.caseId,
        lawyerId: data.lawyerId,
        result: data.result,
        notes: data.notes,
        reminderMinutes: data.reminderMinutes,
        status: data.status,
      })
      .returning({ id: hearings.id });

    await logActivity(context.user.id, "create", "hearing", created.id, `تمت إضافة جلسة جديدة للقضية ${data.caseId}`);
    successRedirect(section, "hearing-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteHearingAction(formData: FormData) {
  const section = getSection(formData, "hearings");
  const context = await requireModulePermission("hearings", "delete");
  const id = getFormString(formData, "id");
  if (!id) redirectWithError(section, new Error("معرف الجلسة غير صالح"));

  await db.delete(hearings).where(eq(hearings.id, id));
  await logActivity(context.user.id, "delete", "hearing", id, "تم حذف جلسة من النظام");
  successRedirect(section, "hearing-deleted");
}

export async function upsertTaskAction(formData: FormData) {
  const section = getSection(formData, "tasks");
  const id = getFormString(formData, "id");
  const context = await requireModulePermission("tasks", id ? "edit" : "create");

  try {
    const data = taskSchema.parse({
      id,
      title: getFormString(formData, "title"),
      description: getFormString(formData, "description"),
      assigneeId: getFormString(formData, "assigneeId"),
      priority: getFormString(formData, "priority"),
      dueDate: getFormString(formData, "dueDate"),
      status: getFormString(formData, "status"),
      alertBeforeMinutes: getFormString(formData, "alertBeforeMinutes"),
    });

    const dueDate = new Date(data.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new Error("تاريخ الاستحقاق غير صحيح");
    }

    if (data.id) {
      await db
        .update(tasks)
        .set({
          title: data.title,
          description: data.description,
          assigneeId: data.assigneeId,
          priority: data.priority,
          dueDate,
          status: data.status,
          alertBeforeMinutes: data.alertBeforeMinutes,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, data.id));

      await logActivity(context.user.id, "update", "task", data.id, `تم تحديث المهمة ${data.title}`);
      successRedirect(section, "task-updated");
    }

    const [created] = await db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        priority: data.priority,
        dueDate,
        status: data.status,
        alertBeforeMinutes: data.alertBeforeMinutes,
      })
      .returning({ id: tasks.id });

    await logActivity(context.user.id, "create", "task", created.id, `تم إنشاء المهمة ${data.title}`);
    successRedirect(section, "task-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteTaskAction(formData: FormData) {
  const section = getSection(formData, "tasks");
  const context = await requireModulePermission("tasks", "delete");
  const id = getFormString(formData, "id");
  if (!id) redirectWithError(section, new Error("معرف المهمة غير صالح"));

  await db.delete(tasks).where(eq(tasks.id, id));
  await logActivity(context.user.id, "delete", "task", id, "تم حذف مهمة من النظام");
  successRedirect(section, "task-deleted");
}

export async function uploadDocumentAction(formData: FormData) {
  const section = getSection(formData, "documents");
  const context = await requireModulePermission("documents", "create");

  try {
    const meta = documentSchema.parse({
      category: getFormString(formData, "category"),
      clientId: getFormString(formData, "clientId"),
      caseId: getFormString(formData, "caseId"),
    });

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      throw new Error("يرجى اختيار ملف صالح للرفع");
    }

    const allowedTypes = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    if (!allowedTypes.has(fileEntry.type)) {
      throw new Error("نوع الملف غير مدعوم. المسموح PDF وصور و Word فقط");
    }

    if (fileEntry.size > 8 * 1024 * 1024) {
      throw new Error("حجم الملف يجب ألا يتجاوز 8MB");
    }

    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
    const safeName = fileEntry.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const storedName = `${randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_ROOT, storedName), buffer);

    const [created] = await db
      .insert(documents)
      .values({
        originalName: fileEntry.name,
        storedName,
        mimeType: fileEntry.type,
        size: fileEntry.size,
        category: meta.category,
        clientId: meta.clientId,
        caseId: meta.caseId,
        uploadedBy: context.user.id,
      })
      .returning({ id: documents.id });

    await logActivity(context.user.id, "upload", "document", created.id, `تم رفع مستند ${fileEntry.name}`);
    successRedirect(section, "document-uploaded");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteDocumentAction(formData: FormData) {
  const section = getSection(formData, "documents");
  const context = await requireModulePermission("documents", "delete");
  const id = getFormString(formData, "id");
  if (!id) redirectWithError(section, new Error("معرف المستند غير صالح"));

  const [record] = await db.select().from(documents).where(eq(documents.id, id));
  if (!record) redirectWithError(section, new Error("المستند غير موجود"));

  try {
    await fs.unlink(getUploadPath(record.storedName));
  } catch {
    // Ignore missing file on disk.
  }

  await db.delete(documents).where(eq(documents.id, id));
  await logActivity(context.user.id, "delete", "document", id, `تم حذف المستند ${record.originalName}`);
  successRedirect(section, "document-deleted");
}

export async function upsertFinanceAction(formData: FormData) {
  const section = getSection(formData, "finance");
  const id = getFormString(formData, "id");
  const context = await requireModulePermission("finance", id ? "edit" : "create");

  try {
    const approved = getFormBoolean(formData, "approved");
    if (approved && !(context.user.role === "admin" || context.permissions.finance.approve)) {
      throw new Error("ليس لديك صلاحية اعتماد السجلات المالية");
    }

    const data = financeSchema.parse({
      id,
      entryType: getFormString(formData, "entryType"),
      title: getFormString(formData, "title"),
      amount: getFormString(formData, "amount"),
      clientId: getFormString(formData, "clientId"),
      caseId: getFormString(formData, "caseId"),
      status: getFormString(formData, "status"),
      dueDate: getFormString(formData, "dueDate"),
      notes: getFormString(formData, "notes"),
      approved,
    });

    const payload = {
      entryType: data.entryType,
      title: data.title,
      amount: data.amount.toFixed(2),
      clientId: data.clientId,
      caseId: data.caseId,
      status: data.approved ? "approved" : data.status,
      dueDate: data.dueDate,
      notes: data.notes,
      approved: data.approved,
      createdBy: context.user.id,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db.update(financeEntries).set(payload).where(eq(financeEntries.id, data.id));
      await logActivity(context.user.id, "update", "finance", data.id, `تم تحديث السجل المالي ${data.title}`);
      successRedirect(section, "finance-updated");
    }

    const [created] = await db
      .insert(financeEntries)
      .values({ ...payload, createdBy: context.user.id })
      .returning({ id: financeEntries.id });

    await logActivity(context.user.id, "create", "finance", created.id, `تم إنشاء سجل مالي ${data.title}`);
    successRedirect(section, "finance-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteFinanceAction(formData: FormData) {
  const section = getSection(formData, "finance");
  const context = await requireModulePermission("finance", "delete");
  const id = getFormString(formData, "id");
  if (!id) redirectWithError(section, new Error("معرف السجل المالي غير صالح"));

  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  await logActivity(context.user.id, "delete", "finance", id, "تم حذف سجل مالي من النظام");
  successRedirect(section, "finance-deleted");
}

export async function upsertUserAction(formData: FormData) {
  const section = getSection(formData, "users");
  const id = getFormString(formData, "id");
  const context = await requireModulePermission("users", id ? "edit" : "create");

  try {
    const data = userSchema.parse({
      id,
      fullName: getFormString(formData, "fullName"),
      email: getFormString(formData, "email"),
      phone: getFormString(formData, "phone"),
      role: getFormString(formData, "role"),
      password: getFormString(formData, "password"),
      active: getFormBoolean(formData, "active"),
    });

    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(data.id ? and(eq(users.email, data.email), ne(users.id, data.id)) : eq(users.email, data.email));

    if (duplicate) {
      throw new Error("البريد الإلكتروني مستخدم بالفعل");
    }

    if (data.id) {
      const updates: Partial<typeof users.$inferInsert> = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
        active: data.active,
        updatedAt: new Date(),
      };
      if (data.password) {
        updates.passwordHash = await hashPassword(data.password);
      }

      await db.update(users).set(updates).where(eq(users.id, data.id));
      await logActivity(context.user.id, "update", "user", data.id, `تم تحديث المستخدم ${data.fullName}`);
      successRedirect(section, "user-updated");
    }

    const [created] = await db
      .insert(users)
      .values({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        active: data.active,
      })
      .returning({ id: users.id });

    await logActivity(context.user.id, "create", "user", created.id, `تم إنشاء مستخدم جديد ${data.fullName}`);
    successRedirect(section, "user-created");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

export async function deleteUserAction(formData: FormData) {
  const section = getSection(formData, "users");
  const context = await requireModulePermission("users", "delete");
  const id = getFormString(formData, "id");
  if (!id) redirectWithError(section, new Error("معرف المستخدم غير صالح"));
  if (id === context.user.id) redirectWithError(section, new Error("لا يمكن حذف المستخدم الحالي"));

  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) redirectWithError(section, new Error("المستخدم غير موجود"));

  await db.delete(users).where(eq(users.id, id));
  await logActivity(context.user.id, "delete", "user", id, `تم حذف المستخدم ${target.fullName}`);
  successRedirect(section, "user-deleted");
}

export async function updateRolePermissionAction(formData: FormData) {
  const section = getSection(formData, "users");
  const context = await requireModulePermission("users", "approve");

  try {
    const incoming = permissionSchema.parse({
      role: getFormString(formData, "role"),
      module: getFormString(formData, "module"),
      canView: getFormBoolean(formData, "canView"),
      canCreate: getFormBoolean(formData, "canCreate"),
      canEdit: getFormBoolean(formData, "canEdit"),
      canDelete: getFormBoolean(formData, "canDelete"),
      canPrint: getFormBoolean(formData, "canPrint"),
      canExport: getFormBoolean(formData, "canExport"),
      canApprove: getFormBoolean(formData, "canApprove"),
    });

    const payload = incoming.role === "admin"
      ? {
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canPrint: true,
          canExport: true,
          canApprove: true,
        }
      : {
          canView: incoming.canView,
          canCreate: incoming.canCreate,
          canEdit: incoming.canEdit,
          canDelete: incoming.canDelete,
          canPrint: incoming.canPrint,
          canExport: incoming.canExport,
          canApprove: incoming.canApprove,
        };

    const [existing] = await db
      .select({ id: rolePermissions.id })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.role, incoming.role), eq(rolePermissions.module, incoming.module)));

    if (existing) {
      await db.update(rolePermissions).set(payload).where(eq(rolePermissions.id, existing.id));
    } else {
      await db.insert(rolePermissions).values({ id: randomUUID(), role: incoming.role, module: incoming.module, ...payload });
    }

    await logActivity(
      context.user.id,
      "approve",
      "permission",
      `${incoming.role}:${incoming.module}`,
      `تم تحديث صلاحيات الدور ${incoming.role} لوحدة ${incoming.module}`,
    );
    successRedirect(section, "permission-updated");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithError(section, error);
  }
}

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { appTasks } from "@/lib/db/schema";
import { env } from "@/lib/env";

const createTaskSchema = z.object({
  title: z.string().trim().min(2),
  responsible: z.string().trim().min(2),
  dueDate: z.string().trim().min(8),
  description: z.string().trim().optional(),
  priority: z.string().trim().default("Media"),
  category: z.string().trim().default("Comercial"),
  status: z.string().trim().default("A Fazer"),
});

const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});

function serializeTask(task: typeof appTasks.$inferSelect) {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "Atividade criada manualmente.",
    responsible: task.responsibleName,
    priority: task.priority,
    dueDate: task.dueDate,
    category: task.category,
    status: task.status,
  };
}

export async function GET() {
  try {
    const tasks = await db
      .select()
      .from(appTasks)
      .where(eq(appTasks.isDeleted, false))
      .orderBy(desc(appTasks.createdAt))
      .limit(500);

    return NextResponse.json({ ok: true, tasks: tasks.map(serializeTask) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar tarefas.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = createTaskSchema.parse(await request.json());
    const [task] = await db
      .insert(appTasks)
      .values({
        title: input.title,
        description: input.description ?? "Atividade criada manualmente.",
        responsibleName: input.responsible,
        priority: input.priority,
        dueDate: input.dueDate,
        category: input.category,
        status: input.status,
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .returning();

    return NextResponse.json({ ok: true, task: serializeTask(task) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_task", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao criar tarefa.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const input = deleteTaskSchema.parse(await request.json());
    const [task] = await db
      .update(appTasks)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .where(and(eq(appTasks.id, input.id), eq(appTasks.isDeleted, false)))
      .returning();

    if (!task) {
      return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: task.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_task_delete", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao excluir tarefa.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

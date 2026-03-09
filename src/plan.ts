import * as v from "valibot";

const TaskSchema = v.object({
  id: v.string(),
  passes: v.boolean(),
  category: v.optional(v.string()),
  description: v.string(),
  steps: v.array(v.string()),
});

const PhaseSchema = v.object({
  id: v.string(),
  title: v.string(),
  userStories: v.optional(v.array(v.number())),
  narrative: v.optional(v.string()),
  tasks: v.array(TaskSchema),
});

export const PlanSchema = v.object({
  branchName: v.string(),
  description: v.string(),
  sourcePrd: v.optional(v.string()),
  architecturalDecisions: v.optional(
    v.array(v.object({ area: v.string(), decision: v.string() })),
  ),
  phases: v.array(PhaseSchema),
});

export type Plan = v.InferOutput<typeof PlanSchema>;

export async function readPlan(path: string): Promise<Plan> {
  return v.parse(PlanSchema, await Bun.file(path).json());
}

/** Flatten all tasks across phases into a single array for the loop. */
export function allTasks(plan: Plan) {
  return plan.phases.flatMap((p) => p.tasks);
}

import * as v from "valibot";

const TaskSchema = v.object({
  id: v.string(),
  passes: v.boolean(),
  category: v.optional(v.string()),
  description: v.string(),
  steps: v.array(v.string()),
});

export const SpecSchema = v.object({
  branchName: v.string(),
  description: v.string(),
  tasks: v.array(TaskSchema),
});

export type Spec = v.InferOutput<typeof SpecSchema>;

export async function readSpec(path: string): Promise<Spec> {
  return v.parse(SpecSchema, await Bun.file(path).json());
}

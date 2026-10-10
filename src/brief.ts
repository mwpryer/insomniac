export type Brief =
  | { status: "task"; id: string; title: string }
  | { status: "done" | "blocked"; reason: string };

export function parseBrief(text: string): Brief {
  const [header = "", ...rest] = text.trim().split(/\n\s*\n/);
  const fields = new Map<string, string>();
  for (const line of header.split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      fields.set(line.slice(0, colon), line.slice(colon + 1).trim());
    }
  }
  const status = fields.get("status");
  if (status === "task") {
    const id = fields.get("id");
    const title = fields.get("title");
    if (!id || !title) {
      throw new Error("Brief with status task needs id and title");
    }
    return { status, id, title };
  }
  if (status === "done" || status === "blocked") {
    return { status, reason: rest.join("\n\n").trim() };
  }
  throw new Error(
    `Brief status must be task, done or blocked, got "${status}"`,
  );
}

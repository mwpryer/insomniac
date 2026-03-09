export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ensureCleanWorkingTree(): void {
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    stdout: "pipe",
  });
  if (status.stdout.toString().trim()) {
    console.error(
      "Working tree is not clean. Commit or stash changes before running insomniac.",
    );
    process.exit(1);
  }
}

export function checkoutOrCreateBranch(branch: string): void {
  const checkout = Bun.spawnSync(["git", "checkout", branch], {
    stderr: "pipe",
  });
  if (checkout.exitCode !== 0) {
    const create = Bun.spawnSync(["git", "checkout", "-b", branch], {
      stderr: "pipe",
    });
    if (create.exitCode !== 0) {
      console.error(`Failed to checkout branch: ${branch}`);
      process.exit(1);
    }
  }
}

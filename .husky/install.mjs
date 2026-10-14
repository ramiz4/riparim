import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// prepare also runs for deployment installs and source archives without Git.
if (
  process.env.HUSKY === "0" ||
  (process.env.CI && !["0", "false"].includes(process.env.CI)) ||
  process.env.NODE_ENV === "production" ||
  process.env.npm_config_omit?.split(/\s+/).includes("dev") ||
  !existsSync(".git") ||
  !existsSync("node_modules/husky")
) {
  process.exit(0);
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
}

const gitDir = path.resolve(git(["rev-parse", "--git-dir"]));
const commonDir = path.resolve(git(["rev-parse", "--git-common-dir"]));
if (gitDir !== commonDir) {
  // Husky otherwise writes the shared config and changes hooks in every worktree.
  if (git(["config", "--local", "--get", "core.bare"]) === "true") {
    throw new Error("Install hooks from a non-bare Riparim checkout.");
  }
  const coreWorktree = spawnSync(
    "git",
    ["config", "--local", "--get", "core.worktree"],
    { encoding: "utf8" },
  );
  if (coreWorktree.status === 0) {
    throw new Error(
      "Move shared core.worktree to the primary worktree config before enabling worktree hooks.",
    );
  }
  git(["config", "--local", "extensions.worktreeConfig", "true"]);
  process.env.GIT_CONFIG = path.join(gitDir, "config.worktree");
} else if (
  spawnSync(
    "git",
    ["config", "--local", "--get", "extensions.worktreeConfig"],
    { encoding: "utf8" },
  ).stdout.trim() === "true"
) {
  process.env.GIT_CONFIG = path.join(gitDir, "config.worktree");
}

const husky = (await import("husky")).default;
const message = husky();
if (message) throw new Error(message);

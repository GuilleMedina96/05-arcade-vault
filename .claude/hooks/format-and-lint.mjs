import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const LINTABLE = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const file = path.resolve(filePath);
const rel = path.relative(projectDir, file);

if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
if (!existsSync(file)) process.exit(0);
if (rel.split(path.sep).some((p) => p === "node_modules" || p === ".next")) {
  process.exit(0);
}

const run = (args) =>
  spawnSync("npx", args, {
    cwd: projectDir,
    encoding: "utf8",
    shell: true,
  });

const prettier = run(["prettier", "--write", "--ignore-unknown", `"${file}"`]);
if (prettier.status !== 0) {
  process.stderr.write(`Prettier falló en ${rel}:\n${prettier.stderr}${prettier.stdout}`);
  process.exit(2);
}

if (LINTABLE.has(path.extname(file).toLowerCase())) {
  const eslint = run(["eslint", "--fix", `"${file}"`]);
  if (eslint.status !== 0) {
    process.stderr.write(`ESLint encontró errores en ${rel}:\n${eslint.stdout}${eslint.stderr}`);
    process.exit(2);
  }
}

process.exit(0);

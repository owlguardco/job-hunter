#!/usr/bin/env node

/**
 * Job Hunter — Preflight Check
 * Validates inputs before running an agent so you don't burn tokens on blank files.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const PLACEHOLDERS = [
  "<!-- Paste your full LinkedIn profile here -->",
  "<!-- Paste your base resume here",
  "<!-- Paste the full job description here -->",
  "[Most Recent Role Title]",
  "[Your Name]",
  "[Role Title]:",
];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function isBlankOrTemplate(content, filePath) {
  if (!content || content.trim().length < 50) return true;
  const hasOnlyPlaceholders = PLACEHOLDERS.some((p) => content.includes(p));
  const filename = path.basename(filePath);
  // A file with a placeholder AND less than 300 chars is still a template
  if (hasOnlyPlaceholders && content.trim().length < 300) return true;
  return false;
}

function check(label, filePath, required = true) {
  const content = readFile(filePath);
  if (!content) {
    if (required) {
      console.error(`  ✗  ${label} — file not found: ${filePath}`);
      return false;
    }
    return true;
  }
  if (isBlankOrTemplate(content, filePath)) {
    console.error(`  ✗  ${label} — looks like the template placeholder. Fill this in first.`);
    console.error(`     → ${filePath}`);
    return false;
  }
  console.log(`  ✓  ${label}`);
  return true;
}

function checkPython() {
  const { execSync } = require('child_process');
  try {
    const ver = execSync('python3.11 --version 2>/dev/null || python3 --version 2>/dev/null', { encoding: 'utf8' }).trim();
    const match = ver.match(/Python (\d+)\.(\d+)/);
    if (match) {
      const minor = parseInt(match[2]);
      const major = parseInt(match[1]);
      if (major === 3 && minor >= 10) {
        console.log('  ✓  Python', ver.replace('Python ', ''));
        return true;
      }
    }
    console.error('  ✗  Python 3.10+ required for npm run jobs');
    console.error('     Install with: brew install python@3.11');
    return false;
  } catch {
    console.error('  ✗  Python not found — required for npm run jobs');
    console.error('     Install with: brew install python@3.11');
    return false;
  }
}

function checkEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("  ✗  .env file missing — copy .env.example and add your ANTHROPIC_API_KEY");
    return false;
  }
  const env = fs.readFileSync(envPath, "utf8");
  if (!env.includes("ANTHROPIC_API_KEY=") || env.includes("your_anthropic_api_key_here")) {
    console.error("  ✗  ANTHROPIC_API_KEY not set in .env");
    return false;
  }
  console.log("  ✓  ANTHROPIC_API_KEY");
  return true;
}

const agent = process.argv[2] || "all";

console.log("\nJob Hunter — Preflight Check");
console.log("─".repeat(40));

let passed = true;

// Always check env
passed = checkEnv() && passed;

if (agent === "linkedin" || agent === "all") {
  console.log("\nLinkedIn Analyzer:");
  passed = check("inputs/my-linkedin.md", path.join(ROOT, "inputs/my-linkedin.md")) && passed;
  passed = check("inputs/job-description.md", path.join(ROOT, "inputs/job-description.md")) && passed;
}

if (agent === "resume" || agent === "all") {
  console.log("\nResume Tailor:");
  passed = check("inputs/my-resume.md", path.join(ROOT, "inputs/my-resume.md")) && passed;
  passed = check("inputs/job-description.md", path.join(ROOT, "inputs/job-description.md")) && passed;
}

if (agent === "cover-letter" || agent === "all") {
  console.log("\nCover Letter:");
  passed = check("inputs/my-resume.md", path.join(ROOT, "inputs/my-resume.md")) && passed;
  passed = check("inputs/job-description.md", path.join(ROOT, "inputs/job-description.md")) && passed;
}

if (agent === "interview" || agent === "all") {
  console.log("\nInterview Prep:");
  passed = check("inputs/my-resume.md", path.join(ROOT, "inputs/my-resume.md")) && passed;
  passed = check("inputs/job-description.md", path.join(ROOT, "inputs/job-description.md")) && passed;
  check("outputs/resume-tailored.md", path.join(ROOT, "outputs/resume-tailored.md"), false);
}

console.log("\n" + "─".repeat(40));

if (!passed) {
  console.error("\n  Preflight failed. Fix the issues above before running.\n");
  process.exit(1);
} else {
  console.log("\n  All checks passed. Running agent...\n");
}

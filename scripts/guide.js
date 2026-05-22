#!/usr/bin/env node

/**
 * Job Hunter — Interactive Guide
 * 
 * Asks where you are in the process and tells you
 * exactly what to run next.
 * 
 * Usage: npm run guide
 */

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Colors ────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  blue:   '\x1b[34m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

const bold  = s => `${c.bold}${s}${c.reset}`;
const blue  = s => `${c.blue}${s}${c.reset}`;
const green = s => `${c.green}${s}${c.reset}`;
const cyan  = s => `${c.cyan}${s}${c.reset}`;
const gray  = s => `${c.gray}${s}${c.reset}`;
const dim   = s => `${c.dim}${s}${c.reset}`;

// ── Helpers ───────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function fileHasContent(relPath, minChars = 200) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, 'utf8').trim();
  const placeholders = ['[Your Name]', '[Most Recent Role', 'Role Title:', '<!-- Paste'];
  if (placeholders.some(p => content.includes(p))) return false;
  return content.length > minChars;
}

function checkInputs() {
  return {
    resume:   fileHasContent('inputs/my-resume.md'),
    linkedin: fileHasContent('inputs/my-linkedin.md'),
    jd:       fileHasContent('inputs/job-description.md'),
    criteria: fileHasContent('inputs/job-search-criteria.md', 100),
    env:      fs.existsSync(path.join(ROOT, '.env')) &&
              !fs.readFileSync(path.join(ROOT, '.env'), 'utf8').includes('your_anthropic_api_key_here'),
  };
}

function printCommand(cmd, desc) {
  console.log(`  ${bold(cyan(cmd.padEnd(28)))} ${gray(desc)}`);
}

function printHeader() {
  console.log('');
  console.log(bold('  Job Hunter'));
  console.log(dim('  ─────────────────────────────────'));
  console.log('');
}

function printSetupIssues(inputs) {
  let issues = false;
  if (!inputs.env) {
    console.log(`  ${bold('⚠️  API key not set')}`);
    console.log(gray('     cp .env.example .env  →  add your ANTHROPIC_API_KEY'));
    console.log(gray('     Get a key at: https://console.anthropic.com/settings/keys'));
    console.log('');
    issues = true;
  }
  if (!inputs.resume) {
    console.log(`  ${bold('⚠️  Resume not filled in')}`);
    console.log(gray('     Open inputs/my-resume.md and paste your resume'));
    console.log('');
    issues = true;
  }
  return issues;
}

// ── Stages ────────────────────────────────────────────────
const stages = [
  {
    id: 'find',
    label: 'Finding jobs to apply for',
    description: 'You need to find roles worth applying to.',
    steps: [
      { cmd: 'npm run reality-check', desc: 'Honest assessment of where you stand — what roles you\'ll actually win' },
      { cmd: 'npm run jobs',          desc: 'Search Indeed, LinkedIn, Glassdoor — results scored against your resume' },
      { cmd: 'npm run fit',           desc: 'Score a specific role before committing to an application' },
      { cmd: 'npm run salary',        desc: 'Research comp before any screening call' },
      { cmd: 'npm run outreach',      desc: 'Cold message a recruiter at a company with no open role' },
      { cmd: 'npm run inbox',         desc: 'Scan Gmail for recruiter emails — flag urgent ones and draft responses' },
      { cmd: 'npm run company',       desc: 'Deep company research — financial health, hiring velocity, culture signals' },
      { cmd: 'npm run referrals',     desc: 'Find warm intro paths to a company — who to contact and what to say' },
      { cmd: 'npm run follow-up',     desc: 'Follow-up message for any stage — after applying, after interview, no response' },
      { cmd: 'npm run company',       desc: 'Deep company research — financial health, hiring velocity, culture signals' },
      { cmd: 'npm run referrals',     desc: 'Find warm intro paths to a company — who to contact and what to say' },
      { cmd: 'npm run follow-up',     desc: 'Follow-up message for any stage — after applying, after interview, no response' },
    ],
    tip: 'Run inbox daily during an active search — recruiter emails have short windows. Start with reality-check — do it once. It tells you your actual market tier and stops you wasting applications. Then run jobs to find roles that fit.',
    next: 'apply',
  },
  {
    id: 'apply',
    label: 'Applying for a specific role',
    description: 'You have a job posting and want to apply.',
    steps: [
      { cmd: 'npm run fit',           desc: 'Score how competitive you actually are before applying — 1-10 with honest breakdown' },
      { cmd: 'npm run decode',        desc: 'Decode the JD — red flags, real pay, what they actually want' },
      { cmd: 'npm run ats',           desc: 'Check your resume clears the ATS screener' },
      { cmd: 'npm run resume',        desc: 'Tailor your resume to this specific role' },
      { cmd: 'npm run cover-letter',  desc: 'Write a cover letter that sounds human' },
      { cmd: 'npm run portfolio',     desc: 'Build a one-page project case study for roles that want work samples' },
      { cmd: 'npm run portfolio',     desc: 'Build a one-page project case study for roles that want work samples' },
    ],
    tip: 'Run fit first. If you score below 6, don\'t apply — find a better role with npm run jobs. If 7+, run decode → ats → resume → cover-letter.',
    next: 'interview',
  },
  {
    id: 'interview',
    label: 'Preparing for an interview',
    description: 'You have an interview coming up.',
    steps: [
      { cmd: 'npm run research',   desc: 'One-page company + interviewer brief — run the morning before' },
      { cmd: 'npm run interview',  desc: 'Story bank + 10 coached questions + what not to say' },
      { cmd: 'npm run mock',       desc: 'Live simulation — one question at a time with grading' },
      { cmd: 'npm run questions',   desc: '15 smart questions to ask at the end — ranked and ready' },
      { cmd: 'npm run debrief',     desc: 'Grade yourself right after the interview while it\'s fresh' },
    ],
    tip: 'Run research first. Then interview for the prep guide. Then mock until you\'re scoring A\'s and B\'s.',
    next: 'offer',
  },
  {
    id: 'offer',
    label: 'Handling an offer',
    description: 'You received an offer and need to respond.',
    steps: [
      { cmd: 'npm run salary',      desc: 'Research market comp before responding' },
      { cmd: 'npm run negotiate',   desc: 'Practice the negotiation conversation before the real call' },
      { cmd: 'npm run counter',     desc: 'Write the actual counter-offer email to send back' },,
      { cmd: 'npm run compare',     desc: 'Compare two offers side by side' },
      { cmd: 'npm run send-thankyou', desc: 'Send thank-you note via Gmail' },
    ],
    tip: 'Do salary research before you say anything. Then practice the negotiation. Most people leave money on the table because they\'ve never practiced this conversation.',
    next: 'career',
  },
  {
    id: 'career',
    label: 'Growing at my current job',
    description: 'You want a promotion, raise, or internal move.',
    steps: [
      { cmd: 'npm run promote',   desc: 'Build your promotion case' },
      { cmd: 'npm run review',    desc: 'Prep for your performance review' },
      { cmd: 'npm run internal',  desc: 'Apply for an internal role' },
      { cmd: 'npm run network',   desc: 'Stay warm with your network between searches' },
      { cmd: 'npm run network',   desc: 'Stay warm with your network between searches' },
    ],
    tip: 'For a promotion: run promote first. It will tell you if your case is ready or what\'s missing.',
    next: null,
  },
];

// ── Main ──────────────────────────────────────────────────
async function main() {
  printHeader();

  // Check setup
  const inputs = checkInputs();
  const hasIssues = printSetupIssues(inputs);

  if (hasIssues) {
    const cont = await ask(`  Fix these before running tools. Continue anyway? ${gray('(y/n)')} `);
    if (cont.toLowerCase() !== 'y') {
      console.log('');
      rl.close();
      return;
    }
    console.log('');
  }

  // Where are you?
  console.log(bold('  Where are you in the process?'));
  console.log('');
  stages.forEach((s, i) => {
    console.log(`  ${bold(blue(`${i + 1}.`))} ${s.label}`);
    console.log(`     ${gray(s.description)}`);
    console.log('');
  });

  const answer = await ask(`  Enter a number (1-${stages.length}): `);
  const idx = parseInt(answer) - 1;

  if (isNaN(idx) || idx < 0 || idx >= stages.length) {
    console.log('\n  Invalid choice. Run `npm run guide` to try again.\n');
    rl.close();
    return;
  }

  const stage = stages[idx];
  console.log('');
  console.log(`  ${bold('─────────────────────────────────')}`);
  console.log(`  ${bold(green(stage.label.toUpperCase()))}`);
  console.log(`  ${bold('─────────────────────────────────')}`);
  console.log('');
  console.log(`  ${bold('Commands for this stage:')}`);
  console.log('');
  stage.steps.forEach(s => printCommand(s.cmd, s.desc));
  console.log('');
  console.log(`  ${bold('💡 Tip:')} ${stage.tip}`);
  console.log('');

  // Input status for this stage
  const relevant = [];
  if (['find','apply','interview','offer'].includes(stage.id)) {
    if (!inputs.resume) relevant.push('inputs/my-resume.md  ← paste your resume here first');
    if (stage.id === 'apply' || stage.id === 'interview') {
      if (!inputs.jd) relevant.push('inputs/job-description.md  ← paste the job posting here');
    }
    if (stage.id === 'find') {
      if (!inputs.criteria) relevant.push('inputs/job-search-criteria.md  ← fill in role titles and location');
    }
  }

  if (relevant.length > 0) {
    console.log(`  ${bold('📁 Fill these in before running:')}`);
    relevant.forEach(r => console.log(`     ${gray(r)}`));
    console.log('');
  }

  // Ask if they want to run the first command
  const runNow = await ask(`  Run ${bold(cyan(stage.steps[0].cmd))} now? ${gray('(y/n)')} `);
  if (runNow.toLowerCase() === 'y') {
    console.log('');
    rl.close();
    try {
      execSync(stage.steps[0].cmd, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
      // command handles its own output
    }
  } else {
    console.log('');
    console.log(`  Copy any command above and run it when ready.`);
    console.log(`  Run ${cyan('npm run guide')} again to come back here.`);
    console.log('');
    rl.close();
  }
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});

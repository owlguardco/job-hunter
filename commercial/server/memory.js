/**
 * Job Hunter — Mem0 Memory Layer
 *
 * Wraps Mem0's Node.js SDK to give each user a persistent,
 * evolving memory profile across all sessions.
 *
 * What gets remembered:
 *   - Resume content and key career facts (role, company, years exp)
 *   - Target roles and locations
 *   - Job search preferences and filters
 *   - Weak spots surfaced in mock interviews
 *   - Patterns in what tools they run and when
 *   - Offer details (for negotiation context)
 *
 * What does NOT get stored in Mem0:
 *   - Full resume text (stays in Postgres profiles table)
 *   - Raw tool outputs (stays in sessions table)
 *   - Payment or billing data (stays in purchases table)
 */

const { MemoryClient } = require('mem0ai');

let mem0Client = null;

function getClient() {
  if (!mem0Client) {
    if (!process.env.MEM0_API_KEY) {
      // Graceful degradation — if no Mem0 key, skip memory silently
      return null;
    }
    mem0Client = new MemoryClient({
      apiKey: process.env.MEM0_API_KEY,
    });
  }
  return mem0Client;
}

// ── Add memory after a tool run ───────────────────────────
// Extracts meaningful facts from the tool interaction
// and stores them against the user's ID
async function addMemory(userId, toolType, inputs, result) {
  const client = getClient();
  if (!client) return;

  try {
    // Build a conversation representing what happened in this run
    // We summarize inputs rather than storing them verbatim
    const messages = buildMemoryMessages(toolType, inputs, result);
    if (!messages) return;

    await client.add(messages, {
      user_id: userId,
      app_id: 'job-hunter',
      run_id: `${toolType}-${Date.now()}`,
    });
  } catch (err) {
    // Memory failures are never fatal — log and continue
    console.error('Mem0 add error (non-fatal):', err.message);
  }
}

// ── Search memory before a tool run ──────────────────────
// Returns relevant past context to inject into the prompt
async function searchMemory(userId, query) {
  const client = getClient();
  if (!client) return '';

  try {
    const results = await client.search(query, {
      user_id: userId,
      app_id: 'job-hunter',
      limit: 5,
    });

    if (!results?.results?.length) return '';

    return results.results
      .map(r => `- ${r.memory}`)
      .join('\n');
  } catch (err) {
    console.error('Mem0 search error (non-fatal):', err.message);
    return '';
  }
}

// ── Get all memories for a user ───────────────────────────
async function getAllMemories(userId) {
  const client = getClient();
  if (!client) return [];

  try {
    const results = await client.getAll({ user_id: userId, app_id: 'job-hunter' });
    return results?.results || [];
  } catch (err) {
    console.error('Mem0 getAll error (non-fatal):', err.message);
    return [];
  }
}

// ── Delete all memories for a user (account deletion) ────
async function deleteAllMemories(userId) {
  const client = getClient();
  if (!client) return;

  try {
    await client.deleteAll({ user_id: userId, app_id: 'job-hunter' });
  } catch (err) {
    console.error('Mem0 deleteAll error (non-fatal):', err.message);
  }
}

// ── Build memory messages per tool type ──────────────────
// Returns null if nothing worth remembering happened
function buildMemoryMessages(toolType, inputs, result) {
  const resume = inputs.resume || inputs.profile || '';
  const jd = inputs.jd || '';

  // Extract job title from JD (first line or "Role Title:" field)
  const roleMatch = jd.match(/(?:Role Title:|Position:|Job Title:)\s*(.+)/i) ||
                    jd.match(/^(.{10,60})\n/);
  const role = roleMatch?.[1]?.trim() || 'the target role';

  // Extract company from JD
  const companyMatch = jd.match(/(?:Company:|at\s+)([A-Z][a-zA-Z\s]+?)(?:\n|,|\.|—)/);
  const company = companyMatch?.[1]?.trim() || 'the target company';

  switch (toolType) {

    case 'resume':
    case 'ats':
    case 'cover':
      if (!resume || resume.length < 100) return null;
      return [
        {
          role: 'user',
          content: `I tailored my resume for a ${role} position at ${company}.`
        },
        {
          role: 'assistant',
          content: `Noted. You're targeting ${role} roles${company !== 'the target company' ? ` at ${company}` : ''}. I'll remember this for future runs.`
        }
      ];

    case 'linkedin':
      return [
        {
          role: 'user',
          content: `I had my LinkedIn profile audited for ${role} roles.`
        },
        {
          role: 'assistant',
          content: `Got it. You're positioning yourself for ${role} opportunities.`
        }
      ];

    case 'decode':
      if (!jd || jd.length < 100) return null;
      // Extract salary estimate from result if present
      const salaryMatch = result?.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?/);
      const salary = salaryMatch?.[0] || null;
      return [
        {
          role: 'user',
          content: `I decoded a job description for ${role} at ${company}.${salary ? ` Estimated salary: ${salary}.` : ''}`
        },
        {
          role: 'assistant',
          content: `Noted. ${role} at ${company}${salary ? `, estimated ${salary}` : ''}.`
        }
      ];

    case 'mock':
    case 'interview':
      // Extract grades and weak spots from mock output
      const gradesMatch = result?.match(/GRADE:\s*([A-D])/g) || [];
      const grades = gradesMatch.map(g => g.replace('GRADE: ', ''));
      const weakSpots = result?.match(/MUST FIX BEFORE THE REAL THING:\n([\s\S]+?)(?:\n─|$)/)?.[1]?.trim();

      return [
        {
          role: 'user',
          content: `I ran an interview prep/mock for ${role}.${grades.length ? ` Grades: ${grades.join(', ')}.` : ''}${weakSpots ? ` Weak spots identified: ${weakSpots.substring(0, 200)}` : ''}`
        },
        {
          role: 'assistant',
          content: `Noted. Interview prep complete for ${role}.${weakSpots ? ' I\'ll factor in the identified weak spots for future prep.' : ''}`
        }
      ];

    case 'research':
      return [
        {
          role: 'user',
          content: `I researched ${company} before an interview for ${role}.`
        },
        {
          role: 'assistant',
          content: `Got it. You have an interview coming up for ${role} at ${company}.`
        }
      ];

    case 'negotiate':
      const offerMatch = inputs.context?.match(/\$[\d,]+/);
      const offerAmount = offerMatch?.[0] || null;
      return [
        {
          role: 'user',
          content: `I practiced negotiating an offer${offerAmount ? ` of ${offerAmount}` : ''} for ${role}.`
        },
        {
          role: 'assistant',
          content: `Noted. You're in the offer stage for ${role}${offerAmount ? ` with an offer of ${offerAmount}` : ''}.`
        }
      ];

    case 'compare':
      return [
        {
          role: 'user',
          content: `I compared two job offers. Offer A: ${(inputs.offerA || '').substring(0, 100)}. Offer B: ${(inputs.offerB || '').substring(0, 100)}.`
        },
        {
          role: 'assistant',
          content: 'Got it. You have multiple offers to consider.'
        }
      ];

    case 'salary':
      return [
        {
          role: 'user',
          content: `I researched market compensation for ${role}.`
        },
        {
          role: 'assistant',
          content: `Noted. You're researching comp for ${role} roles.`
        }
      ];

    case 'promote':
    case 'review':
    case 'internal':
      return [
        {
          role: 'user',
          content: `I used the ${toolType} tool for career development.`
        },
        {
          role: 'assistant',
          content: `Got it. You're focused on career growth at your current company.`
        }
      ];

    case 'reality':
      // Store the market tier assessment for future context
      const tierMatch = result?.match(/WHERE YOU ACTUALLY ARE[\s\S]+?(?=WHAT YOU)/);
      const tier = tierMatch?.[0]?.replace('WHERE YOU ACTUALLY ARE', '').trim().substring(0, 200);
      return [
        {
          role: 'user',
          content: `I ran a resume reality check.${tier ? ' Assessment: ' + tier : ''}`
        },
        {
          role: 'assistant',
          content: `Noted your market position assessment. I will factor this into future tool runs.`
        }
      ];

    case 'fit':
      const scoreMatch = result?.match(/JOB FIT SCORE[:\s]+(\d+)/i);
      const recMatch = result?.match(/RECOMMENDATION[:\s]+(APPLY|DO NOT APPLY|APPLY WITH CAVEATS)/i);
      const fitScore = scoreMatch?.[1];
      const rec = recMatch?.[1];
      return [
        {
          role: 'user',
          content: `I scored fit for ${role} at ${company}.${fitScore ? ' Score: ' + fitScore + '/10.' : ''}${rec ? ' Verdict: ' + rec + '.' : ''}`
        },
        {
          role: 'assistant',
          content: `Noted. ${role} at ${company}${fitScore ? ' scored ' + fitScore + '/10' : ''}${rec ? ' — ' + rec : ''}.`
        }
      ];

    default:
      return null;
  }
}

// ── Build memory context string for prompt injection ──────
// Searches for relevant memories and formats them for the prompt
async function getMemoryContext(userId, toolType, inputs) {
  const client = getClient();
  if (!client) return '';

  // Build a search query relevant to this tool run
  const jd = inputs.jd || '';
  const roleMatch = jd.match(/(?:Role Title:|Position:)\s*(.+)/i) || jd.match(/^(.{10,60})\n/);
  const role = roleMatch?.[1]?.trim() || '';

  const queries = {
    resume: `resume tailoring ${role} job application`,
    ats: `ATS resume ${role} application`,
    cover: `cover letter ${role}`,
    interview: `interview prep ${role} questions weak spots`,
    mock: `mock interview ${role} grades performance`,
    research: `company research interview`,
    negotiate: `salary negotiation offer`,
    compare: `job offer comparison`,
    promote: `promotion career growth`,
    review: `performance review`,
  };

  const query = queries[toolType] || `job search ${role}`;
  const memories = await searchMemory(userId, query);
  if (!memories) return '';

  return `\nRELEVANT CONTEXT FROM YOUR PREVIOUS SESSIONS:\n${memories}\n`;
}

module.exports = {
  addMemory,
  searchMemory,
  getAllMemories,
  deleteAllMemories,
  getMemoryContext,
};

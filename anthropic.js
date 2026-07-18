export const DEFAULT_STYLE_RULES = `No em dashes. Use commas or separate sentences instead.
No contractions: write "do not", "I am", "I will" not "don't", "I'm", "I'll".
No corporate buzzwords: avoid leverage, seamless, elevate, synergy, unlock, streamline, empower, revolutionize.
No cliche openers like "I hope this email finds you well".
No emoji.
No generic AI phrases: avoid "in today's world", "dive into", "unpack", "navigate the landscape", "cutting-edge", "game-changer", "boasts", "stands out".
No exaggerated or hyperbolic claims.
Stay warm and human, not cold or robotic, even while formal.`;

function profileBlock(profile) {
  return `Sender profile:
Name: ${profile.name || 'not provided'}
About: ${profile.about_me || 'not provided'}
Portfolio link: ${profile.portfolio_link || 'not provided'}

When drawing on the About section, pick only the single most relevant detail for this specific company and ask. Do not list multiple credentials or the person's whole background. Sign off with the sender's name if one is provided. If a portfolio link is provided and it fits naturally, include it once, for example as the low-friction next step.`;
}

function extractJson(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callClaude(promptText, useSearch) {
  const payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: promptText }]
  };
  if (useSearch) {
    payload.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || '').join('\n');
}

export async function draftOutreach({ company, ask, profile, research }) {
  const researchLine = research
    ? `Before writing, search the web for what ${company} actually does, who they serve, and anything recent and specific about them. Use 1-2 concrete details in the email so it clearly isn't a template, but keep it short and natural, not a research report.`
    : '';
  const prompt = `You are helping draft a short, friendly outreach/pitch email. ${researchLine}

Return ONLY valid JSON, no preamble, no markdown fences, in this exact shape:
{"subject": "...", "body": "..."}

Context about the sender's tone: ${profile.voice || 'A student building small projects, friendly and direct, not corporate.'}

${profileBlock(profile)}

House style rules, always follow these exactly:
${profile.style_rules || DEFAULT_STYLE_RULES}

Company or organization being pitched: ${company}
What they want from this outreach: ${ask}

Write a concise, confident email (under 150 words). Rules: no hedging phrases like "I'd love to," "I think," "I genuinely," "happy to" - say things directly instead ("I create...", "Here's the offer:", "Take a look:"). No generic praise ("clean labels," "no-nonsense," "amazing product") - lead with one concrete, specific observation instead, or skip the compliment and go straight to the offer. Short sentences, active voice. State the offer as a fact, not a request. End with one clear, low-friction next step, not a soft "happy to share examples if you'd like."`;
  const raw = await callClaude(prompt, research);
  return extractJson(raw);
}

export async function reviseDraft({ subject, body, instruction, profile }) {
  const prompt = `Here is a draft email:
Subject: ${subject}
Body: ${body}

Revise it based on this instruction: "${instruction}"
Tone: ${profile.voice || 'friendly, direct, not corporate'}

${profileBlock(profile)}

House style rules, always follow these exactly:
${profile.style_rules || DEFAULT_STYLE_RULES}

Keep roughly the same length unless the instruction says otherwise.

Return ONLY valid JSON, no preamble, no markdown fences, in this exact shape:
{"subject": "...", "body": "..."}`;
  const raw = await callClaude(prompt);
  return extractJson(raw);
}

export async function generateFollowUp({ pitch, daysAgo, profile }) {
  const prompt = `Write a short, polite follow-up email. Return ONLY valid JSON, no preamble, no markdown fences, in this exact shape:
{"subject": "...", "body": "..."}

Original pitch to "${pitch.company}" asked for: "${pitch.ask}"
It was sent ${daysAgo} days ago with subject "${pitch.subject}" and there has been no reply yet.
Tone: ${profile.voice || 'friendly, direct, not corporate'}

${profileBlock(profile)}

House style rules, always follow these exactly:
${profile.style_rules || DEFAULT_STYLE_RULES}

Keep it under 80 words. Light touch, easy for them to ignore or say no to, references the original ask briefly, no guilt-tripping, no "just following up" filler as the whole message.`;
  const raw = await callClaude(prompt);
  return extractJson(raw);
}

export async function analyzeReply({ company, ask, replyText, profile }) {
  const prompt = `You are helping someone manage outreach pitches. They pitched "${company}" with this ask: "${ask}". They just received this reply:
"""
${replyText}
"""

Return ONLY valid JSON, no preamble, no markdown fences, in this exact shape:
{"sentiment": "interested" | "declined" | "needs_info" | "neutral", "suggested_status": "interested" | "declined" | "sent", "draft_reply": "..."}

The draft_reply should be a short, warm, non-corporate follow-up reply (under 120 words) appropriate to what they said. Tone: ${profile.voice || 'friendly, direct, not corporate'}.

${profileBlock(profile)}

House style rules, always follow these exactly:
${profile.style_rules || DEFAULT_STYLE_RULES}

If they declined, draft_reply should be a brief, gracious thank-you with a door left open, not a hard sell.`;
  const raw = await callClaude(prompt);
  return extractJson(raw);
}

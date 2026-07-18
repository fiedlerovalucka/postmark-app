import { getUserAndProfile } from '../../lib/apiAuth';
import { reviseDraft } from '../../lib/anthropic';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { error, profile } = await getUserAndProfile(req);
  if (error) return res.status(401).json({ error });

  const { subject, body, instruction } = req.body;
  if (!subject || !body || !instruction) return res.status(400).json({ error: 'Missing fields' });

  try {
    const revised = await reviseDraft({ subject, body, instruction, profile });
    res.status(200).json(revised);
  } catch (e) {
    res.status(500).json({ error: 'Could not revise the message' });
  }
}

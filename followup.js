import { getUserAndProfile } from '../../lib/apiAuth';
import { generateFollowUp } from '../../lib/anthropic';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { error, profile } = await getUserAndProfile(req);
  if (error) return res.status(401).json({ error });

  const { pitch, daysAgo } = req.body;
  if (!pitch) return res.status(400).json({ error: 'Missing pitch' });

  try {
    const draft = await generateFollowUp({ pitch, daysAgo, profile });
    res.status(200).json(draft);
  } catch (e) {
    res.status(500).json({ error: 'Could not draft a follow-up' });
  }
}

import { getUserAndProfile } from '../../lib/apiAuth';
import { draftOutreach } from '../../lib/anthropic';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { error, profile } = await getUserAndProfile(req);
  if (error) return res.status(401).json({ error });

  const { company, ask, research } = req.body;
  if (!company || !ask) return res.status(400).json({ error: 'Missing company or ask' });

  try {
    const draft = await draftOutreach({ company, ask, profile, research });
    res.status(200).json(draft);
  } catch (e) {
    res.status(500).json({ error: 'Could not draft the message' });
  }
}

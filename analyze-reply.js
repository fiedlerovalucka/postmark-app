import { getUserAndProfile } from '../../lib/apiAuth';
import { analyzeReply } from '../../lib/anthropic';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { error, profile } = await getUserAndProfile(req);
  if (error) return res.status(401).json({ error });

  const { company, ask, replyText } = req.body;
  if (!company || !replyText) return res.status(400).json({ error: 'Missing fields' });

  try {
    const result = await analyzeReply({ company, ask, replyText, profile });
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: 'Could not read that reply' });
  }
}

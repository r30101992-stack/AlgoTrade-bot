// api/generate.ts - Vercel Serverless Function (Node.js)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { idea, platform, interval, use_ai_checks } = req.body || {};
    if (!idea || !platform) return res.status(400).json({ error: 'Missing fields: idea, platform' });

    const prompt = `
החזר JSON תקין בלבד:
{"code":"<string>","summary":["..."],"tips":["..."]}

פלטפורמה: ${platform}
טיימפריים: ${interval || '—'}
בדיקות AI: ${use_ai_checks ? 'ON' : 'OFF'}

הנחיות:
- אם NT8: Strategy מלאה (SetDefaults/Configure/OnBarUpdate + SL/TP/Trail/BE).
- אם Pine v5: strategy מלאה עם input() ו-entries/exit.
- אין להחזיר טקסט מחוץ ל-JSON.

תיאור אסטרטגיה:
${idea}
`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Return only valid JSON. No extra text.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(500).json({ error: 'OpenAI error', detail: errText });
    }

    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(500).json({ error: 'Bad JSON from model', raw }); }

    if (typeof parsed?.code !== 'string') {
      return res.status(500).json({ error: 'Missing code in response', raw: parsed });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      code: parsed.code,
      summary: Array.isArray(parsed.summary) ? parsed.summary : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips : []
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Server error' });
  }
}

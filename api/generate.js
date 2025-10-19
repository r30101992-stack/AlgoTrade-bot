// api/generate.js — Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { idea, platform, interval, use_ai_checks } = req.body || {};
    if (!idea || !platform) {
      return res.status(400).json({ error: 'Missing fields: idea, platform' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    // הנחיה למודל: להחזיר JSON בלבד עם code/summary/tips
    const prompt = `
אתה "אלגו מנטור" — מומחה מסחר ותכנות אלגו.
חובה להחזיר JSON תקין בלבד במבנה:
{"code":"<string>","summary":["..."],"tips":["..."]}

פרטי המשתמש:
- רעיון: ${idea}
- פלטפורמה: ${platform}
- טיימפריים: ${interval || "-"}
- בדיקות AI: ${use_ai_checks ? "כן" : "לא"}

מטרה:
1) כתוב קוד מלא ונקי המתאים לפלטפורמה שסופקה (NinjaTrader 8 C#, PineScript v5, MultiCharts EL וכו').
2) הוסף ניהול פוזיציה בסיסי: כניסה/יציאה, TP/SL, טריילינג (אם רלוונטי).
3) תן תקציר נקודות ("summary") ו"טיפים" לשיפור/בדיקה.`;

    // קריאה ל-OpenAI (Chat Completions)
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are AlgoMentor, a strict JSON-only code generator and trading strategist.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || 'OpenAI error' });
    }

    let text = (data.choices && data.choices[0]?.message?.content) || '';
    // נסה לפרסר JSON; אם המודל החזיר טקסט — עטוף כמינימום
    let out;
    try {
      out = JSON.parse(text);
      if (typeof out !== 'object' || out === null) throw new Error('not an object');
      if (!('code' in out)) out.code = String(text || '');
      if (!Array.isArray(out.summary)) out.summary = [];
      if (!Array.isArray(out.tips)) out.tips = [];
    } catch (_) {
      out = { code: String(text || ''), summary: [], tips: [] };
    }

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}

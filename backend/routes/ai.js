const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant'; // Fast, reliable, and free on Groq

/**
 * @route   POST /api/ai/chat
 * @desc    Smart AI assistant for EV trip planning using Groq (Llama 3.1)
 * @access  Private
 */
router.post('/chat', authenticate, async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!GROQ_API_KEY) {
    return res.status(503).json({
      error: 'AI service is not configured.',
      reply: "⚠️ Volt is not configured yet. Please set up a Groq API key."
    });
  }

  try {
    const dbInstance = db.getDb();
    const liveContext = await new Promise((resolve) => {
      dbInstance.get(
        `SELECT 
          (SELECT COUNT(*) FROM charging_stations WHERE is_verified = 1) AS verified_stations,
          (SELECT COUNT(*) FROM charging_stations WHERE is_verified = 1 AND status = 'available') AS available_stations,
          (SELECT COUNT(*) FROM bookings WHERE LOWER(status) = 'confirmed') AS active_bookings,
          (SELECT COUNT(*) FROM users WHERE role = 'user') AS total_users`,
        [],
        (err, row) => resolve(row || {})
      );
    });

    const systemPrompt = `You are "Volt", a friendly AI assistant for the EV Smart Assistant platform.
**Live Stats:** ${liveContext.verified_stations} verified stations, ${liveContext.available_stations} available now.

**Guidelines:**
- Be concise and friendly. Use emojis ⚡🔋.
- Help with EV range, route planning, and charging types (CCS2, Type 2).
- Only discuss EV topics. Stay focused!`;

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Add history
    for (const turn of history.slice(-6)) {
      messages.push({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: turn.content });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const response = await axios.post(GROQ_URL, {
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const reply = response.data.choices[0]?.message?.content;
    
    if (!reply) throw new Error('Empty response from Groq');

    res.json({ reply, model: MODEL });

  } catch (err) {
    console.error('[AI Chat] Groq Error:', err.response?.data || err.message);
    res.status(502).json({
      error: 'AI Service Error',
      reply: "⚡ Volt is having a momentary glitch. Please try again in a second!"
    });
  }
});

router.get('/suggestions', authenticate, (req, res) => {
  const suggestions = [
    "Plan a trip from Ahmedabad to Mumbai 🗺️",
    "How much range do I have with 60% battery? 🔋",
    "What's CCS2 vs CHAdeMO? ⚡",
    "Best EV driving tips to save battery 🌿"
  ];
  res.json({ suggestions });
});

module.exports = router;

// backend/server.js

const express = require('express');
const multer = require('multer');   // For handling file uploads (audio)
const axios = require('axios');     // For making HTTP requests to Whisper/OpenAI
const FormData = require('form-data'); // For sending multipart/form-data to Whisper
const cors = require('cors');       // For enabling Cross-Origin Resource Sharing
require('dotenv').config();         // For loading environment variables from a .env file (for local testing)

const app = express();
const port = process.env.PORT || 3001; // Use environment variable (for Render) or default to 3001 (for local)

// Multer setup: Store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// --- Middleware ---
app.use(express.json()); // To parse JSON bodies (e.g., for OpenAI questions)

// CORS Configuration: Allows your frontend to talk to this backend
// IMPORTANT: Replace 'https://your-frontend-name.onrender.com' with your actual deployed frontend URL on Render.com
app.use(cors({
    origin: 'https://voice-ai-frontend-q3c3.onrender.com', // REPLACE WITH YOUR RENDER.COM FRONTEND URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'], // Removed 'Authorization' as no authentication is used
}));

// --- Environment Variables (for OpenAI API Key) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in environment variables.');
    // In production, you might want to exit the process or handle this more gracefully
}

// --- API Routes ---

// 1. STT Endpoint (Audio Transcription using Whisper API)
app.post('/api/stt', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided.' });
    }

    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'audio.webm',
            contentType: req.file.mimetype,
        });
        formData.append('model', 'whisper-1');

        console.log('Sending audio to Whisper API...');
        const whisperResponse = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    ...formData.getHeaders(),
                },
            }
        );

        res.json({ transcription: whisperResponse.data.text });
        console.log('Transcription successful:', whisperResponse.data.text);
    } catch (error) {
        console.error('Error in STT API call:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Failed to transcribe audio.',
            details: error.response ? error.response.data : error.message
        });
    }
});

// 2. OpenAI Endpoint (AI Response Generation)
app.post('/api/openai', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'No question provided.' });
    }

    try {
        console.log('Sending question to OpenAI API:', question);
        const openaiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: question }],
                temperature: 0.7,
                max_tokens: 250,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.json({ answer: openaiResponse.data.choices[0].message.content });
        console.log('OpenAI response received.');
    } catch (error) {
        console.error('Error in OpenAI API call:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Failed to get answer from AI.',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});

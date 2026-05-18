# Scalvia Client Brief Generator

Local Next.js app for turning client call recordings into transcripts, commercial briefs, and structured JSON.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Add a Groq API key to `.env` before processing audio.

For long calls, the UI defaults to high-accuracy chunking: 4-minute chunks with 20 seconds of overlap. This creates more sections than the original 7-minute strategy and preserves more local context around transitions.

## Requirements

- Node.js 20+
- FFmpeg available in `PATH`
- Groq API key

Generated audio, transcripts, briefs, JSON, and the SQLite database are written to `storage/`, which is ignored by git.

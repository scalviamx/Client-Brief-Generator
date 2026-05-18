# Scalvia Client Brief Generator

Local Next.js app for turning client call recordings into transcripts, commercial briefs, and structured JSON.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Add a Groq API key to `.env` before processing audio.

## Requirements

- Node.js 20+
- FFmpeg available in `PATH`
- Groq API key

Generated audio, transcripts, briefs, JSON, and the SQLite database are written to `storage/`, which is ignored by git.

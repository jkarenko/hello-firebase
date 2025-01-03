# Firebase TypeScript Practice Project

A simple practice project to explore Firebase features using TypeScript. The project implements basic cloud functions and web hosting to demonstrate Firebase's capabilities.

## Features

- Cloud Functions with TypeScript
- Firebase Hosting
- Simple web interface with:
  - Hello World endpoint
  - Personalized greeting function
  - D&D dice roller (supports multiple dice types and advantage/disadvantage rolls)
  - Audio player with version control and caching
    - Multiple versions of the same song
    - Smooth version switching
    - Background pre-caching for instant playback
    - Progress bar and time display
    - Browser caching for improved performance

## Tech Stack

- Firebase Cloud Functions
- TypeScript
- Firebase Hosting
- HTML/CSS/JavaScript (frontend)
- Firebase Cloud Storage (audio files)
- Web Audio API (audio playback)

## Project Structure

- `/functions` - TypeScript-based Firebase Cloud Functions
- `/public` - Static web files for Firebase Hosting

## Local Development

1. Install dependencies:

```bash
npm install
cd functions
npm install
```

2. Start local emulator:

```bash
firebase emulators:start
```

The command starts the hosting of the static files in `./public` and builds the functions with the `--watch` flag, so it will automatically restart the functions when you make changes to the code.

3. Access the web app at:

```bash
http://localhost:5000
```
or whatever port is specified in the output of the `firebase emulators:start` command

## Audio Player Features

The audio player (`/player` endpoint) provides:
- Version selection dropdown
- Play/Pause control
- Progress bar with seek functionality
- Time display (current/total)
- Automatic pre-caching of all versions
- Browser caching for improved performance
- Smooth version switching with time position preservation

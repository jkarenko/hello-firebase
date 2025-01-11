# Echoherence

A collaborative audio project management system built with React and Firebase, allowing users to manage and share audio projects with version control.

## Features

- Authentication & User Management
  - Google Authentication
  - User session management
  - Role-based permissions

- Project Management
  - Create and manage audio projects
  - Multiple version support for each project
  - Project sharing and collaboration

- Collaboration Features
  - Two-level access control (Editor/Viewer)
  - Configurable invite link system
    - Expiration dates
    - Usage limits
    - Permission levels
  - Real-time updates and synchronization

- Audio Player
  - Version selection and control
  - Play/Pause functionality
  - Progress bar with seek capability
  - Time display (current/total)
  - Background pre-caching for instant playback
  - Browser caching for improved performance
  - Smooth version switching with time position preservation

- Comments System
  - Real-time comment updates
  - Thread-based discussions
  - Comment resolution tracking

## Tech Stack

- React with TypeScript
- Firebase V2 Services
  - Authentication
  - Cloud Functions
  - Cloud Storage
  - Firestore
  - Hosting
- Vite
- Tailwind CSS
- NextUI Component Library
- Web Audio API

## Project Structure

- `/hello-firebase-react` - React frontend application
- `/functions` - TypeScript-based Firebase Cloud Functions

## Local Development

1. Install dependencies:

```bash
# Install root dependencies
npm install

# Install React app dependencies
cd hello-firebase-react
npm install

# Install Cloud Functions dependencies
cd ../functions
npm install
```

2. Development Mode:

```bash
# Start all services (React, Functions, and Firebase Emulators)
npm run dev

# Or start individual services:
npm run dev:react      # Start React development server
npm run dev:functions  # Start Functions in watch mode
npm run dev:emulator   # Start Firebase emulators
```

3. Building:

```bash
# Build all services
npm run build

# Or build individual services:
npm run build:react    # Build React application
npm run build:functions # Build Cloud Functions
```

4. Access the application:

- React development server: Check the Vite output for the port (typically http://localhost:5173)
- Firebase Emulators: Check the Firebase output for various service ports
  - Hosting: typically http://localhost:5000
  - Functions: typically http://localhost:5001
  - Firestore: typically http://localhost:8080
  - Auth: typically http://localhost:9099
  - Storage: typically http://localhost:9199

## Available Scripts

### Root Directory
- `npm run dev` - Start all services in development mode
- `npm run build` - Build all services
- `npm run start` - Start Firebase emulators with data import/export

### React Application (`/hello-firebase-react`)
- `npm run dev` - Start Vite development server
- `npm run build` - Build the React application
- `npm run preview` - Preview the production build locally before deployment (runs on http://localhost:4173 by default)
- `npm run lint` - Run ESLint

> Note: The `preview` command is useful for testing the production build locally before deployment. Unlike `dev` which serves the source files directly, `preview` serves the actual built files from the `dist` directory, exactly as they would be served in production. This helps catch any potential issues that might only appear in the production build.

### Cloud Functions (`/functions`)
- `npm run build` - Build TypeScript functions
- `npm run dev` - Watch and rebuild functions
- `npm run serve` - Start functions emulator
- `npm run deploy` - Deploy functions to Firebase
- `npm run lint` - Run ESLint

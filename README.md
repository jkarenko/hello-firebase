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
  - Sticky audio player for continuous player controls while scrolling task list

- Comments System
  - Real-time comment updates
  - Thread-based discussions (version-specific)
  - Task resolution tracking
  - Task sorting (by date, state, position on timeline)

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
# Start Firebase emulators (in one terminal)
npm run dev:emulator

# Start development services in watch mode (in another terminal)
npm run dev:watch

# Or start individual services:
npm run dev:react      # Start React development build in watch mode
npm run dev:functions  # Start Functions in watch mode
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

- React development server: Check the Vite output for the port (http://localhost:5173)
- Firebase Emulators: Check the Firebase output for various service ports
  - Hosting: http://localhost:5000
  - Functions: http://localhost:5001
  - Firestore: http://localhost:8080
  - Auth: http://localhost:9099
  - Storage: http://localhost:9199

5. Additional Scripts:

```bash
# Clean up any hanging emulator processes
npm run cleanup

# Start emulators with data persistence
npm run start
```

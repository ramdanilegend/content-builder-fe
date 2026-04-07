# Content Builder

A Next.js-based frontend application for building and managing content. This project features React 18, TypeScript, and Tailwind CSS.

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Production Build

Create an optimized production build:

```bash
npm run build
npm start
```

## Linting

Run the linter to check code quality:

```bash
npm run lint
```

## Docker

### Build Docker Image

```bash
docker build -t content-builder-fe .
```

### Run Docker Container

```bash
docker run -p 3000:3000 content-builder-fe
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── app/                 # Next.js app directory
├── components/          # React components
├── context/             # React context providers
├── public/              # Static assets
├── types/               # TypeScript type definitions
├── tailwind.config.ts   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── next.config.mjs      # Next.js configuration
```

## Technologies

- **Next.js** 14.2.5 - React framework
- **React** 18.3.1 - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **jszip** - ZIP file handling
- **file-saver** - File download utility
- **lucide-react** - Icon library

## Environment Variables

Create a `.env.local` file in the root directory for local environment variables:

```
# Add your environment variables here
```

## Contributing

Please ensure code passes linting before committing changes.

## License

Private project

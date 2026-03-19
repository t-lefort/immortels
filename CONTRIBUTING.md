# Contributing to Les Immortels

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/immortels.git`
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env` and configure it
5. Start the dev server: `npm run dev`

## Development

- `npm run dev` starts both the Express server (with hot reload) and the Vite dev server
- The React app proxies API requests to the Express server in development
- SQLite database is stored in `data/game.db` (auto-created on first run)

## Code Style

- **Variable/function names**: English
- **UI strings**: French (this is a French-language game)
- Keep code simple and avoid over-engineering

## Pull Requests

1. Create a feature branch from `master`
2. Make your changes
3. Test locally with a full game flow if possible
4. Submit a PR with a clear description of what changed and why

## Reporting Issues

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/device info if it's a frontend issue

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

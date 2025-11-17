# Contributing to coding-agent-sdk

Thank you for your interest in contributing! This SDK provides a unified interface for building agentic workflows that delegate to existing coding agents (Claude Code, Codex, Gemini).

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm
- One of the supported coding agents installed (claude, codex, or gemini)

### Getting Started

1. Fork and clone the repository:
```bash
git clone https://github.com/gaojude/coding-agent-sdk.git
cd coding-agent-sdk
```

2. Install dependencies:
```bash
npm install
```

3. Run tests:
```bash
npm test
```

4. Build the project:
```bash
npm run build
```

### Development Workflow

- `npm run dev` - Watch mode for development
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run build` - Build the project

## Project Structure

```
src/
├── backends/          # Backend implementations for each agent
│   ├── claude.ts
│   ├── codex.ts
│   └── gemini.ts
├── mappers/          # Event mappers to unified format
│   ├── claude-mapper.ts
│   ├── codex-mapper.ts
│   └── gemini-mapper.ts
├── utils/            # Utility functions
│   └── auto-detect.ts
├── events.ts         # Unified event types
├── types.ts          # Type definitions
├── index.ts          # Main SDK entry point
└── cli.ts            # CLI tool
```

## Code Style

- Use TypeScript for all code
- Follow existing code patterns and naming conventions
- Use async/await for asynchronous operations
- Use async generators for streaming events
- Add JSDoc comments for public APIs

## Testing

- Write tests for all new features
- Maintain existing test coverage
- Tests should be placed alongside the source files with `.test.ts` extension
- Use Vitest for testing
- Mock external dependencies (child processes, file system, etc.)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Add tests** for your changes

4. **Run tests** to ensure everything passes:
   ```bash
   npm test
   ```

5. **Build the project** to verify it compiles:
   ```bash
   npm run build
   ```

6. **Commit your changes** with a clear commit message:
   ```bash
   git commit -m "Add feature: your feature description"
   ```

7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request** with:
   - Clear description of the changes
   - Link to any related issues
   - Screenshots/examples if applicable

## Adding Support for New Backends

If you want to add support for a new coding agent:

1. Create a new backend file in `src/backends/your-agent.ts`
2. Implement the backend following the pattern in existing backends
3. Create a mapper in `src/mappers/your-agent-mapper.ts`
4. Add the backend to the `Backend` type in `src/events.ts`
5. Update the auto-detection logic in `src/utils/auto-detect.ts`
6. Add tests for both the backend and mapper
7. Update documentation

## Reporting Issues

When reporting issues, please include:

- SDK version
- Node.js version
- Operating system
- Which agent you're using (claude, codex, gemini)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages or logs

## Questions?

If you have questions about contributing, feel free to:

- Open an issue for discussion
- Check existing issues and pull requests

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in coding-agent-sdk, please report it by emailing the maintainer or opening a private security advisory on GitHub.

**Please do not report security vulnerabilities through public GitHub issues.**

### What to Include

Please include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)

### Response Time

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

## Security Considerations

When using this SDK:

1. **Auto-Approval Mode**: By default, the SDK runs in auto-approval mode, which means agents will automatically execute actions. Be cautious when running untrusted workflows.

2. **Environment Variables**: The SDK passes environment variables to child processes. Ensure sensitive data is not exposed in your environment.

3. **CLI Tool Security**: This SDK delegates to external CLI tools (Claude Code, Codex, Gemini). Ensure these tools are from trusted sources and kept up to date.

4. **Code Execution**: Workflows may execute arbitrary code through the underlying agents. Only run workflows from trusted sources.

# Security Policy

waify handles sensitive material — a **Google Gemini API key**, an **OpenWA API
key**, and a **linked WhatsApp session**. We take security reports seriously.

## Supported versions

The latest published `1.x` release on npm receives security fixes. Please
upgrade (`npm install -g @deckasoft/waify@latest`) before reporting.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Email **hola@deckasoft.com** with:

- a description of the vulnerability and its impact,
- steps to reproduce (or a proof of concept), and
- the waify version (`waify --version`) and your environment.

We aim to acknowledge reports within a few business days and will keep you
updated on remediation. Once a fix is released, we're happy to credit you unless
you'd prefer to remain anonymous.

## Handling secrets

- Secrets live only in `~/.config/waify/.env` (or `$WAIFY_ENV_PATH`) and are
  **never** committed — `.env` is gitignored.
- If you believe a key has been exposed, rotate it immediately:
  [Gemini keys](https://aistudio.google.com/apikey) and your OpenWA key, then
  update your local `.env`.

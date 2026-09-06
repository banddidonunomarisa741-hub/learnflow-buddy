# Vendored QQ client

Pinned inputs (npm integrity verified by npm install):

- `@tencent-connect/qqbot-nodejs@1.0.4`: `sha512-gU5HySLplczZXMUjM7NtiUACY7YfX9YlI/R9PKzCLMgLmHvwsX9L2sitsrYPMentGUr9b8NLfSaSTsndF77NBA==`
- `ws@8.21.3` (SDK dependency)
- bundler: `esbuild@0.25.5`

All licenses are adjacent. SDK source: https://github.com/tencent-connect/qqbot-nodejs . The onboarding adaptation follows Tencent's qqbot-agent-sdk commit `6163b5dc979a2f12379b1916805009075008c3c3`; see the separate onboarding license.

Rebuild in a scratch directory with npm's `--ignore-scripts --save-exact`, then bundle `@tencent-connect/qqbot-nodejs/dist/index.js` with:

```text
--bundle --platform=node --format=esm --target=node20 --external:bufferutil --external:utf-8-validate
```

The ESM bundle banner supplies Node's `createRequire` for the bundled `ws` CommonJS code. Optional native websocket accelerators are intentionally not bundled. No application credentials or user data belong in this directory. API debug logging is discarded by the LearnFlow wrapper.

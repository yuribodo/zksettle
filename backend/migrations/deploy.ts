// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.
//
// No-op until a real TypeScript client is wired up. The official Anchor TS
// client is `@coral-xyz/anchor`; add it (and reinstate the body below) when
// deployment scripting is needed.

module.exports = async function (_provider: unknown) {
  // Add your deploy script here.
};

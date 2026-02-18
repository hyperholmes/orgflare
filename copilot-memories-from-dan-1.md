# Copilot Memories

Hey copilot it's me dan. you tried to store these memories but it failed so i saved them for you here :-)

---

Let me store this knowledge for future reference:

Call to store_memory
Input
{
"subject": "template configuration",
"fact": "Templates should not have their own turbo.json files unless extending the root configuration",
"citations": "Fixed cogflare-worker-platform-template by removing duplicate turbo.json file that was causing monorepo build conflicts",
"reason": "This fact will help prevent similar issues when adding new templates to the monorepo. Having duplicate turbo.json files causes \"No extends key found\" errors during turbo builds. Templates should inherit from the root turbo.json configuration.",
"category": "general"
}
Failed to store memory with error: Resource not found

Call to store_memory
Input
{
"subject": "lockfile regeneration",
"fact": "Use `pnpm install --no-frozen-lockfile` to regenerate pnpm-lock.yaml when adding new workspace packages",
"citations": "Fixed lockfile issue by running `pnpm install --no-frozen-lockfile` after adding cogflare-worker-platform-template to workspace",
"reason": "When a new template is added to the pnpm workspace but the lockfile doesn't include its dependencies, running install with --no-frozen-lockfile is necessary to update the lockfile. This is critical for CI/CD environments that use frozen-lockfile by default.",
"category": "general"
}
Failed to store memory with error: Resource not found

Now let me create a final summary and do a code review

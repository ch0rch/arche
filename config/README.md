# Workspace Config Source

This directory stores the source file for the shared runtime configuration.

- `CommonWorkspaceConfig.json`: source of truth for agent definitions, default models, and prompts.

Deployment:

- Use `scripts/deploy-config.sh` to sync this file into the bare config repository (`kb-config`).

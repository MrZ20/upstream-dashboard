# Data templates

`src/data/kunpeng` and `src/data/ascend` only keep empty `_index.md` files for build-time fallback structure.
They do not contain real dashboard data.

Real runtime data is generated into the container-local `/project-data` directory by `scripts/sync-data.mjs` after sparse-cloning the remote data repository. The data is intentionally ephemeral and is re-synced when a new container starts.

Reference JSON templates are kept here:

- `templates/kunpeng.template.json`
- `templates/ascend.template.json`

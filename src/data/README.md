# Data templates

`src/data` no longer stores dashboard project data. Real data is generated into the container-local `/project-data` directory by `scripts/sync-data.mjs` after sparse-cloning the remote data repositories. The data is intentionally ephemeral and is re-synced when a new container starts.

Reference JSON templates are kept here:

- `templates/kunpeng.template.json`
- `templates/ascend.template.json`

The templates are documentation aids only and are not loaded by the page.

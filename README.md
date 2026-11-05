# Modern ERP UI

A modern Vue 3 interface for ERPNext, packaged as a Frappe app. The backend is the `modern_erp_ui` app and the interface lives in `frontend/`.

## Tested versions

Use these exact versions to avoid compatibility errors.

| Component | Version |
| --- | --- |
| Frappe | `v16.35.0` |
| ERPNext | `v16.36.0` |
| Modern ERP UI | `0.0.1` |
| Python | `3.14` (Frappe requires `>=3.14,<3.15`) |
| Node.js | `24` (tested on `24.16.0`) |
| pnpm | `12.6.0` |
| Yarn | `1.22.22` |
| Bench CLI | `5.31.0` |
| MariaDB | `10.11` |
| Redis | `7.0` |
| wkhtmltopdf | `0.12.6.1` (with patched Qt) |

## Install

Install the tools listed above first, then create a bench pinned to the tested versions:

```bash
bench init modern-bench --frappe-branch v16.35.0 --python python3.14
cd modern-bench

bench get-app erpnext --branch v16.36.0
bench get-app https://github.com/sanikaap/erpnext-ui-update.git --branch main

bench new-site erp.localhost
bench --site erp.localhost install-app erpnext
bench --site erp.localhost install-app modern_erp_ui
bench --site erp.localhost add-to-hosts
```

`bench new-site` asks for your MariaDB root password and a new Administrator password.

Install the frontend from the lockfile, so you get the tested dependency versions:

```bash
cd apps/modern_erp_ui/frontend
pnpm install --frozen-lockfile
```

Create `apps/modern_erp_ui/frontend/.env`. This file is not in the repo, and the app will not start without it:

```bash
VITE_FRAPPE_BASE_URL=http://erp.localhost:8000
```

The port must match `webserver_port` in `sites/common_site_config.json`. A new bench normally uses `8000`.

## Run

Start each part in its own terminal.

Backend, from the bench folder:

```bash
bench start
```

Frontend, from `apps/modern_erp_ui/frontend`:

```bash
pnpm dev
```

1. On first run, open `http://erp.localhost:8000` and complete the ERPNext setup wizard.
2. Open `http://localhost:5173` and log in as `Administrator`.

## Demo data (optional)

The seed script expects a company named exactly `Tesla`, so create it in the setup wizard if you plan to use this. Run it with the backend running:

```bash
bench --site erp.localhost execute modern_erp_ui.sample_data.walkthrough_demo.seed
bench --site erp.localhost execute modern_erp_ui.sample_data.walkthrough_demo.status
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `VITE_FRAPPE_BASE_URL is not configured` | Create `frontend/.env` as shown above, then restart `pnpm dev`. |
| Login or API requests fail with a proxy error | Make sure `bench start` is running and the port in `frontend/.env` matches `webserver_port`. |
| `erp.localhost` does not resolve | Run `bench --site erp.localhost add-to-hosts`. |
| Forms fail to load scripts, or `/assets` returns 404 | Run `bench build` from the bench folder. |
| Python version error during `bench init` | Install Python 3.14 and pass it with `--python`. |
| Demo seed reports company errors | The company must be named `Tesla`. |

## Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/modern_erp_ui
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

## License

mit

# Hebrew WooCommerce Quick-Start

This repository contains a **Docker Compose** stack that spins up a ready-to-use WordPress installation in Hebrew with WooCommerce enabled.

## Prerequisites

* Docker ≥ 20.10
* Docker Compose ≥ 2.0

## 1. Configure environment

Duplicate the example env file and edit credentials / site details:

```bash
cp .env.example .env
# open .env and tweak values as needed
```

## 2. Boot the containers

Run the helper script (must have execution permission):

```bash
chmod +x scripts/init-wordpress.sh
scripts/init-wordpress.sh
```

What the script does:

1. Brings up the database and WordPress containers.
2. Waits until WordPress responds on `$WP_URL`.
3. Executes **wp-cli** inside the container to:
   * Install WordPress core in Hebrew (`he_IL`).
   * Activate the Hebrew language pack.
   * Install & activate **WooCommerce**.
   * Set timezone to *Asia/Jerusalem* and currency to *ILS*.

When the script finishes you can open the shop at [`http://localhost:8080`](http://localhost:8080) and log in with the admin credentials you placed in `.env`.

## File structure

```text
.
├── docker-compose.yml   # Services: db, wordpress, wpcli
├── .env.example         # Sample environment variables
├── scripts/
│   └── init-wordpress.sh
└── README.md            # This file
```

## Next steps

* Configure WooCommerce wizard (Tax, Shipping, Payments).
* Choose an RTL-friendly theme (e.g. *Astra*, *Kadence*, *Hello* + Elementor).
* Import initial products via CSV or REST-API.
* Harden security: add an SSL-terminating proxy (Nginx + Let's Encrypt).
* Set up automated backups for `db_data` and `wordpress_data` volumes.
#!/usr/bin/env bash
set -euo pipefail

# Load variables
source .env

# Bring up containers (detached)
docker-compose up -d db wordpress

# Wait until WordPress is responding
printf "Waiting for WordPress to be ready ...\n"
until $(curl --output /dev/null --silent --head --fail ${WP_URL}); do
    printf '.'
    sleep 5
done
printf "\nWordPress is up. Proceeding with setup ...\n"

# Install WordPress core (if not already installed)
docker-compose run --rm wpcli core install \
  --url="${WP_URL}" \
  --title="${WP_TITLE}" \
  --admin_user="${WP_ADMIN_USER}" \
  --admin_password="${WP_ADMIN_PASSWORD}" \
  --admin_email="${WP_ADMIN_EMAIL}" \
  --skip-email \
  --locale=he_IL || true

# Activate Hebrew language

docker-compose run --rm wpcli language core install he_IL || true
docker-compose run --rm wpcli language core activate he_IL || true

echo "Installing WooCommerce ..."

docker-compose run --rm wpcli plugin install woocommerce --activate

# Update store settings to Israeli locale/currency
docker-compose run --rm wpcli option update timezone_string "Asia/Jerusalem"
docker-compose run --rm wpcli option update woocommerce_currency ILS

echo "Setup completed! Access your site at ${WP_URL}"
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

# Install Astra RTL-ready theme

docker-compose run --rm wpcli theme install astra --activate

# Install additional plugins (Israeli payment gateway placeholder, security, utilities)
# Tranzila gateway slug might change; adjust if needed
PLUGINS=(
  "wordfence"
  "limit-login-attempts-reloaded"
  "wps-hide-login"
)
for p in "${PLUGINS[@]}"; do
  docker-compose run --rm wpcli plugin install "$p" --activate || true
done

# Create Israel shipping zone with flat rate 20₪ and free shipping above 250₪

docker-compose run --rm wpcli eval '
if ( class_exists( "WC_Shipping_Zones" ) ) {
  $zone = new WC_Shipping_Zone();
  $zone->set_zone_name( "Israel" );
  $zone->save();
  $zone_id = $zone->get_id();
  // Add country IL
  $zone->add_location( "IL", "country" );
  // Flat rate instance
  $instance_id = $zone->add_shipping_method( "flat_rate" );
  $methods = $zone->get_shipping_methods( true );
  if ( isset( $methods[ $instance_id ] ) ) {
    $instance = $methods[ $instance_id ];
    $instance->settings[ "cost" ] = "20";
    $instance->save();
  }
  // Free shipping instance above threshold
  $free_id = $zone->add_shipping_method( "free_shipping" );
  $methods = $zone->get_shipping_methods( true );
  if ( isset( $methods[ $free_id ] ) ) {
    $free = $methods[ $free_id ];
    $free->settings[ "min_amount" ] = "250";
    $free->save();
  }
}
'

# Set store base country to Israel

docker-compose run --rm wpcli option update woocommerce_default_country "IL"

# Add basic product categories
CATS=("ביגוד" "אלקטרוניקה" "מתנות")
for c in "${CATS[@]}"; do
  docker-compose run --rm wpcli term create product_cat "$c" --description="קטגוריית $c לדוגמה" --slug="$(echo $c | iconv -f utf-8 -t ascii//TRANSLIT | tr ' ' '-' | tr '[:upper:]' '[:lower:]')" || true
done

# Insert sample products
# Parameters: title price category_slug
add_product() {
  TITLE="$1"; PRICE="$2"; SLUG="$3";
  docker-compose run --rm wpcli post create \
    --post_type=product \
    --post_title="$TITLE" \
    --post_status=publish \
    --meta_input="{\"_regular_price\":\"$PRICE\",\"_price\":\"$PRICE\",\"_stock_status\":\"instock\"}" \
    --tax_input="product_cat=$SLUG" || true
}

add_product "חולצת טריקו" "59" "bigud"
add_product "אוזניות אלחוטיות" "199" "elektroniqa"
add_product "מארז שי" "149" "mtnt"

# Basic hardening – disable theme/plugin editors via WP Admin

docker-compose run --rm wpcli config set DISALLOW_FILE_EDIT true --raw --type=constant --quiet || true

# Flush rewrite rules (useful for new permalinks/mobile login slug)

docker-compose run --rm wpcli rewrite flush --hard
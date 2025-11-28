#!/bin/bash
# generate-certs.sh
# Generates self-signed SSL certificates for local development
# Usage: ./nginx/generate-certs.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$SCRIPT_DIR/ssl"

# Certificate configuration
TARGET_HOST="${1:-localhost}"
DOMAIN="$TARGET_HOST"
DAYS_VALID="${DAYS_VALID:-365}"
COUNTRY="${COUNTRY:-US}"
STATE="${STATE:-State}"
CITY="${CITY:-City}"
ORG="${ORG:-Rune Development}"
ORG_UNIT="${ORG_UNIT:-Development}"

echo "🔐 Generating SSL certificates for: $DOMAIN"
echo "📁 Output directory: $SSL_DIR"

# Create ssl directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate private key
echo "🔑 Generating private key..."
openssl genrsa -out "$SSL_DIR/server.key" 2048

echo "📝 Generating certificate signing request..."

# Create CSR config file
cat > "$SSL_DIR/csr.conf" << EOF
[req]
distinguished_name = req_distinguished_name
prompt = no

[req_distinguished_name]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORG
OU = $ORG_UNIT
CN = $DOMAIN
EOF

openssl req -new \
    -key "$SSL_DIR/server.key" \
    -out "$SSL_DIR/server.csr" \
    -config "$SSL_DIR/csr.conf"

# Create config file for SAN (Subject Alternative Names)
cat > "$SSL_DIR/cert.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORG
OU = $ORG_UNIT
CN = $DOMAIN

[v3_req]
keyUsage = critical, digitalSignature, keyAgreement
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Add the target host to SANs
if [[ "$TARGET_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "IP.3 = $TARGET_HOST" >> "$SSL_DIR/cert.conf"
elif [ "$TARGET_HOST" != "localhost" ]; then
    echo "DNS.3 = $TARGET_HOST" >> "$SSL_DIR/cert.conf"
    echo "DNS.4 = *.$TARGET_HOST" >> "$SSL_DIR/cert.conf"
fi

# Generate self-signed certificate
echo "📜 Generating self-signed certificate..."
openssl x509 -req \
    -days "$DAYS_VALID" \
    -in "$SSL_DIR/server.csr" \
    -signkey "$SSL_DIR/server.key" \
    -out "$SSL_DIR/server.crt" \
    -extfile "$SSL_DIR/cert.conf" \
    -extensions v3_req

# Set appropriate permissions
chmod 600 "$SSL_DIR/server.key"
chmod 644 "$SSL_DIR/server.crt"

# Clean up temporary files
rm -f "$SSL_DIR/server.csr" "$SSL_DIR/csr.conf" "$SSL_DIR/cert.conf"

echo ""
echo "✅ SSL certificates generated successfully!"
echo ""
echo "📄 Files created:"
echo "   - $SSL_DIR/server.key (private key)"
echo "   - $SSL_DIR/server.crt (certificate)"
echo ""
echo "📌 Certificate details:"
openssl x509 -in "$SSL_DIR/server.crt" -noout -subject -dates
echo ""
echo "⚠️  Note: This is a self-signed certificate for development only."
echo "    Your browser will show a security warning - this is expected."
echo ""
echo "🚀 To use with nginx:"
echo "   docker compose -f docker-compose.yml -f docker-compose.nginx.yml up"

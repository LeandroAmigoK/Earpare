#!/bin/bash
set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Uso: ./scripts/init-ssl.sh <dominio> <email>"
    echo "Ejemplo: ./scripts/init-ssl.sh earrape.duckdns.org contacto@ejemplo.com"
    exit 1
fi

echo "=== Obteniendo certificado SSL para: $DOMAIN ==="

# Actualizar el archivo de configuración de Nginx con el dominio proporcionado
sed -i "s/earrape.duckdns.org/$DOMAIN/g" nginx/conf.d/earrape.conf

# Ejecutar certbot para registrar el certificado mediante webroot
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

echo "Recargando Nginx con el nuevo certificado SSL..."
docker compose exec nginx nginx -s reload

echo "Listo! Tu servicio ahora cuenta con HTTPS activo en: https://$DOMAIN"

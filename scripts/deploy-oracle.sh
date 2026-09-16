#!/bin/bash
set -e

# EarRape - Oracle VPS Setup & Deployment Script
# Tested on Ubuntu / Oracle Linux

echo "=== [1/5] Actualizando paquetes del sistema ==="
sudo apt-get update -y && sudo apt-get upgrade -y || sudo yum update -y

echo "=== [2/5] Verificando e instalando Docker & Docker Compose ==="
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

if ! docker compose version &> /dev/null; then
    echo "Instalando Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin || true
fi

echo "=== [3/5] Abriendo puertos en Firewall local (80 y 443) ==="
if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 8080/tcp
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --zone=public --add-port=80/tcp
    sudo firewall-cmd --permanent --zone=public --add-port=443/tcp
    sudo firewall-cmd --permanent --zone=public --add-port=8080/tcp
    sudo firewall-cmd --reload
fi

# In Oracle Cloud, iptables might have default REJECT rules on INPUT chain
echo "Configurando reglas iptables para Oracle Cloud..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true

echo "=== [4/5] Creando directorios y configurando .env ==="
mkdir -p data uploads/music uploads/covers nginx/conf.d

if [ ! -f .env ]; then
    cp .env.example .env
    echo ">>> IMPORTANTE: Edita el archivo .env con tu dominio y credenciales de GTA:W."
fi

echo "=== [5/5] Construyendo y levantando contenedores ==="
docker compose build
docker compose up -d

echo ""
echo "=========================================================="
echo " EarRape desplegado exitosamente!"
echo " Si usas dominio con SSL (DuckDNS / Let's Encrypt),"
echo " ejecuta: ./scripts/init-ssl.sh tudominio.duckdns.org tuemail@ejemplo.com"
echo "=========================================================="

#!/bin/bash
# Instala no servidor de produção o deploy-crm e o monitor de disco do Docker.
# Uso (na VM, dentro desta pasta): sudo bash install.sh
set -e
cd "$(dirname "$0")"

cp -p /usr/local/bin/deploy-crm "/usr/local/bin/deploy-crm.bak-$(date +%Y%m%d%H%M)"
install -m 755 -o root -g root deploy-crm /usr/local/bin/deploy-crm
install -m 755 -o root -g root check-docker-disk /usr/local/bin/check-docker-disk
install -m 644 -o root -g root check-docker-disk.service check-docker-disk.timer /etc/systemd/system/
install -m 644 -o root -g root docker-disk-alert.sh /etc/profile.d/docker-disk-alert.sh
restorecon /usr/local/bin/deploy-crm /usr/local/bin/check-docker-disk \
    /etc/systemd/system/check-docker-disk.* /etc/profile.d/docker-disk-alert.sh 2>/dev/null || true

systemctl daemon-reload
systemctl enable --now check-docker-disk.timer
systemctl start check-docker-disk.service

echo
systemctl list-timers check-docker-disk.timer --no-pager | head -2
df -h /docker | tail -1
echo "Instalação concluída."

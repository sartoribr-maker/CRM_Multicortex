# Alerta no login quando o disco do Docker está cheio (ver check-docker-disk)
if [ -f /run/docker-disk-alert ]; then
    printf '\n\033[1;31m[ALERTA] Disco do Docker quase cheio:\033[0m %s\n' "$(cat /run/docker-disk-alert)"
    printf 'Veja: df -h /docker ; docker system df ; journalctl -t docker-disk\n\n'
fi

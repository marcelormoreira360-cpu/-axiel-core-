#!/usr/bin/env bash
# =============================================================================
#  backup-db.sh — atalho para a rotina de backup do OXIEL Core.
#
#  A implementação REAL e o segredo (string de conexão) ficam em ~/.oxiel/,
#  FORA de ~/Documents — necessário para o agendador automático do macOS
#  (launchd) poder rodar sem esbarrar na proteção de privacidade (TCC).
#
#  Backup manual:   bash scripts/backup-db.sh   (ou  bash ~/.oxiel/backup-db.sh)
#  Agendado 8h/dia: ~/Library/LaunchAgents/com.oxiel.core-backup.plist
#  Dumps em:        ~/.oxiel/backups/   (fora do Git e fora do iCloud)
# =============================================================================
exec /bin/bash "$HOME/.oxiel/backup-db.sh"

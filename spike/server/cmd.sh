#!/usr/bin/env bash
# Sends one console command to the running test server: cmd.sh "op Boaty"
printf '%s\n' "$*" >> "$(dirname "$0")/run/console.in"

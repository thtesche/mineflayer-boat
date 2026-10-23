#!/usr/bin/env bash
# Starts the throwaway test server in the foreground. Console commands can be
# fed by appending lines to spike/server/run/console.in (see cmd.sh).
set -euo pipefail
cd "$(dirname "$0")/run"
JAVA_HOME="${JAVA_HOME_21:-$(/usr/libexec/java_home -v 21)}"
: > console.in
exec tail -f console.in | "$JAVA_HOME/bin/java" -Xms1G -Xmx2G -jar server.jar nogui

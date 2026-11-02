FROM openjdk:25-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    grep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /server

# Download vanilla 26.1 server using Mojang manifest
RUN MANIFEST=$(curl -fsSL https://piston-meta.mojang.com/mc/game/version_manifest_v2.json) && \
    VERSION_JSON_URL=$(echo "$MANIFEST" | grep -o '"url":"[^"]*' | grep '26.1' | head -1 | cut -d'"' -f4) && \
    VERSION_JSON=$(curl -fsSL "$VERSION_JSON_URL") && \
    JAR_URL=$(echo "$VERSION_JSON" | grep -o '"url":"[^"]*server[^"]*' | head -1 | cut -d'"' -f4) && \
    curl -fsSL "$JAR_URL" -o server.jar && \
    test -f server.jar && echo "✓ Server JAR downloaded"

# Accept EULA
RUN echo "eula=true" > eula.txt

# Server properties for testing
COPY server.properties.template server.properties

EXPOSE 25599

# Create console.in and tail it into java
CMD sh -c 'touch console.in && tail -f console.in | java -Xms512M -Xmx1G -jar server.jar nogui'

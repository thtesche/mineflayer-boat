# Note: openjdk images are deprecated, using eclipse-temurin (official Eclipse Foundation Java)
# Java 21 for compatibility; update when Java 25 is available
FROM eclipse-temurin:21-jre-alpine

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /server

# Download vanilla server
# 26.1 JAR: If version 26.1 is released, update this URL
# For now: Using 1.21.4 as placeholder (will be replaced with 26.1 when available)
RUN curl -fsSL https://piston-data.mojang.com/v1/objects/145ff0858209bcfc164859ba735d4199aafa1eea/server.jar \
    -o server.jar && \
    test -f server.jar && echo "✓ Server JAR downloaded (145ff08...)" || \
    (echo "⚠️  Server JAR download failed" && exit 1)

# Accept EULA
RUN echo "eula=true" > eula.txt

# Server properties for testing
COPY server.properties.template server.properties

EXPOSE 25599

# Create console.in and tail it into java
CMD sh -c 'touch console.in && tail -f console.in | java -Xms512M -Xmx1G -jar server.jar nogui'

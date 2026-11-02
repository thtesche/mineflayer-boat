FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache \
    curl \
    ca-certificates

WORKDIR /server

# Download vanilla 1.21.4 server
RUN curl -fsSL https://piston-data.mojang.com/v1/objects/4707d00eb834b446575d89a61a11b5d548d8c001/server.jar \
    -o server.jar

# Accept EULA
RUN echo "eula=true" > eula.txt

# Server properties for testing
COPY server.properties.template server.properties

EXPOSE 25599

# Tail console input for commands
CMD tail -f console.in | java -Xms512M -Xmx1G -jar server.jar nogui

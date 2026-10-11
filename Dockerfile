FROM node:20-bookworm-slim AS frontend-build
WORKDIR /src/client
ENV NPM_CONFIG_CACHE=/tmp/.npm \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
COPY src/Quizmam.Api/ClientApp/package*.json ./
RUN npm --version && node --version
RUN npm install --include=dev --prefer-offline \
  || (echo "npm install failed, dumping logs..." \
  && find /tmp/.npm /root/.npm -maxdepth 8 -type f -name "*.log" -print -exec cat {} \; 2>/dev/null \
  && exit 1)
COPY src/Quizmam.Api/ClientApp/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY . .
COPY --from=frontend-build /src/client/dist ./src/Quizmam.Api/wwwroot
RUN dotnet publish ./src/Quizmam.Api/Quizmam.Api.csproj -c Release -p:SkipClientBuild=true -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:8081
EXPOSE 8081
VOLUME ["/data"]
COPY --from=backend-build /app/publish .
ENTRYPOINT ["dotnet", "Quizmam.Api.dll"]

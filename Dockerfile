FROM node:22-bookworm-slim AS frontend-build
WORKDIR /src/client
COPY src/Quizmam.Api/ClientApp/package*.json ./
RUN npm install -g npm@10
RUN npm --version && node --version
RUN npm ci --no-audit --no-fund --cache /tmp/.npm --prefer-offline \
  || (echo "npm ci failed, dumping logs..." \
  && find /tmp/.npm -type f -name "*.log" -maxdepth 5 -print -exec cat {} \; \
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

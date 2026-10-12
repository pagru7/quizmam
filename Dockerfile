FROM node:22.12.0-bookworm-slim AS frontend-build
WORKDIR /src

COPY src/Quizmam.Api/ClientApp/package*.json ./Quizmam.Api/ClientApp/
WORKDIR /src/Quizmam.Api/ClientApp
RUN npm ci --include=dev --no-audit --no-fund \
  || (echo "npm install failed; dumping npm logs" \
  && ls -la /root/.npm/_logs \
  && cat /root/.npm/_logs/*-debug-0.log \
  && false)

COPY src/Quizmam.Api/ClientApp/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY . .
COPY --from=frontend-build /src/Quizmam.Api/ClientApp/dist ./src/Quizmam.Api/wwwroot
RUN dotnet publish ./src/Quizmam.Api/Quizmam.Api.csproj -c Release -p:SkipClientBuild=true -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
VOLUME ["/data"]
COPY --from=backend-build /app/publish .
ENTRYPOINT ["dotnet", "Quizmam.Api.dll"]

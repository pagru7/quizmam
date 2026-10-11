# Quizmam

Quizmam is a local-network vocabulary learning app:
- **Backend:** ASP.NET Core 10 + FastEndpoints + EF Core (SQLite)
- **Frontend:** React + TypeScript + MUI
- **Architecture:** Vertical Slice (`Features/<Feature>/<UseCase>`)

## Prerequisites

- .NET SDK 10
- Node.js 22+
- npm 11+
- Docker (for container deployment)

## Local Development

1. Install frontend dependencies:

```powershell
cd src\Quizmam.Api\ClientApp
npm install
```

2. Build frontend and copy static assets:

```powershell
npm run build
cd ..\..
Remove-Item -Recurse -Force src\Quizmam.Api\wwwroot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path src\Quizmam.Api\wwwroot | Out-Null
Copy-Item -Recurse -Force src\Quizmam.Api\ClientApp\dist\* src\Quizmam.Api\wwwroot\
```

3. Run backend:

```powershell
cd src\Quizmam.Api
dotnet run
```

App URL: `http://localhost:5128` (or the port shown by `dotnet run`)

## Tests

```powershell
dotnet test tests\Quizmam.Api.Tests\Quizmam.Api.Tests.csproj
```

## Docker (Local Server / LAN)

Build and run:

```powershell
docker compose up --build -d
```

Access from local network:

- `http://<server-ip>:8080`

The SQLite database persists in Docker volume `quizmam-data`, mounted at `/data`.

## API Overview

- `GET /api/health`
- `GET /api/users`
- `POST /api/users/select-or-create`
- `POST /api/users/switch`
- `GET /api/users/me`
- `POST /api/users/logout`
- `GET /api/languages`
- `GET /api/collections?scope=my|all`
- `POST /api/collections`
- `PUT /api/collections/{id}`
- `DELETE /api/collections/{id}`
- `GET /api/collections/{id}`
- `POST /api/learning/evaluate`
- `POST /api/tests/submit`
- `GET /api/tests/collections/{id}/stats`
- `GET /api/practice/problematic?limit=10|20|30`

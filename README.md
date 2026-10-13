# Quizmam

Quizmam is a local-network vocabulary learning app:
- **Backend:** ASP.NET Core 10 + FastEndpoints + EF Core (SQLite)
- **Frontend:** static HTML + jQuery + Bootstrap 5
- **Architecture:** Vertical Slice (`Features/<Feature>/<UseCase>`)

## Prerequisites

- .NET SDK 10
- Docker (optional, for container deployment)

## Local Development

Run the API locally:

```powershell
cd src\Quizmam.Api
dotnet run
```

App URL: `http://localhost:5128` (or the port shown by `dotnet run`)

## Debugging in Visual Studio

Open `Quizmam.slnx` in Visual Studio, set the `Quizmam.Api` project as the startup project, and press F5.

For browser-side debugging, inspect the static frontend in `src/Quizmam.Api/wwwroot/index.html`, `app.js`, and `styles.css`.
The app is served by the ASP.NET Core host, so the browser loads the static assets from the same process.

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

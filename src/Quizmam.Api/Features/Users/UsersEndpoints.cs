using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Quizmam.Api.Common;
using Quizmam.Api.Domain;
using Quizmam.Api.Infrastructure;

namespace Quizmam.Api.Features.Users;

public sealed class GetUsersEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<List<GetUsersResponseItem>>
{
    public override void Configure()
    {
        Get("/api/users");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var users = await dbContext.Users
            .OrderBy(x => x.Name)
            .Select(x => new GetUsersResponseItem(x.Id, x.Name))
            .ToListAsync(ct);

        await Send.OkAsync(users, ct);
    }
}

public record GetUsersResponseItem(Guid Id, string Name);

public sealed record SelectOrCreateUserRequest(string Name);
public sealed record SelectOrCreateUserResponse(Guid Id, string Name);

public sealed class SelectOrCreateUserValidator : Validator<SelectOrCreateUserRequest>
{
    public SelectOrCreateUserValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
    }
}

public sealed class SelectOrCreateUserEndpoint(AppDbContext dbContext) : Endpoint<SelectOrCreateUserRequest, SelectOrCreateUserResponse>
{
    public override void Configure()
    {
        Post("/api/users/select-or-create");
        AllowAnonymous();
    }

    public override async Task HandleAsync(SelectOrCreateUserRequest req, CancellationToken ct)
    {
        var name = req.Name.Trim();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Name == name, ct);
        if (user is null)
        {
            user = new User { Name = name };
            dbContext.Users.Add(user);
            try
            {
                await dbContext.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                user = await dbContext.Users.FirstAsync(x => x.Name == name, ct);
            }
        }

        CurrentUserCookie.Set(HttpContext.Response, user.Id);
        await Send.OkAsync(new SelectOrCreateUserResponse(user.Id, user.Name), ct);
    }
}

public sealed class GetCurrentUserEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<SelectOrCreateUserResponse>
{
    public override void Configure()
    {
        Get("/api/users/me");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == currentUserId.Value, ct);
        if (user is null)
        {
            CurrentUserCookie.Clear(HttpContext.Response);
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new SelectOrCreateUserResponse(user.Id, user.Name), ct);
    }
}

public sealed class SwitchUserEndpoint(AppDbContext dbContext) : Endpoint<SelectOrCreateUserRequest, SelectOrCreateUserResponse>
{
    public override void Configure()
    {
        Post("/api/users/switch");
        AllowAnonymous();
    }

    public override async Task HandleAsync(SelectOrCreateUserRequest req, CancellationToken ct)
    {
        var name = req.Name.Trim();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Name == name, ct);
        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        CurrentUserCookie.Set(HttpContext.Response, user.Id);
        await Send.OkAsync(new SelectOrCreateUserResponse(user.Id, user.Name), ct);
    }
}

public sealed class LogoutEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Post("/api/users/logout");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        CurrentUserCookie.Clear(HttpContext.Response);
        await Send.NoContentAsync(ct);
    }
}

using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Quizmam.Api.Infrastructure;

namespace Quizmam.Api.Features.Languages;

public sealed record LanguageResponse(Guid Id, string Name);

public sealed class GetLanguagesEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<List<LanguageResponse>>
{
    public override void Configure()
    {
        Get("/api/languages");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var languages = await dbContext.Languages
            .OrderBy(x => x.Name)
            .Select(x => new LanguageResponse(x.Id, x.Name))
            .ToListAsync(ct);

        await Send.OkAsync(languages, ct);
    }
}

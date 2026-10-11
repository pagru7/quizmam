using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Quizmam.Api.Common;
using Quizmam.Api.Domain;
using Quizmam.Api.Infrastructure;

namespace Quizmam.Api.Features.Collections;

public sealed record WordPairInput(string SourceText, string TargetText);
public sealed record CollectionWriteRequest(string Name, Guid SourceLanguageId, Guid TargetLanguageId, List<WordPairInput> Pairs);
public sealed record CollectionSummaryResponse(Guid Id, string Name, string OwnerName, string SourceLanguage, string TargetLanguage, int PairCount, int TestCount, double AverageScore);
public sealed record CollectionDetailsResponse(
    Guid Id,
    string Name,
    Guid OwnerId,
    string OwnerName,
    Guid SourceLanguageId,
    string SourceLanguage,
    Guid TargetLanguageId,
    string TargetLanguage,
    List<WordPairResponse> Pairs);
public sealed record WordPairResponse(Guid Id, string SourceText, string TargetText, int SortOrder);
public sealed record CollectionStatsResponse(int TestsTaken, int CorrectCount, int TypoCount, int WrongCount, double AverageScore);

public sealed class CollectionWriteValidator : Validator<CollectionWriteRequest>
{
    public CollectionWriteValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.SourceLanguageId).NotEmpty();
        RuleFor(x => x.TargetLanguageId).NotEmpty();
        RuleFor(x => x.Pairs).NotNull();
    }
}

public sealed class GetCollectionsEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<List<CollectionSummaryResponse>>
{
    public override void Configure()
    {
        Get("/api/collections");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var scope = Query<string>("scope", isRequired: false)?.Trim().ToLowerInvariant() ?? "my";
        var query = dbContext.Collections
            .Include(x => x.Owner)
            .Include(x => x.SourceLanguage)
            .Include(x => x.TargetLanguage)
            .Include(x => x.WordPairs)
            .Include(x => x.TestSessions)
            .AsQueryable();

        if (scope == "my")
        {
            query = query.Where(x => x.OwnerId == currentUserId.Value);
        }

        var result = await query
            .OrderByDescending(x => x.UpdatedAt)
            .Select(x => new CollectionSummaryResponse(
                x.Id,
                x.Name,
                x.Owner.Name,
                x.SourceLanguage.Name,
                x.TargetLanguage.Name,
                x.WordPairs.Count,
                x.TestSessions.Count,
                x.TestSessions.Count == 0 ? 0 : x.TestSessions.Average(t => t.ScorePercent)))
            .ToListAsync(ct);

        await Send.OkAsync(result, ct);
    }
}

public sealed class CreateCollectionEndpoint(AppDbContext dbContext) : Endpoint<CollectionWriteRequest, CollectionDetailsResponse>
{
    public override void Configure()
    {
        Post("/api/collections");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CollectionWriteRequest req, CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var cleanPairs = req.Pairs
            .Select(x => new WordPairInput((x.SourceText ?? string.Empty).Trim(), (x.TargetText ?? string.Empty).Trim()))
            .Where(x => x.SourceText.Length > 0 && x.TargetText.Length > 0)
            .ToList();

        if (cleanPairs.Count < 2)
        {
            AddError("At least two complete word pairs are required.");
            await Send.ErrorsAsync(400, ct);
            return;
        }

        var collection = new Collection
        {
            Name = req.Name.Trim(),
            OwnerId = currentUserId.Value,
            SourceLanguageId = req.SourceLanguageId,
            TargetLanguageId = req.TargetLanguageId,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.Collections.Add(collection);
        for (var i = 0; i < cleanPairs.Count; i++)
        {
            dbContext.WordPairs.Add(new WordPair
            {
                Collection = collection,
                SourceText = cleanPairs[i].SourceText,
                TargetText = cleanPairs[i].TargetText,
                SortOrder = i
            });
        }

        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            AddError("Collection name must be unique per owner.");
            await Send.ErrorsAsync(409, ct);
            return;
        }

        var created = await CollectionMapper.LoadCollectionAsync(dbContext, collection.Id, ct);
        await Send.CreatedAtAsync<GetCollectionDetailsEndpoint>(new { id = collection.Id }, created, cancellation: ct);
    }
}

public sealed class UpdateCollectionEndpoint(AppDbContext dbContext) : Endpoint<UpdateCollectionRequest, CollectionDetailsResponse>
{
    public override void Configure()
    {
        Put("/api/collections/{id:guid}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(UpdateCollectionRequest req, CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        if (Route<Guid>("id") != req.Id)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var collection = await dbContext.Collections.Include(x => x.WordPairs)
            .FirstOrDefaultAsync(x => x.Id == req.Id, ct);
        if (collection is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (collection.OwnerId != currentUserId.Value)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        var cleanPairs = req.Pairs
            .Select(x => new WordPairInput((x.SourceText ?? string.Empty).Trim(), (x.TargetText ?? string.Empty).Trim()))
            .Where(x => x.SourceText.Length > 0 && x.TargetText.Length > 0)
            .ToList();

        if (cleanPairs.Count < 2)
        {
            AddError("At least two complete word pairs are required.");
            await Send.ErrorsAsync(400, ct);
            return;
        }

        collection.Name = req.Name.Trim();
        collection.SourceLanguageId = req.SourceLanguageId;
        collection.TargetLanguageId = req.TargetLanguageId;
        collection.UpdatedAt = DateTime.UtcNow;

        dbContext.WordPairs.RemoveRange(collection.WordPairs);
        for (var i = 0; i < cleanPairs.Count; i++)
        {
            dbContext.WordPairs.Add(new WordPair
            {
                CollectionId = collection.Id,
                SourceText = cleanPairs[i].SourceText,
                TargetText = cleanPairs[i].TargetText,
                SortOrder = i
            });
        }

        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            AddError("Collection name must be unique per owner.");
            await Send.ErrorsAsync(409, ct);
            return;
        }

        var updated = await CollectionMapper.LoadCollectionAsync(dbContext, collection.Id, ct);
        if (updated is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(updated, ct);
    }
}

public sealed record UpdateCollectionRequest(Guid Id, string Name, Guid SourceLanguageId, Guid TargetLanguageId, List<WordPairInput> Pairs);

public sealed class UpdateCollectionValidator : Validator<UpdateCollectionRequest>
{
    public UpdateCollectionValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.SourceLanguageId).NotEmpty();
        RuleFor(x => x.TargetLanguageId).NotEmpty();
        RuleFor(x => x.Pairs).NotNull();
    }
}

public sealed class DeleteCollectionEndpoint(AppDbContext dbContext) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Delete("/api/collections/{id:guid}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var collection = await dbContext.Collections.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (collection is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (collection.OwnerId != currentUserId.Value)
        {
            await Send.ForbiddenAsync(ct);
            return;
        }

        dbContext.Collections.Remove(collection);
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public sealed class GetCollectionDetailsEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<CollectionDetailsResponse>
{
    public override void Configure()
    {
        Get("/api/collections/{id:guid}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var id = Route<Guid>("id");
        var response = await CollectionMapper.LoadCollectionAsync(dbContext, id, ct);
        if (response is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(response, ct);
    }
}

public sealed class GetCollectionStatsEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<CollectionStatsResponse>
{
    public override void Configure()
    {
        Get("/api/tests/collections/{id:guid}/stats");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var collectionId = Route<Guid>("id");
        var sessions = await dbContext.TestSessions
            .Where(x => x.CollectionId == collectionId)
            .ToListAsync(ct);

        var response = new CollectionStatsResponse(
            sessions.Count,
            sessions.Sum(x => x.CorrectCount),
            sessions.Sum(x => x.TypoCount),
            sessions.Sum(x => x.WrongCount),
            sessions.Count == 0 ? 0 : sessions.Average(x => x.ScorePercent));

        await Send.OkAsync(response, ct);
    }
}

internal static class CollectionMapper
{
    public static async Task<CollectionDetailsResponse?> LoadCollectionAsync(AppDbContext dbContext, Guid id, CancellationToken ct)
    {
        return await dbContext.Collections
            .Where(x => x.Id == id)
            .Select(x => new CollectionDetailsResponse(
                x.Id,
                x.Name,
                x.OwnerId,
                x.Owner.Name,
                x.SourceLanguageId,
                x.SourceLanguage.Name,
                x.TargetLanguageId,
                x.TargetLanguage.Name,
                x.WordPairs.OrderBy(p => p.SortOrder).Select(p => new WordPairResponse(p.Id, p.SourceText, p.TargetText, p.SortOrder)).ToList()))
            .FirstOrDefaultAsync(ct);
    }
}

using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Quizmam.Api.Common;
using Quizmam.Api.Domain;
using Quizmam.Api.Infrastructure;

namespace Quizmam.Api.Features.Learning;

public sealed record EvaluateAnswerRequest(Guid WordPairId, string Direction, string EnteredText);
public sealed record EvaluateAnswerResponse(Guid WordPairId, string ExpectedText, string EnteredText, string Outcome);

public sealed class EvaluateAnswerValidator : Validator<EvaluateAnswerRequest>
{
    public EvaluateAnswerValidator()
    {
        RuleFor(x => x.WordPairId).NotEmpty();
        RuleFor(x => x.Direction).NotEmpty();
        RuleFor(x => x.EnteredText).NotNull();
    }
}

public sealed class EvaluateAnswerEndpoint(AppDbContext dbContext) : Endpoint<EvaluateAnswerRequest, EvaluateAnswerResponse>
{
    public override void Configure()
    {
        Post("/api/learning/evaluate");
        AllowAnonymous();
    }

    public override async Task HandleAsync(EvaluateAnswerRequest req, CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var wordPair = await dbContext.WordPairs
            .Include(x => x.Collection)
            .FirstOrDefaultAsync(x => x.Id == req.WordPairId, ct);
        if (wordPair is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var sourceToTarget = req.Direction.Equals("source-to-target", StringComparison.OrdinalIgnoreCase);
        var expected = sourceToTarget ? wordPair.TargetText : wordPair.SourceText;
        var outcome = AnswerEvaluationService.ClassifyAnswer(expected, req.EnteredText);

        if (outcome != AnswerOutcome.Correct)
        {
            await LearningStats.UpsertMistakeStatAsync(dbContext, currentUserId.Value, wordPair.Id, outcome, ct);
        }

        await Send.OkAsync(new EvaluateAnswerResponse(wordPair.Id, expected, req.EnteredText, outcome.ToString().ToLowerInvariant()), ct);
    }
}

public sealed record TestAnswerSubmission(Guid WordPairId, string PromptDirection, string EnteredText);
public sealed record SubmitTestRequest(Guid CollectionId, List<TestAnswerSubmission> Answers);
public sealed record SubmitTestAnswerResponse(Guid WordPairId, string ExpectedText, string EnteredText, string Outcome);
public sealed record SubmitTestResponse(Guid SessionId, int TotalQuestions, int CorrectCount, int TypoCount, int WrongCount, double ScorePercent, List<SubmitTestAnswerResponse> Answers);

public sealed class SubmitTestValidator : Validator<SubmitTestRequest>
{
    public SubmitTestValidator()
    {
        RuleFor(x => x.CollectionId).NotEmpty();
        RuleFor(x => x.Answers).NotNull().NotEmpty();
    }
}

public sealed class SubmitTestEndpoint(AppDbContext dbContext) : Endpoint<SubmitTestRequest, SubmitTestResponse>
{
    public override void Configure()
    {
        Post("/api/tests/submit");
        AllowAnonymous();
    }

    public override async Task HandleAsync(SubmitTestRequest req, CancellationToken ct)
    {
        var currentUserId = CurrentUserCookie.Read(HttpContext.Request);
        if (currentUserId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var collection = await dbContext.Collections
            .Include(x => x.WordPairs)
            .FirstOrDefaultAsync(x => x.Id == req.CollectionId, ct);
        if (collection is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var indexedPairs = collection.WordPairs.ToDictionary(x => x.Id);
        var evaluated = new List<(Guid wordPairId, string expected, string entered, AnswerOutcome outcome, string direction)>();
        foreach (var answer in req.Answers)
        {
            if (!indexedPairs.TryGetValue(answer.WordPairId, out var pair))
            {
                continue;
            }

            var sourceToTarget = answer.PromptDirection.Equals("source-to-target", StringComparison.OrdinalIgnoreCase);
            var expected = sourceToTarget ? pair.TargetText : pair.SourceText;
            var outcome = AnswerEvaluationService.ClassifyAnswer(expected, answer.EnteredText);
            evaluated.Add((pair.Id, expected, answer.EnteredText, outcome, answer.PromptDirection));
        }

        if (evaluated.Count == 0)
        {
            AddError("No valid answers were submitted.");
            await Send.ErrorsAsync(400, ct);
            return;
        }

        var correctCount = evaluated.Count(x => x.outcome == AnswerOutcome.Correct);
        var typoCount = evaluated.Count(x => x.outcome == AnswerOutcome.Typo);
        var wrongCount = evaluated.Count(x => x.outcome == AnswerOutcome.Wrong);
        var scorePercent = (double)correctCount / evaluated.Count * 100d;

        var session = new TestSession
        {
            UserId = currentUserId.Value,
            CollectionId = collection.Id,
            FinishedAt = DateTime.UtcNow,
            TotalQuestions = evaluated.Count,
            CorrectCount = correctCount,
            TypoCount = typoCount,
            WrongCount = wrongCount,
            ScorePercent = scorePercent
        };
        dbContext.TestSessions.Add(session);
        await dbContext.SaveChangesAsync(ct);

        foreach (var answer in evaluated)
        {
            dbContext.TestAnswers.Add(new TestAnswer
            {
                SessionId = session.Id,
                WordPairId = answer.wordPairId,
                PromptDirection = answer.direction,
                ExpectedText = answer.expected,
                EnteredText = answer.entered,
                Outcome = answer.outcome.ToString().ToLowerInvariant()
            });

            if (answer.outcome != AnswerOutcome.Correct)
            {
                await LearningStats.UpsertMistakeStatAsync(dbContext, currentUserId.Value, answer.wordPairId, answer.outcome, ct);
            }
        }

        await dbContext.SaveChangesAsync(ct);

        var response = new SubmitTestResponse(
            session.Id,
            evaluated.Count,
            correctCount,
            typoCount,
            wrongCount,
            scorePercent,
            evaluated.Select(x => new SubmitTestAnswerResponse(
                x.wordPairId,
                x.expected,
                x.entered,
                x.outcome.ToString().ToLowerInvariant())).ToList());

        await Send.OkAsync(response, ct);
    }
}

public sealed record ProblematicWordResponse(Guid WordPairId, Guid CollectionId, string CollectionName, string SourceText, string TargetText, int TypoCount, int WrongCount, int Score);

public sealed class GetProblematicWordsEndpoint(AppDbContext dbContext) : EndpointWithoutRequest<List<ProblematicWordResponse>>
{
    public override void Configure()
    {
        Get("/api/practice/problematic");
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

        var limit = Query<int?>("limit", false) ?? 10;
        if (limit is not (10 or 20 or 30))
        {
            AddError("Limit must be one of: 10, 20, 30.");
            await Send.ErrorsAsync(400, ct);
            return;
        }

        var stats = await dbContext.WordMistakeStats
            .Where(x => x.UserId == currentUserId.Value)
            .Include(x => x.WordPair)
            .ThenInclude(x => x.Collection)
            .ToListAsync(ct);

        var response = stats
            .Select(x => new ProblematicWordResponse(
                x.WordPairId,
                x.WordPair.CollectionId,
                x.WordPair.Collection.Name,
                x.WordPair.SourceText,
                x.WordPair.TargetText,
                x.TypoCount,
                x.WrongCount,
                ProblematicWordScore.Calculate(x.WrongCount, x.TypoCount)))
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => stats.First(s => s.WordPairId == x.WordPairId).UpdatedAt)
            .Take(limit)
            .ToList();

        await Send.OkAsync(response, ct);
    }
}

internal static class LearningStats
{
    public static async Task UpsertMistakeStatAsync(AppDbContext dbContext, Guid userId, Guid wordPairId, AnswerOutcome outcome, CancellationToken ct)
    {
        var stat = await dbContext.WordMistakeStats.FirstOrDefaultAsync(x => x.UserId == userId && x.WordPairId == wordPairId, ct);
        if (stat is null)
        {
            stat = new WordMistakeStat
            {
                UserId = userId,
                WordPairId = wordPairId,
                TypoCount = outcome == AnswerOutcome.Typo ? 1 : 0,
                WrongCount = outcome == AnswerOutcome.Wrong ? 1 : 0,
                UpdatedAt = DateTime.UtcNow
            };
            dbContext.WordMistakeStats.Add(stat);
            return;
        }

        if (outcome == AnswerOutcome.Typo)
        {
            stat.TypoCount += 1;
        }
        else if (outcome == AnswerOutcome.Wrong)
        {
            stat.WrongCount += 1;
        }

        stat.UpdatedAt = DateTime.UtcNow;
    }
}

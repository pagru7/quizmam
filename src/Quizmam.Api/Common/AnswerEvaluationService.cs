namespace Quizmam.Api.Common;

public enum AnswerOutcome
{
    Correct,
    Typo,
    Wrong
}

public static class AnswerEvaluationService
{
    public static AnswerOutcome ClassifyAnswer(string expectedText, string enteredText)
    {
        var expected = Normalize(expectedText);
        var entered = Normalize(enteredText);

        if (expected == entered)
        {
            return AnswerOutcome.Correct;
        }

        return LevenshteinDistance(expected, entered) == 1 ? AnswerOutcome.Typo : AnswerOutcome.Wrong;
    }

    private static string Normalize(string value) => (value ?? string.Empty).Trim().ToLowerInvariant();

    private static int LevenshteinDistance(string source, string target)
    {
        if (source.Length == 0) return target.Length;
        if (target.Length == 0) return source.Length;

        var matrix = new int[source.Length + 1, target.Length + 1];
        for (var i = 0; i <= source.Length; i++) matrix[i, 0] = i;
        for (var j = 0; j <= target.Length; j++) matrix[0, j] = j;

        for (var i = 1; i <= source.Length; i++)
        {
            for (var j = 1; j <= target.Length; j++)
            {
                var cost = source[i - 1] == target[j - 1] ? 0 : 1;
                matrix[i, j] = Math.Min(
                    Math.Min(matrix[i - 1, j] + 1, matrix[i, j - 1] + 1),
                    matrix[i - 1, j - 1] + cost);
            }
        }

        return matrix[source.Length, target.Length];
    }
}

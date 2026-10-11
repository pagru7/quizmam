using Quizmam.Api.Common;

namespace Quizmam.Api.Tests.Learning;

public class AnswerEvaluationServiceTests
{
    [Fact]
    public void ClassifyAnswer_ReturnsCorrect_WhenOnlyCaseAndWhitespaceDiffer()
    {
        var outcome = AnswerEvaluationService.ClassifyAnswer("  Kot  ", "kot");

        Assert.Equal(AnswerOutcome.Correct, outcome);
    }

    [Fact]
    public void ClassifyAnswer_ReturnsTypo_WhenEditDistanceIsOne()
    {
        var outcome = AnswerEvaluationService.ClassifyAnswer("house", "houze");

        Assert.Equal(AnswerOutcome.Typo, outcome);
    }

    [Fact]
    public void ClassifyAnswer_ReturnsWrong_WhenEditDistanceIsGreaterThanOne()
    {
        var outcome = AnswerEvaluationService.ClassifyAnswer("flower", "floor");

        Assert.Equal(AnswerOutcome.Wrong, outcome);
    }

    [Fact]
    public void ClassifyAnswer_TreatsDiacriticsAsDistinctCharacters()
    {
        var outcome = AnswerEvaluationService.ClassifyAnswer("lód", "lod");

        Assert.Equal(AnswerOutcome.Typo, outcome);
    }
}

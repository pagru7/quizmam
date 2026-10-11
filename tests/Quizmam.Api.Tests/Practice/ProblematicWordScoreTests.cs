using Quizmam.Api.Common;

namespace Quizmam.Api.Tests.Practice;

public class ProblematicWordScoreTests
{
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 0, 2)]
    [InlineData(0, 3, 3)]
    [InlineData(5, 4, 14)]
    public void CalculateProblemScore_UsesWeightedFormula(int wrongCount, int typoCount, int expected)
    {
        var score = ProblematicWordScore.Calculate(wrongCount, typoCount);

        Assert.Equal(expected, score);
    }
}

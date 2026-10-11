namespace Quizmam.Api.Common;

public static class ProblematicWordScore
{
    public static int Calculate(int wrongCount, int typoCount) => (wrongCount * 2) + typoCount;
}

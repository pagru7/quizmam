namespace Quizmam.Api.Domain;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Collection> Collections { get; set; } = new List<Collection>();
    public ICollection<TestSession> TestSessions { get; set; } = new List<TestSession>();
    public ICollection<WordMistakeStat> MistakeStats { get; set; } = new List<WordMistakeStat>();
}

public sealed class Language
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public ICollection<Collection> SourceCollections { get; set; } = new List<Collection>();
    public ICollection<Collection> TargetCollections { get; set; } = new List<Collection>();
}

public sealed class Collection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public Guid OwnerId { get; set; }
    public Guid SourceLanguageId { get; set; }
    public Guid TargetLanguageId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public User Owner { get; set; } = null!;
    public Language SourceLanguage { get; set; } = null!;
    public Language TargetLanguage { get; set; } = null!;
    public ICollection<WordPair> WordPairs { get; set; } = new List<WordPair>();
    public ICollection<TestSession> TestSessions { get; set; } = new List<TestSession>();
}

public sealed class WordPair
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CollectionId { get; set; }
    public required string SourceText { get; set; }
    public required string TargetText { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Collection Collection { get; set; } = null!;
    public ICollection<TestAnswer> TestAnswers { get; set; } = new List<TestAnswer>();
    public ICollection<WordMistakeStat> MistakeStats { get; set; } = new List<WordMistakeStat>();
}

public sealed class TestSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid CollectionId { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public int TotalQuestions { get; set; }
    public int CorrectCount { get; set; }
    public int TypoCount { get; set; }
    public int WrongCount { get; set; }
    public double ScorePercent { get; set; }
    public User User { get; set; } = null!;
    public Collection Collection { get; set; } = null!;
    public ICollection<TestAnswer> Answers { get; set; } = new List<TestAnswer>();
}

public sealed class TestAnswer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public Guid WordPairId { get; set; }
    public required string PromptDirection { get; set; }
    public required string ExpectedText { get; set; }
    public required string EnteredText { get; set; }
    public required string Outcome { get; set; }
    public TestSession Session { get; set; } = null!;
    public WordPair WordPair { get; set; } = null!;
}

public sealed class WordMistakeStat
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid WordPairId { get; set; }
    public int TypoCount { get; set; }
    public int WrongCount { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public User User { get; set; } = null!;
    public WordPair WordPair { get; set; } = null!;
}

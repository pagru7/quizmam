using Microsoft.EntityFrameworkCore;
using Quizmam.Api.Domain;

namespace Quizmam.Api.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Language> Languages => Set<Language>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<WordPair> WordPairs => Set<WordPair>();
    public DbSet<TestSession> TestSessions => Set<TestSession>();
    public DbSet<TestAnswer> TestAnswers => Set<TestAnswer>();
    public DbSet<WordMistakeStat> WordMistakeStats => Set<WordMistakeStat>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<Language>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<Collection>(entity =>
        {
            entity.HasIndex(x => new { x.OwnerId, x.Name }).IsUnique();
            entity.HasOne(x => x.Owner).WithMany(x => x.Collections).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.SourceLanguage).WithMany(x => x.SourceCollections).HasForeignKey(x => x.SourceLanguageId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.TargetLanguage).WithMany(x => x.TargetCollections).HasForeignKey(x => x.TargetLanguageId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<WordPair>(entity =>
        {
            entity.HasIndex(x => new { x.CollectionId, x.SortOrder });
            entity.HasOne(x => x.Collection).WithMany(x => x.WordPairs).HasForeignKey(x => x.CollectionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TestSession>(entity =>
        {
            entity.HasOne(x => x.User).WithMany(x => x.TestSessions).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Collection).WithMany(x => x.TestSessions).HasForeignKey(x => x.CollectionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TestAnswer>(entity =>
        {
            entity.HasOne(x => x.Session).WithMany(x => x.Answers).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.WordPair).WithMany(x => x.TestAnswers).HasForeignKey(x => x.WordPairId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WordMistakeStat>(entity =>
        {
            entity.HasIndex(x => new { x.UserId, x.WordPairId }).IsUnique();
            entity.HasOne(x => x.User).WithMany(x => x.MistakeStats).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.WordPair).WithMany(x => x.MistakeStats).HasForeignKey(x => x.WordPairId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}

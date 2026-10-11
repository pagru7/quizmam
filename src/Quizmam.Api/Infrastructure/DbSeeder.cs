using Microsoft.EntityFrameworkCore;
using Quizmam.Api.Domain;

namespace Quizmam.Api.Infrastructure;

public static class DbSeeder
{
    public static async Task SeedLanguagesAsync(AppDbContext dbContext, CancellationToken cancellationToken = default)
    {
        var defaults = new[] { "Polski", "Angielski" };
        foreach (var languageName in defaults)
        {
            var exists = await dbContext.Languages.AnyAsync(x => x.Name == languageName, cancellationToken);
            if (!exists)
            {
                dbContext.Languages.Add(new Language { Name = languageName });
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

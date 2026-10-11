namespace Quizmam.Api.Common;

public static class CurrentUserCookie
{
    public const string CookieName = "quizmam_user";

    public static void Set(HttpResponse response, Guid userId)
    {
        response.Cookies.Append(CookieName, userId.ToString("D"), new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = false,
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            Path = "/"
        });
    }

    public static Guid? Read(HttpRequest request)
    {
        if (!request.Cookies.TryGetValue(CookieName, out var raw))
        {
            return null;
        }

        return Guid.TryParse(raw, out var value) ? value : null;
    }

    public static void Clear(HttpResponse response) =>
        response.Cookies.Delete(CookieName, new CookieOptions { Path = "/" });
}

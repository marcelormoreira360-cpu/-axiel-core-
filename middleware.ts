import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/", "/auth/login", "/termos", "/privacidade"];
const publicPrefixes = [
  "/auth",
  "/api/public",
  "/api/whatsapp",
  "/api/meta",
  "/api/book",       // public booking slots API
];

function isPublicPath(pathname: string) {
  if (pathname === "/auth/mfa") return false; // requires authentication
  return (
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/p/") ||       // patient portal (magic link)
    pathname.startsWith("/envio/") ||   // public patient intake/upload
    pathname.startsWith("/join/") ||    // team invite accept
    pathname.startsWith("/book/") ||    // public online booking page
    pathname.startsWith("/f/") ||       // public assessment forms (token-based)
    pathname.startsWith("/portal") ||   // patient portal login & verification
    publicPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]));
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    return redirectToLogin(request);
  }

  if (user) {
    const isMfaPage = pathname === "/auth/mfa";

    // Check MFA requirement (only when user is authenticated)
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaRequired = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

    if (mfaRequired && !isMfaPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa";
      return NextResponse.redirect(url);
    }

    if (!mfaRequired && isMfaPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (!mfaRequired && pathname.startsWith("/auth") && !isMfaPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Platform-only pages. Keep this lightweight; database RLS remains the main security layer.
    if (pathname.startsWith("/admin")) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || !["admin", "platform_admin"].includes(profile.role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};

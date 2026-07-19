import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, localeCookieOptions } from "@/i18n/locales";
import { localeFromAcceptLanguage } from "@/i18n/get-locale";

/**
 * Garante o cookie AXIEL_LOCALE na resposta quando ainda não existe, derivando
 * do Accept-Language. Não altera nada se o cookie já estiver presente e válido.
 */
function ensureLocaleCookie(request: NextRequest, response: NextResponse): NextResponse {
  const current = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(current)) return response;
  const locale = localeFromAcceptLanguage(request.headers.get("accept-language"));
  response.cookies.set(LOCALE_COOKIE, locale, localeCookieOptions());
  return response;
}

/**
 * Programa de indicação: captura ?ref=CODIGO num cookie de 30 dias para o
 * fluxo de signup/onboarding consumir depois (a clínica nasce no onboarding).
 * Literal "AXIEL_REF" duplicado de services/referral-service.ts (REFERRAL_COOKIE)
 * — o middleware (edge) não pode importar o service (supabase-admin/node:crypto).
 */
function ensureReferralCookie(request: NextRequest, response: NextResponse): NextResponse {
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && /^[a-zA-Z0-9]{6,12}$/.test(ref)) {
    response.cookies.set("AXIEL_REF", ref.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}

const publicRoutes = ["/", "/auth/login", "/termos", "/privacidade", "/privacy"];
const publicPrefixes = [
  "/auth",
  "/api/public",
  "/api/auth",         // accept-invite (called right after signup, no session yet)
  "/api/whatsapp",
  "/api/meta",
  "/api/voice",        // Twilio voice webhook (valida assinatura; sem sessão)
  "/api/sms",          // Twilio SMS webhook (valida assinatura; sem sessão)
  "/api/vapi",         // Vapi voice tool webhook (auth por x-vapi-secret; sem sessão)
  "/api/integrations/growth",          // AXIEL Growth webhook (Bearer key auth, no session)
  "/api/book",                         // public booking slots API
  "/api/forms/submit",                 // questionário público (autenticado pelo token do convite)
  "/api/p",                            // patient portal self-booking (token-authenticated, no session cookie)
  "/api/stripe/patient-checkout",      // portal package purchase (token-authenticated)
  "/api/stripe/session-checkout",      // portal session payment (token-authenticated)
  "/api/stripe/patient-subscription",  // portal recurring plan checkout (token-authenticated)
  "/api/stripe/webhook",               // Stripe webhook (valida assinatura; sem sessão)
  "/api/asaas/webhook",                // Asaas webhook (valida token; sem sessão)
];

function isPublicPath(pathname: string) {
  if (pathname === "/auth/mfa") return false; // requires authentication
  return (
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/p/") ||       // patient portal (magic link)
    pathname.startsWith("/envio/") ||   // public patient intake/upload
    pathname.startsWith("/cadastro/") || // public patient self-registration
    pathname.startsWith("/confirmar/") || // public appointment confirmation link
    pathname.startsWith("/join/") ||    // team invite accept
    pathname.startsWith("/book/") ||    // public online booking page
    pathname.startsWith("/f/") ||       // public assessment forms (token-based)
    pathname.startsWith("/portal") ||   // patient portal login & verification
    pathname.startsWith("/pagamento") || // public payment confirmation page
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

  // Fast-path: rota pública (webhooks, booking, portal, formulários) não paga
  // a chamada de rede do auth.getUser() (~50-150ms em TODA request). Páginas
  // /auth ficam de fora para manter o redirect logado→dashboard.
  if (isPublicPath(pathname) && !pathname.startsWith("/auth")) {
    return ensureReferralCookie(request, ensureLocaleCookie(request, response));
  }

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

  return ensureReferralCookie(request, ensureLocaleCookie(request, response));
}

export const config = {
  // Exclui também assets estáticos (ícones, imagens, sw.js, manifest): eles não
  // precisam de auth/cookies e pagavam a latência do middleware em toda carga.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|mp4|webm|mp3)$).*)",
  ],
};

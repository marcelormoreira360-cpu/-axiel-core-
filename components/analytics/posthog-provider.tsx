"use client";

// Provider de analytics PostHog — env-gated, SEM dependência npm.
// Injeta o snippet oficial do posthog-js (stub + carregamento assíncrono do
// array.js) apenas quando NEXT_PUBLIC_POSTHOG_KEY está definida. Sem a env,
// não renderiza nada e nenhum script é carregado.
//
// CSP: us.i.posthog.com e us-assets.i.posthog.com estão liberados em
// script-src/connect-src no next.config.ts.

import { useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// Snippet oficial do posthog-js (stub que enfileira chamadas até o array.js carregar)
const POSTHOG_SNIPPET = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])}),e.__SV=1}(document,window.posthog||[]);`;

export function PostHogProvider() {
  useEffect(() => {
    // Sem a env → analytics desligado (dev, self-host sem PostHog, etc.)
    if (!POSTHOG_KEY) return;
    // Evita dupla injeção (StrictMode, remounts)
    if (document.getElementById("posthog-js-snippet")) return;

    const script = document.createElement("script");
    script.id = "posthog-js-snippet";
    // capture_pageview "history_change" → pageviews automáticos também nas
    // navegações SPA do App Router (history API)
    script.innerHTML =
      POSTHOG_SNIPPET +
      `posthog.init(${JSON.stringify(POSTHOG_KEY)},{api_host:${JSON.stringify(POSTHOG_HOST)},capture_pageview:"history_change",capture_pageleave:true,persistence:"localStorage+cookie"});`;
    document.head.appendChild(script);
  }, []);

  return null;
}

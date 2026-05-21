"use client";

import { useState } from "react";

interface TeleconsultaVideoProps {
  roomName: string;
  patientName: string;
  displayName?: string;
}

export function TeleconsultaVideo({ roomName, patientName, displayName }: TeleconsultaVideoProps) {
  const [showIframe, setShowIframe] = useState(false);
  // Embed display name and disable prejoin page via URL fragment
  const nameParam = displayName ? `&userInfo.displayName=${encodeURIComponent(displayName)}` : "";
  const jitsiUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false${nameParam}`;

  if (!showIframe) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 bg-[#0A0E14] rounded-xl p-8">
        {/* Camera icon */}
        <div className="w-16 h-16 rounded-2xl bg-white/[.06] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M20 11H6a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-8a2 2 0 00-2-2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M22 14l6-3v10l-6-3v-4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="text-center">
          <p className="text-white text-[15px] font-medium mb-1">Consulta com {patientName}</p>
          <p className="text-white/40 text-[12px]">Sala: {roomName}</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setShowIframe(true)}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-4 py-3 rounded-xl"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 5.5H4a1.5 1.5 0 00-1.5 1.5v4a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V7a1.5 1.5 0 00-1.5-1.5z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M11.5 7l3-1.5v5l-3-1.5V7z" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Iniciar videochamada
          </button>

          <a
            href={`https://meet.jit.si/${roomName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 text-[12px] font-medium text-white/60 border border-white/[.12] hover:border-white/25 hover:text-white/80 transition px-4 py-2.5 rounded-xl"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M8 1h4m0 0v4m0-4L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Abrir em nova aba
          </a>
        </div>

        <p className="text-white/25 text-[11px] text-center max-w-xs">
          Compartilhe o link da sala com o paciente:{" "}
          <span className="text-white/40 break-all">https://meet.jit.si/{roomName}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full rounded-xl overflow-hidden bg-black">
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
        title={`Teleconsulta — ${patientName}`}
      />
      <button
        onClick={() => setShowIframe(false)}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition z-10"
        title="Minimizar vídeo"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

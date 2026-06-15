// Logo de marca BiohackMX: matraz Erlenmeyer en mint (#5eead4). Marca de partner.
export function BiohackmxFlask({ size = 24, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-label="BiohackMX">
      {/* boca del matraz */}
      <path d="M9 3.2h6" stroke="#0E5A52" strokeWidth="1.6" strokeLinecap="round" />
      {/* cuello + cuerpo cónico (vidrio) */}
      <path
        d="M10 3.6v4.3L4.7 18.4A1.6 1.6 0 0 0 6.1 20.8h11.8a1.6 1.6 0 0 0 1.4-2.4L14 7.9V3.6"
        stroke="#0E5A52"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* líquido mint */}
      <path
        d="M7.4 13.2h9.2l2.1 4.4a1.4 1.4 0 0 1-1.3 2.2H6.6a1.4 1.4 0 0 1-1.3-2.2l2.1-4.4Z"
        fill="#5eead4"
      />
      {/* burbujas */}
      <circle cx="10.4" cy="16.6" r="0.9" fill="#0E5A52" opacity="0.55" />
      <circle cx="13.4" cy="17.6" r="0.7" fill="#0E5A52" opacity="0.4" />
    </svg>
  )
}

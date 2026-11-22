/**
 * Marca de Saria: un cuadro oscuro con el nivel de agua a media altura, la
 * misma idea que la tarjeta de Inicio en pequeño. Oscura en ambos temas.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'relative block size-12 overflow-hidden rounded-[0.9rem] bg-nivel-tarjeta',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-b from-nivel-arriba to-nivel-abajo">
        <span className="absolute -top-[4px] -left-[10%] h-[8px] w-[120%] rounded-[50%] bg-nivel-arriba shadow-[0_-2px_0_var(--color-nivel-superficie)]" />
      </span>
    </span>
  )
}

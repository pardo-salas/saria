import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

/**
 * Navegación principal: barra inferior en móvil (< 1024 px) y riel lateral
 * izquierdo en ≥ 1024 px. El contenedor de la página debe reservar su espacio
 * (pb de 4 rem + área segura en móvil, pl de 6 rem en lg).
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-barra pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:top-0 lg:left-0 lg:w-24 lg:border-t-0 lg:border-r lg:pt-6 lg:pb-0"
    >
      <ul className="flex lg:flex-col lg:gap-2">
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1 lg:flex-none">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'group flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] leading-4',
                  isActive
                    ? 'font-semibold text-nav-activo'
                    : 'text-texto-suave hover:text-texto',
                ].join(' ')
              }
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150 group-aria-[current=page]:bg-cobalto group-aria-[current=page]:text-nav-activo-icono [&>svg]:size-6"
              >
                {item.icon}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

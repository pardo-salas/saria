import { describe, expect, it } from 'vitest'
import {
  daysLeftInMonth,
  formatDayLabel,
  formatMonth,
  isValidDate,
  localDate,
  monthKey,
  shiftMonth,
  TIME_ZONE,
} from './dates'

describe('fechas locales', () => {
  it('expone la zona horaria', () => {
    expect(TIME_ZONE).toBe('America/Mexico_City')
  })

  it('localDate usa la zona de Ciudad de México', () => {
    expect(localDate(new Date('2026-11-23T05:30:00Z'))).toBe('2026-11-22')
    expect(localDate(new Date('2026-12-01T06:10:00Z'))).toBe('2026-12-01')
  })

  it('monthKey y shiftMonth', () => {
    expect(monthKey('2026-12-01')).toBe('2026-12')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('daysLeftInMonth', () => {
    expect(daysLeftInMonth('2026-11-22')).toBe(8)
    expect(daysLeftInMonth('2026-11-30')).toBe(0)
    expect(daysLeftInMonth('2028-02-28')).toBe(1)
  })

  it('formatMonth', () => {
    expect(formatMonth('2026-11')).toBe('Noviembre 2026')
  })

  it('formatDayLabel', () => {
    const today = '2026-11-22'
    expect(formatDayLabel('2026-11-22', today)).toBe('Hoy')
    expect(formatDayLabel('2026-11-21', today)).toBe('Ayer · 21 nov')
    expect(formatDayLabel('2026-11-19', today)).toBe('jue 19 nov')
    expect(formatDayLabel('2024-12-02', today)).toBe('lun 2 dic 2024')
  })

  it('isValidDate', () => {
    expect(isValidDate('2026-11-22')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-2-3')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'

describe('Money formatting utilities', () => {
  const formatMoney = (value: string): string => {
    const num = value.replace(/\D/g, '')
    if (!num) return ''
    return parseInt(num, 10).toLocaleString('vi-VN')
  }

  const parseMoney = (formatted: string): string => {
    return formatted.replace(/\./g, '')
  }

  describe('formatMoney', () => {
    it('formats integer to Vietnamese format with dots', () => {
      expect(formatMoney('5000000')).toBe('5.000.000')
    })

    it('handles zero correctly', () => {
      expect(formatMoney('0')).toBe('0')
    })

    it('removes non-digit characters before formatting', () => {
      expect(formatMoney('abc123def456')).toBe('123.456')
    })

    it('returns empty string for empty input', () => {
      expect(formatMoney('')).toBe('')
    })

    it('handles large numbers', () => {
      expect(formatMoney('1234567890')).toBe('1.234.567.890')
    })
  })

  describe('parseMoney', () => {
    it('removes dots from formatted numbers', () => {
      expect(parseMoney('5.000.000')).toBe('5000000')
    })

    it('handles unformatted numbers', () => {
      expect(parseMoney('123456')).toBe('123456')
    })

    it('handles empty string', () => {
      expect(parseMoney('')).toBe('')
    })
  })

  describe('roundtrip conversion', () => {
    it('maintains value through format and parse', () => {
      const original = '5647000'
      const formatted = formatMoney(original)
      const parsed = parseMoney(formatted)
      expect(parsed).toBe(original)
    })
  })
})

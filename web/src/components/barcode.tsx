import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeProps {
  value: string
  height?: number
  width?: number
  fontSize?: number
  displayValue?: boolean
}

export function Barcode({
  value,
  height = 40,
  width = 1.5,
  fontSize = 12,
  displayValue = true,
}: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
      })
    } catch {
      // invalid value — leave blank
    }
  }, [value, height, width, fontSize, displayValue])

  return <svg ref={ref} />
}

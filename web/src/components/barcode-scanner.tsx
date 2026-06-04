import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Camera, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const [error, setError] = useState('')
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window,
  )

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!supported) return

    let active = true

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // @ts-expect-error BarcodeDetector not yet in TS lib
        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
        })

        async function scan() {
          if (!active || !videoRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const value = barcodes[0].rawValue as string
              stopCamera()
              onDetected(value)
              return
            }
          } catch {
            // detection error — keep scanning
          }
          animFrameRef.current = requestAnimationFrame(scan)
        }
        animFrameRef.current = requestAnimationFrame(scan)
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error && err.name === 'NotAllowedError'
              ? 'Camera permission denied. Allow camera access and try again.'
              : 'Could not access camera.',
          )
        }
      }
    }

    start()
    return () => {
      active = false
      stopCamera()
    }
  }, [supported, onDetected, stopCamera])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-xl overflow-hidden w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-gray-600" />
            <span className="font-medium text-gray-900 text-sm">Scan barcode</span>
          </div>
          <button
            onClick={() => { stopCamera(); onClose() }}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {!supported ? (
          <div className="p-6 text-center space-y-3">
            <AlertCircle size={36} className="text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 font-medium">
              Camera scanning not supported in this browser.
            </p>
            <p className="text-xs text-gray-500">
              Use Chrome on Android/desktop, or type the barcode manually.
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3">
            <AlertCircle size={36} className="text-red-500 mx-auto" />
            <p className="text-sm text-gray-700">{error}</p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="relative bg-black aspect-square">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            {/* Scan target overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-40 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 opacity-70" />
              </div>
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs opacity-75">
              Point camera at barcode
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

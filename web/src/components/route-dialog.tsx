import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

interface RouteDialogProps {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}

export function RouteDialog({
  title,
  children,
  onClose,
  className,
}: RouteDialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-dialog-title"
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-lg rounded-md border bg-white shadow-lg outline-none',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="route-dialog-title" className="text-base font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

import { Suspense, lazy, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import type { FieldDef } from '#/lib/grid/registry'
import type { GlideGridProps } from './glide-impl'

const GlideGrid = lazy(() => import('./glide-impl'))

export interface DataGridProps extends GlideGridProps {
  // Rendered on the server and until the client grid hydrates.
  fallback: ReactNode
}

export function DataGrid({ fallback, ...grid }: DataGridProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <>{fallback}</>
  return (
    <Suspense fallback={fallback}>
      <GlideGrid {...grid} />
    </Suspense>
  )
}

export type { FieldDef }

import { useState } from 'react'
import { PauseCircle, Play, ScanLine, Trash2 } from 'lucide-react'

import { BarcodeScanner } from '#/components/barcode-scanner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  deleteHeldSale,
  getHeldSale,
  holdSale,
} from '#/lib/held-sales'
import { findProductByBarcode } from '#/lib/products'
import { createSale } from '#/lib/sales'

interface SaleFormProps {
  products: {
    id: string
    name: string
    sellingPrice: string
    stockQty: number
    imageUrl?: string | null
    barcode?: string | null
  }[]
  customers: {
    id: string
    name: string
    loyaltyPoints?: number
  }[]
  taxRate?: number
  taxInclusive?: boolean
  currency?: string
  loyaltyEnabled?: boolean
  loyaltyPointValue?: number
  heldSales?: {
    id: string
    label: string | null
    itemCount: number
    total: string
    customerName: string | null
  }[]
  onHeldChanged?: () => void
  onCancel: () => void
  onSaved: (saleId: string) => Promise<void> | void
}

interface CartItem {
  productId: string
  name: string
  unitPrice: string
  quantity: number
}

export function SaleForm({
  products,
  customers,
  taxRate = 0,
  taxInclusive = true,
  currency = 'GHS',
  loyaltyEnabled = false,
  loyaltyPointValue = 0,
  heldSales = [],
  onHeldChanged,
  onCancel,
  onSaved,
}: SaleFormProps) {
  const currencySymbol =
    new Intl.NumberFormat('en-GH', { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [pointsToRedeem, setPointsToRedeem] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'credit' | 'mobile_money'
  >('cash')
  const [productSearch, setProductSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [barcodeError, setBarcodeError] = useState('')

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()),
  )

  async function handleBarcodeDetected(barcode: string) {
    setShowScanner(false)
    setBarcodeError('')

    // First try local match (instant, no network)
    const local = products.find((p) => p.barcode === barcode)
    if (local) {
      addToCart(local)
      return
    }

    // Fall back to server lookup (handles products not in current list)
    try {
      const product = await findProductByBarcode({ data: { barcode } })
      if (product) {
        addToCart(product)
      } else {
        setBarcodeError(`No product found for barcode: ${barcode}`)
      }
    } catch {
      setBarcodeError('Barcode lookup failed')
    }
  }

  // USB barcode scanner support: detect rapid input ending with Enter
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const val = productSearch.trim()
    if (!val) return

    const local = products.find((p) => p.barcode === val)
    if (local) {
      addToCart(local)
      setProductSearch('')
    }
  }

  const lineTotal = cart.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0,
  )
  // Discount applies to line total before tax.
  const discountRaw =
    discountValue && Number(discountValue) > 0
      ? discountType === 'percent'
        ? lineTotal * (Number(discountValue) / 100)
        : Number(discountValue)
      : 0
  const discount = Math.min(Math.max(discountRaw, 0), lineTotal)

  // Loyalty: redeemed points reduce the bill by pointValue each, before tax
  const selectedCustomer = customers.find((c) => c.id === customerId)
  const customerPoints = selectedCustomer?.loyaltyPoints ?? 0
  const loyaltyAvailable = loyaltyEnabled && !!customerId && loyaltyPointValue > 0
  const afterDiscount = lineTotal - discount
  const maxRedeemable = loyaltyAvailable
    ? Math.min(customerPoints, Math.floor(afterDiscount / loyaltyPointValue))
    : 0
  const redeemPts = loyaltyAvailable
    ? Math.min(Math.max(parseInt(pointsToRedeem || '0', 10) || 0, 0), maxRedeemable)
    : 0
  const redeemValue = redeemPts * loyaltyPointValue

  const discountedLine = lineTotal - discount - redeemValue
  // Inclusive: tax embedded in discountedLine; Exclusive: added on top.
  const taxAmount =
    taxRate > 0
      ? taxInclusive
        ? discountedLine * (taxRate / (100 + taxRate))
        : discountedLine * (taxRate / 100)
      : 0
  const total = taxInclusive ? discountedLine : discountedLine + taxAmount

  function addToCart(product: SaleFormProps['products'][number]) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.sellingPrice,
          quantity: 1,
        },
      ]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId))
      return
    }
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: qty } : i,
      ),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) {
      setError('Add at least one product')
      return
    }
    setLoading(true)
    setError('')
    try {
      const sale = await createSale({
        data: {
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          customerId: customerId || undefined,
          amountPaid: amountPaid || String(total),
          paymentMethod,
          discountType,
          discountValue: discountValue || undefined,
          pointsToRedeem: redeemPts > 0 ? redeemPts : undefined,
        },
      })
      await onSaved(sale.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record sale')
    } finally {
      setLoading(false)
    }
  }

  function clearCart() {
    setCart([])
    setCustomerId('')
    setDiscountValue('')
    setAmountPaid('')
  }

  async function handleHold() {
    if (cart.length === 0) {
      setError('Add products before holding')
      return
    }
    setLoading(true)
    setError('')
    try {
      const customerName = customers.find((c) => c.id === customerId)?.name
      await holdSale({
        data: {
          items: cart.map((i) => ({
            productId: i.productId,
            name: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
          })),
          customerId: customerId || undefined,
          label: customerName,
          discountType,
          discountValue: discountValue || undefined,
          total: total.toFixed(2),
        },
      })
      clearCart()
      onHeldChanged?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to hold sale')
    } finally {
      setLoading(false)
    }
  }

  async function handleResume(id: string) {
    setLoading(true)
    setError('')
    try {
      const held = await getHeldSale({ data: { id } })
      setCart(
        held.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
      )
      setCustomerId(held.customerId ?? '')
      if (held.discountType === 'amount' || held.discountType === 'percent') {
        setDiscountType(held.discountType)
      }
      setDiscountValue(held.discountValue ?? '')
      await deleteHeldSale({ data: { id } })
      onHeldChanged?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resume sale')
    } finally {
      setLoading(false)
    }
  }

  async function handleDiscardHeld(id: string) {
    await deleteHeldSale({ data: { id } })
    onHeldChanged?.()
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {heldSales.length > 0 && (
        <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <PauseCircle size={15} />
            Held sales ({heldSales.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {heldSales.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-sm"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {h.label || `${h.itemCount} item${h.itemCount === 1 ? '' : 's'}`}
                  </span>
                  <span className="text-gray-400 ml-1.5 text-xs">{h.total}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleResume(h.id)}
                  disabled={loading}
                  className="text-green-600 hover:text-green-800"
                  title="Resume"
                >
                  <Play size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscardHeld(h.id)}
                  className="text-gray-300 hover:text-red-500"
                  title="Discard"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-md border bg-white p-3">
        <h3 className="font-medium text-gray-700">Products</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Search or scan barcode…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button
            type="button"
            onClick={() => { setBarcodeError(''); setShowScanner(true) }}
            title="Scan barcode with camera"
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md border text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          >
            <ScanLine size={18} />
          </button>
        </div>
        {barcodeError && (
          <p className="text-xs text-red-600">{barcodeError}</p>
        )}
        <div className="max-h-80 overflow-y-auto divide-y">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addToCart(p)}
              className="flex w-full items-center justify-between px-2 py-2.5 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-8 h-8 rounded object-cover border shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-100 border shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">Stock: {p.stockQty}</p>
                </div>
              </div>
              <span className="text-sm text-gray-700">{p.sellingPrice}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3 rounded-md border bg-white p-3">
          <h3 className="font-medium text-gray-700">Cart</h3>
          {cart.length === 0 ? (
            <p className="text-sm text-gray-400">No items added.</p>
          ) : (
            <div className="divide-y">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.unitPrice} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateQty(item.productId, item.quantity - 1)
                      }
                      className="h-6 w-6 rounded border text-sm text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQty(item.productId, item.quantity + 1)
                      }
                      className="h-6 w-6 rounded border text-sm text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-medium text-gray-900">
                    {(Number(item.unitPrice) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* Discount input */}
          <div className="border-t pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-1">Discount</span>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDiscountType('amount')}
                  className={`px-2 py-1 text-xs ${discountType === 'amount' ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  {currencySymbol}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`px-2 py-1 text-xs ${discountType === 'percent' ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
                className="w-20 border rounded px-2 py-1 text-sm text-right"
              />
            </div>
          </div>

          {/* Loyalty redemption */}
          {loyaltyAvailable && customerPoints > 0 && (
            <div className="border-t pt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-1">
                Redeem points{' '}
                <span className="text-gray-400">
                  ({customerPoints} available)
                </span>
              </span>
              <input
                type="number"
                min="0"
                max={maxRedeemable}
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(e.target.value)}
                placeholder="0"
                className="w-20 border rounded px-2 py-1 text-sm text-right"
              />
            </div>
          )}

          <div className="border-t pt-2 space-y-1">
            {(taxRate > 0 || discount > 0 || redeemValue > 0) && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span>{lineTotal.toFixed(2)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span>Discount</span>
                <span>−{discount.toFixed(2)}</span>
              </div>
            )}
            {redeemValue > 0 && (
              <div className="flex justify-between text-xs text-purple-600">
                <span>Points ({redeemPts})</span>
                <span>−{redeemValue.toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  Tax ({taxRate}%{taxInclusive ? ', incl.' : ''})
                </span>
                <span>{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Customer</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Walk-in</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Payment</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value as 'cash' | 'credit' | 'mobile_money',
                )
              }
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="credit">Credit</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Amount paid</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={total.toFixed(2)}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Recording…' : 'Record sale'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleHold}
            disabled={loading || cart.length === 0}
            title="Hold this sale to finish later"
          >
            <PauseCircle size={15} className="mr-1" />
            Hold
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

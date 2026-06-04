import nodemailer from 'nodemailer'

export interface LowStockItem {
  name: string
  stockQty: number
  lowStockThreshold: number
}

function getTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendLowStockAlert(opts: {
  ownerEmail: string
  shopName: string
  items: LowStockItem[]
}) {
  const transport = getTransport()
  if (!transport) return // silently skip if SMTP not configured

  const from = process.env.SMTP_FROM ?? `StoreFlow <${process.env.SMTP_USER}>`

  const itemRows = opts.items
    .map(
      (p) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${p.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:${p.stockQty === 0 ? '#dc2626' : '#d97706'};font-weight:600">
            ${p.stockQty === 0 ? 'OUT OF STOCK' : `${p.stockQty} left`}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280">
            Alert at ${p.lowStockThreshold}
          </td>
        </tr>`,
    )
    .join('')

  const subject = opts.items.some((p) => p.stockQty === 0)
    ? `🚨 Out of stock alert — ${opts.shopName}`
    : `⚠️ Low stock alert — ${opts.shopName}`

  await transport.sendMail({
    from,
    to: opts.ownerEmail,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#111827;margin-bottom:4px">${subject}</h2>
        <p style="color:#6b7280;margin-top:0">
          The following products in <strong>${opts.shopName}</strong> need attention:
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Product</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase">Stock</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase">Threshold</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <p style="margin-top:24px;color:#6b7280;font-size:14px">
          Log in to StoreFlow to restock or adjust inventory.
        </p>
      </div>
    `,
  })
}

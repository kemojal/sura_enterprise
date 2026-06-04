import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getShopCtxWithPermission } from './context'

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export const getProductImageUploadUrl = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      filename: z.string(),
      contentType: z.string().startsWith('image/'),
    }),
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const { shopId } = await getShopCtxWithPermission(request.headers, 'products:write')

    const bucket = process.env.R2_BUCKET_NAME
    const publicUrl = process.env.R2_PUBLIC_URL
    if (!bucket || !publicUrl) {
      throw new Error('R2_BUCKET_NAME and R2_PUBLIC_URL must be set in .env.local')
    }

    const ext = data.filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const key = `products/${shopId}/${Date.now()}.${ext}`

    const client = getR2Client()
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: data.contentType,
    })

    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 300 })
    const objectUrl = `${publicUrl.replace(/\/$/, '')}/${key}`

    return { uploadUrl, objectUrl, key }
  })

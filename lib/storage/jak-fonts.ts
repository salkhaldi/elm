import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { FONT_FILENAME, MAX_FONT_BYTES } from "../jak-report-fonts";
import { resolveStorageConfig } from "./images";

let client: S3Client | undefined;
function storage() {
  const config = resolveStorageConfig();
  client ??= new S3Client({ endpoint: config.endpoint, region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  return { s3: client, bucket: config.bucket };
}
function key(filename: string) {
  if (!FONT_FILENAME.test(filename)) throw new Error("invalid_font_filename");
  return `jak-fonts/${filename}`;
}
export async function putJakFont(filename: string, body: Uint8Array, contentType: string) {
  if (body.length > MAX_FONT_BYTES) throw new Error("font_limit");
  const { s3, bucket } = storage();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key(filename), Body: body, ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable" }), { abortSignal: AbortSignal.timeout(20_000) });
}
export async function getJakFont(filename: string) {
  const objectKey = key(filename);
  const { s3, bucket } = storage();
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { abortSignal: AbortSignal.timeout(15_000) });
  if (!result.Body || (result.ContentLength ?? Infinity) > MAX_FONT_BYTES) throw new Error("invalid_font_object");
  const bytes = await result.Body.transformToByteArray();
  if (bytes.length > MAX_FONT_BYTES) throw new Error("font_limit");
  return bytes;
}

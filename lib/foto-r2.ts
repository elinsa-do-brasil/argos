import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { MAX_BYTES_FOTO } from "@/lib/foto";

export class ErroArmazenamentoFotos extends Error {}

function configuracao() {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
    process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_BUCKET ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY
  ) {
    throw new ErroArmazenamentoFotos(
      "O armazenamento de fotos não está configurado.",
    );
  }
  return { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY };
}

let cliente: S3Client | undefined;
function r2() {
  const config = configuracao();
  cliente ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
  return { cliente, bucket: config.R2_BUCKET };
}

export async function enviarFotoR2(chave: string, dataUrl: string) {
  const bytes = Buffer.from(
    dataUrl.slice("data:image/jpeg;base64,".length),
    "base64",
  );
  if (
    bytes.length > MAX_BYTES_FOTO ||
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    throw new ErroArmazenamentoFotos(
      "Uma das fotos é inválida. Escolha outra imagem.",
    );
  }
  const { cliente, bucket } = r2();
  try {
    await cliente.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: chave,
        Body: bytes,
        ContentType: "image/jpeg",
      }),
    );
  } catch {
    throw new ErroArmazenamentoFotos(
      "Não foi possível enviar as fotos. Tente novamente.",
    );
  }
}

export async function lerFotoR2(chave: string) {
  const { cliente, bucket } = r2();
  const resultado = await cliente.send(
    new GetObjectCommand({ Bucket: bucket, Key: chave }),
  );
  if (!resultado.Body) throw new Error("Foto não encontrada no armazenamento.");
  return resultado.Body.transformToByteArray();
}

export async function excluirFotosR2(chaves: string[]) {
  if (!chaves.length) return;
  const { cliente, bucket } = r2();
  for (const chave of chaves) {
    try {
      await cliente.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: chave }),
      );
    } catch (erro) {
      console.error("Não foi possível remover uma foto do R2:", chave, erro);
    }
  }
}

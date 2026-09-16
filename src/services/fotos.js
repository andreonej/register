import { supabaseHeaders, supabaseStorageUrl } from "../config";

const BUCKET_FOTOS = "fotos-comidas";

function headersArchivo(mimeType) {
  return {
    apikey: supabaseHeaders.apikey,
    Authorization: supabaseHeaders.Authorization,
    "Content-Type": mimeType,
  };
}

function base64ABlob(base64Data, mimeType) {
  const binario = atob(base64Data);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function subirFotoComida({ comidaId, perfilId, base64Data, mimeType = "image/jpeg" }) {
  if (!base64Data) return null;
  const carpeta = perfilId || "sin-perfil";
  const fotoPath = `${carpeta}/${comidaId}.jpg`;
  const respuesta = await fetch(`${supabaseStorageUrl}/object/${BUCKET_FOTOS}/${fotoPath}`, {
    method: "POST",
    headers: { ...headersArchivo(mimeType), "x-upsert": "true" },
    body: base64ABlob(base64Data, mimeType),
  });
  if (!respuesta.ok) throw new Error("No se pudo subir la foto de la comida");
  return fotoPath;
}

export async function eliminarFotoComida(fotoPath) {
  if (!fotoPath) return;
  const respuesta = await fetch(`${supabaseStorageUrl}/object/${BUCKET_FOTOS}/${fotoPath}`, {
    method: "DELETE",
    headers: {
      apikey: supabaseHeaders.apikey,
      Authorization: supabaseHeaders.Authorization,
    },
  });
  if (!respuesta.ok && respuesta.status !== 404) throw new Error("No se pudo eliminar la foto de la comida");
}

export function obtenerUrlFotoComida(fotoPath) {
  if (!fotoPath) return null;
  return `${supabaseStorageUrl}/object/public/${BUCKET_FOTOS}/${fotoPath}`;
}

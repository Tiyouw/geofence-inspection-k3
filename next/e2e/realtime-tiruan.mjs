// Peladen tiruan Pusher Channels untuk E2E dan pengembangan lokal (ADR K-12), tanpa dependensi.
// Mendukung bagian protokol yang dipakai aplikasi: WebSocket /app/{key} (protokol 7, saluran privat
// dengan tanda tangan diperiksa, ping/pong) dan REST POST /apps/{id}/batch_events bertanda tangan.
//
//   PUSHER_APP_ID=uji PUSHER_KEY=kunci-uji PUSHER_SECRET=rahasia-uji node e2e/realtime-tiruan.mjs 6001
//
// Aplikasi diarahkan ke sini dengan PUSHER_HOST=http://127.0.0.1:6001 dan PUSHER_WS_URL=ws://127.0.0.1:6001.
import { createHash, createHmac, randomInt } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? process.env.REALTIME_PORT ?? 6001);
const APP_ID = process.env.PUSHER_APP_ID ?? "uji";
const KEY = process.env.PUSHER_KEY ?? "kunci-uji";
const SECRET = process.env.PUSHER_SECRET ?? "rahasia-uji";
const hmac = (s) => createHmac("sha256", SECRET).update(s).digest("hex");

/** saluran -> Set<soket> */
const saluran = new Map();

function bingkai(teks) {
    const data = Buffer.from(teks);
    const n = data.length;
    const kepala = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : null;
    if (!kepala) {
        const k = Buffer.alloc(10);
        k[0] = 0x81;
        k[1] = 127;
        k.writeBigUInt64BE(BigInt(n), 2);
        return Buffer.concat([k, data]);
    }
    return Buffer.concat([kepala, data]);
}

function kirim(sock, event, data, channel) {
    if (sock.destroyed) return;
    sock.write(
        bingkai(
            JSON.stringify({
                event,
                ...(channel ? { channel } : {}),
                data: typeof data === "string" ? data : JSON.stringify(data),
            }),
        ),
    );
}

function tanganiPesan(sock, teks) {
    let m;
    try {
        m = JSON.parse(teks);
    } catch {
        return;
    }
    if (m.event === "pusher:ping") return kirim(sock, "pusher:pong", {});
    if (m.event === "pusher:subscribe") {
        const { channel, auth } = m.data ?? {};
        if (!channel?.startsWith("private-") || auth !== `${KEY}:${hmac(`${sock.socketId}:${channel}`)}`) {
            return kirim(sock, "pusher:error", { code: 4009, message: "auth salah" });
        }
        if (!saluran.has(channel)) saluran.set(channel, new Set());
        saluran.get(channel).add(sock);
        sock.saluran.add(channel);
        kirim(sock, "pusher_internal:subscription_succeeded", {}, channel);
    }
}

function bacaBingkai(sock, potongan) {
    sock.sisa = Buffer.concat([sock.sisa, potongan]);
    for (;;) {
        const b = sock.sisa;
        if (b.length < 2) return;
        const op = b[0] & 0x0f;
        let n = b[1] & 0x7f;
        let i = 2;
        if (n === 126) {
            if (b.length < 4) return;
            n = b.readUInt16BE(2);
            i = 4;
        } else if (n === 127) {
            if (b.length < 10) return;
            n = Number(b.readBigUInt64BE(2));
            i = 10;
        }
        const bertopeng = b[1] & 0x80;
        const topeng = bertopeng ? b.subarray(i, i + 4) : null;
        if (bertopeng) i += 4;
        if (b.length < i + n) return;
        const isi = Buffer.from(b.subarray(i, i + n));
        if (topeng) for (let j = 0; j < isi.length; j++) isi[j] ^= topeng[j % 4];
        sock.sisa = b.subarray(i + n);
        if (op === 1) tanganiPesan(sock, isi.toString("utf8"));
        else if (op === 8) {
            sock.end(Buffer.from([0x88, 0]));
            return;
        } else if (op === 9) sock.write(Buffer.concat([Buffer.from([0x8a, isi.length]), isi]));
    }
}

function sahRest(url, body) {
    const q = Object.fromEntries(url.searchParams);
    const { auth_signature, ...param } = q;
    if (param.auth_key !== KEY) return false;
    if (param.body_md5 !== createHash("md5").update(body).digest("hex")) return false;
    const query = Object.keys(param)
        .sort()
        .map((k) => `${k}=${param[k]}`)
        .join("&");
    return auth_signature === hmac(`POST\n${url.pathname}\n${query}`);
}

function siarkan(name, channel, data) {
    for (const s of saluran.get(channel) ?? []) kirim(s, name, data, channel);
}

const peladen = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/") return res.end("ok");
    const bagian = [];
    req.on("data", (c) => bagian.push(c));
    req.on("end", () => {
        const body = Buffer.concat(bagian).toString("utf8");
        if (req.method !== "POST" || !url.pathname.startsWith(`/apps/${APP_ID}/`)) return res.writeHead(404).end();
        if (!sahRest(url, body)) return res.writeHead(401).end("tanda tangan salah");
        const j = JSON.parse(body);
        if (url.pathname.endsWith("/batch_events")) for (const e of j.batch ?? []) siarkan(e.name, e.channel, e.data);
        else for (const c of j.channels ?? []) siarkan(j.name, c, j.data);
        res.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
});

peladen.on("upgrade", (req, sock) => {
    const kunci = req.headers["sec-websocket-key"];
    if (!kunci || !req.url?.startsWith(`/app/${KEY}`)) return sock.destroy();
    const terima = createHash("sha1").update(`${kunci}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    sock.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${terima}\r\n\r\n`,
    );
    sock.setNoDelay(true);
    sock.socketId = `${randomInt(1e6)}.${randomInt(1e6)}`;
    sock.saluran = new Set();
    sock.sisa = Buffer.alloc(0);
    sock.on("data", (c) => bacaBingkai(sock, c));
    const lepas = () => {
        for (const c of sock.saluran) saluran.get(c)?.delete(sock);
    };
    sock.on("close", lepas);
    sock.on("error", lepas);
    kirim(sock, "pusher:connection_established", { socket_id: sock.socketId, activity_timeout: 120 });
});

peladen.listen(PORT, "127.0.0.1", () => console.log(`realtime tiruan di :${PORT}`));

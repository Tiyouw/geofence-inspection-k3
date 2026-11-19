// Peladen tiruan Ably untuk E2E dan pengembangan lokal (ADR K-12), tanpa dependensi.
// Hanya bagian protokol yang dipakai aplikasi: WebSocket realtime format JSON dengan token JWT
// (diperiksa: HS256, kid, kedaluwarsa, kapabilitas subscribe), ATTACH/MESSAGE/HEARTBEAT/CLOSE,
// dan REST batch publish POST /messages dengan Basic auth.
//
//   ABLY_API_KEY=uji.kunci:rahasia-uji node e2e/realtime-tiruan.mjs 6001
//
// Aplikasi diarahkan ke sini dengan ABLY_ENDPOINT=127.0.0.1 ABLY_PORT=6001 ABLY_TLS=0.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? process.env.REALTIME_PORT ?? 6001);
const KUNCI = process.env.ABLY_API_KEY ?? "uji.kunci:rahasia-uji";
const [NAMA_KUNCI, RAHASIA] = [KUNCI.slice(0, KUNCI.indexOf(":")), KUNCI.slice(KUNCI.indexOf(":") + 1)];
const A = {
    HEARTBEAT: 0,
    CONNECTED: 4,
    CLOSE: 7,
    CLOSED: 8,
    ERROR: 9,
    ATTACH: 10,
    ATTACHED: 11,
    DETACH: 12,
    DETACHED: 13,
    MESSAGE: 15,
};

/** saluran -> Set<soket> */
const saluran = new Map();

function bingkai(teks) {
    const data = Buffer.from(teks);
    const n = data.length;
    let kepala;
    if (n < 126) kepala = Buffer.from([0x81, n]);
    else if (n < 65536) kepala = Buffer.from([0x81, 126, n >> 8, n & 255]);
    else {
        kepala = Buffer.alloc(10);
        kepala[0] = 0x81;
        kepala[1] = 127;
        kepala.writeBigUInt64BE(BigInt(n), 2);
    }
    return Buffer.concat([kepala, data]);
}

const kirim = (sock, pesan) => !sock.destroyed && sock.write(bingkai(JSON.stringify(pesan)));

function periksaJwt(jwt) {
    const [h, p, t] = String(jwt).split(".");
    if (!h || !p || !t) return null;
    const harap = Buffer.from(createHmac("sha256", RAHASIA).update(`${h}.${p}`).digest("base64url"));
    if (harap.length !== Buffer.from(t).length || !timingSafeEqual(harap, Buffer.from(t))) return null;
    const kepala = JSON.parse(Buffer.from(h, "base64url").toString());
    const isi = JSON.parse(Buffer.from(p, "base64url").toString());
    if (kepala.alg !== "HS256" || kepala.kid !== NAMA_KUNCI || isi.exp * 1000 < Date.now()) return null;
    return { clientId: isi["x-ably-clientId"], kapabilitas: JSON.parse(isi["x-ably-capability"] ?? "{}") };
}

function tanganiPesan(sock, teks) {
    let m;
    try {
        m = JSON.parse(teks);
    } catch {
        return;
    }
    if (m.action === A.HEARTBEAT) return kirim(sock, { action: A.HEARTBEAT, id: m.id });
    if (m.action === A.CLOSE) {
        kirim(sock, { action: A.CLOSED });
        return sock.end(Buffer.from([0x88, 0]));
    }
    if (m.action === A.ATTACH) {
        const boleh = sock.kapabilitas[m.channel]?.includes("subscribe");
        if (!boleh) {
            return kirim(sock, {
                action: A.ERROR,
                channel: m.channel,
                error: { code: 40160, statusCode: 401, message: "kapabilitas tidak mengizinkan" },
            });
        }
        if (!saluran.has(m.channel)) saluran.set(m.channel, new Set());
        saluran.get(m.channel).add(sock);
        sock.saluran.add(m.channel);
        return kirim(sock, { action: A.ATTACHED, channel: m.channel, flags: 1 << 18 }); // MESSAGE_SUBSCRIBE
    }
    if (m.action === A.DETACH) {
        saluran.get(m.channel)?.delete(sock);
        sock.saluran.delete(m.channel);
        return kirim(sock, { action: A.DETACHED, channel: m.channel });
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
        else if (op === 8) return void sock.end(Buffer.from([0x88, 0]));
        else if (op === 9) sock.write(Buffer.concat([Buffer.from([0x8a, isi.length]), isi]));
    }
}

let nomor = 0;
function siarkan(channel, messages) {
    for (const s of saluran.get(channel) ?? []) {
        const id = `${s.connectionId}:${nomor++}`;
        kirim(s, {
            action: A.MESSAGE,
            channel,
            id,
            timestamp: Date.now(),
            messages: messages.map((m, k) => ({ ...m, id: `${id}:${k}`, timestamp: Date.now() })),
        });
    }
}

const peladen = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/") return res.end("ok");
    const bagian = [];
    req.on("data", (c) => bagian.push(c));
    req.on("end", () => {
        if (req.method !== "POST" || url.pathname !== "/messages") return res.writeHead(404).end();
        if (req.headers.authorization !== `Basic ${Buffer.from(KUNCI).toString("base64")}`)
            return res.writeHead(401).end();
        const spesifikasi = [].concat(JSON.parse(Buffer.concat(bagian).toString("utf8")));
        for (const s of spesifikasi) for (const c of [].concat(s.channels)) siarkan(c, [].concat(s.messages));
        res.writeHead(201, { "content-type": "application/json" }).end("[]");
    });
});

peladen.on("upgrade", (req, sock) => {
    const kunci = req.headers["sec-websocket-key"];
    if (!kunci) return sock.destroy();
    const terima = createHash("sha1").update(`${kunci}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    sock.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${terima}\r\n\r\n`,
    );
    sock.setNoDelay(true);
    sock.saluran = new Set();
    sock.sisa = Buffer.alloc(0);
    sock.connectionId = randomUUID().slice(0, 8);
    const lepas = () => {
        clearInterval(sock.detak);
        for (const c of sock.saluran) saluran.get(c)?.delete(sock);
    };
    sock.on("close", lepas);
    sock.on("error", lepas);
    const token = periksaJwt(new URL(req.url, "http://x").searchParams.get("access_token"));
    if (!token) {
        kirim(sock, { action: A.ERROR, error: { code: 40142, statusCode: 401, message: "token tidak sah" } });
        return sock.end(Buffer.from([0x88, 0]));
    }
    sock.kapabilitas = token.kapabilitas;
    sock.on("data", (c) => bacaBingkai(sock, c));
    kirim(sock, {
        action: A.CONNECTED,
        connectionId: sock.connectionId,
        connectionDetails: {
            connectionKey: `${sock.connectionId}!kunci`,
            clientId: token.clientId,
            maxIdleInterval: 15000,
            connectionStateTtl: 120000,
            maxMessageSize: 65536,
            serverId: "tiruan",
        },
    });
    sock.detak = setInterval(() => kirim(sock, { action: A.HEARTBEAT }), 5000);
});

peladen.listen(PORT, "127.0.0.1", () => console.log(`realtime tiruan (Ably) di :${PORT}`));

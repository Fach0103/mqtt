const net = require("net");
const Encoder = require("./Encoder");
const Decoder = require("./Decoder");

class ClienteMqtt {
  constructor(host, puerto) {
    this.host = host;
    this.puerto = puerto;
    this.socket = null;
    this.clientId = null;
    this.buffer = Buffer.alloc(0);
    this.manejadores = [];
    this.contadorPacketId = 1;
  }

  conectar(clientId) {
    this.clientId = clientId;
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.puerto, this.host);

      this.socket.once("connect", () => {
        const packet = this.construirConnect(clientId);
        this.socket.write(packet);
      });

      this.socket.on("data", (data) => this.procesarDatos(data));
      this.socket.once("error", reject);

      this.manejadores.push((paquete) => {
        if (paquete.tipo === "connack") {
          console.log(`[cliente-mqtt] ${clientId} conectado al broker`);
          resolve();
        }
      });
    });
  }

  construirConnect(clientId) {
    const protocolo = Encoder.string("MQTT");
    const nivel = Buffer.from([0x04]);
    const flags = Buffer.from([0x02]);
    const keepalive = Buffer.from([0x00, 0x3c]);
    const idCliente = Encoder.string(clientId);
    const variableHeader = Buffer.concat([
      protocolo,
      nivel,
      flags,
      keepalive,
      idCliente,
    ]);
    const fixedHeader = Buffer.concat([
      Buffer.from([0x10]),
      Encoder.longitudVariable(variableHeader.length),
    ]);
    return Buffer.concat([fixedHeader, variableHeader]);
  }

  procesarDatos(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length > 0) {
      const resultado = Decoder.intentarDecodificar(this.buffer);
      if (!resultado) return;

      this.buffer = this.buffer.slice(resultado.consumido);
      this.manejadores.forEach((cb) => cb(resultado.paquete));
    }
  }

  suscribir(canal) {
    const packetId = this.contadorPacketId++;
    const topicBuf = Encoder.string(canal);
    const qos = Buffer.from([0x00]);
    const idBuf = Buffer.alloc(2);
    idBuf.writeUInt16BE(packetId, 0);

    const variableHeader = Buffer.concat([idBuf, topicBuf, qos]);
    const fixedHeader = Buffer.concat([
      Buffer.from([0x82]),
      Encoder.longitudVariable(variableHeader.length),
    ]);
    this.socket.write(Buffer.concat([fixedHeader, variableHeader]));
    console.log(`[cliente-mqtt] ${this.clientId} suscrito a ${canal}`);
  }

  publicar(canal, payload) {
    const buffer = Encoder.publish(canal, payload);
    this.socket.write(buffer);
    console.log(`[cliente-mqtt] ${this.clientId} publico en ${canal}`);
  }

  alRecibir(callback) {
    this.manejadores.push((paquete) => {
      if (paquete.tipo === "publish") {
        callback(paquete.topic, paquete.payload);
      }
    });
  }

  desconectar() {
    if (this.socket) {
      this.socket.write(Buffer.from([0xe0, 0x00]));
      this.socket.end();
    }
  }
}

module.exports = ClienteMqtt;
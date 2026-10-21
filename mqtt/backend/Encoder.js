const { TipoPaquete } = require("./TipoPaquete");

class Encoder {
  static longitudVariable(valor) {
    const bytes = [];
    do {
      let byte = valor % 128;
      valor = Math.floor(valor / 128);
      if (valor > 0) byte = byte | 0x80;
      bytes.push(byte);
    } while (valor > 0);
    return Buffer.from(bytes);
  }

  static string(str) {
    const buf = Buffer.from(str, "utf8");
    const len = Buffer.alloc(2);
    len.writeUInt16BE(buf.length, 0);
    return Buffer.concat([len, buf]);
  }

  static connack(codigoRetorno, sesionPresente = 0) {
    const variableHeader = Buffer.from([sesionPresente, codigoRetorno]);
    const fixedHeader = Buffer.from([
      TipoPaquete.CONNACK << 4,
      variableHeader.length,
    ]);
    return Buffer.concat([fixedHeader, variableHeader]);
  }

  static publish(topic, payload, qos = 0, packetId = null, retain = false) {
    const topicBuf = this.string(topic);
    const payloadBuf = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload, "utf8");

    let variableHeader;
    if (qos > 0 && packetId !== null) {
      const idBuf = Buffer.alloc(2);
      idBuf.writeUInt16BE(packetId, 0);
      variableHeader = Buffer.concat([topicBuf, idBuf]);
    } else {
      variableHeader = topicBuf;
    }

    const remaining = Buffer.concat([variableHeader, payloadBuf]);
    const fixedHeaderByte =
      (TipoPaquete.PUBLISH << 4) | (qos << 1) | (retain ? 1 : 0);
    const fixedHeader = Buffer.concat([
      Buffer.from([fixedHeaderByte]),
      this.longitudVariable(remaining.length),
    ]);

    return Buffer.concat([fixedHeader, remaining]);
  }

  static suback(packetId, codigos) {
    const idBuf = Buffer.alloc(2);
    idBuf.writeUInt16BE(packetId, 0);
    const variableHeader = Buffer.concat([idBuf, Buffer.from(codigos)]);
    const fixedHeader = Buffer.concat([
      Buffer.from([TipoPaquete.SUBACK << 4]),
      this.longitudVariable(variableHeader.length),
    ]);
    return Buffer.concat([fixedHeader, variableHeader]);
  }

  static pingresp() {
    return Buffer.from([TipoPaquete.PINGRESP << 4, 0]);
  }
}

module.exports = Encoder;
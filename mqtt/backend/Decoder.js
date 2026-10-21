const { TipoPaquete } = require("./TipoPaquete");

class Decoder {
  static leerLongitudVariable(buffer, offset) {
    let multiplicador = 1;
    let valor = 0;
    let byte;
    let bytesLeidos = 0;

    do {
      if (offset + bytesLeidos >= buffer.length) return null;
      byte = buffer[offset + bytesLeidos];
      valor += (byte & 0x7f) * multiplicador;
      multiplicador *= 128;
      bytesLeidos++;
      if (bytesLeidos > 4) return null;
    } while ((byte & 0x80) !== 0);

    return { valor, bytesLeidos };
  }

  static leerString(buffer, offset) {
    if (offset + 2 > buffer.length) return null;
    const len = buffer.readUInt16BE(offset);
    if (offset + 2 + len > buffer.length) return null;
    const str = buffer.toString("utf8", offset + 2, offset + 2 + len);
    return { valor: str, bytesLeidos: 2 + len };
  }

  static intentarDecodificar(buffer) {
    if (buffer.length < 2) return null;

    const primerByte = buffer[0];
    const tipo = (primerByte >> 4) & 0x0f;
    const flags = primerByte & 0x0f;

    const longitud = this.leerLongitudVariable(buffer, 1);
    if (!longitud) return null;

    const totalHeader = 1 + longitud.bytesLeidos;
    if (buffer.length < totalHeader + longitud.valor) return null;

    const cuerpo = buffer.slice(totalHeader, totalHeader + longitud.valor);
    const consumido = totalHeader + longitud.valor;

    let paquete;
    switch (tipo) {
      case TipoPaquete.CONNECT:
        paquete = this.decodificarConnect(cuerpo);
        break;
      case TipoPaquete.CONNACK:
        paquete = this.decodificarConnack(cuerpo);
        break;
      case TipoPaquete.PUBLISH:
        paquete = this.decodificarPublish(cuerpo, flags);
        break;
      case TipoPaquete.SUBSCRIBE:
        paquete = this.decodificarSubscribe(cuerpo);
        break;
      case TipoPaquete.PINGREQ:
        paquete = { tipo: "pingreq" };
        break;
      case TipoPaquete.DISCONNECT:
        paquete = { tipo: "disconnect" };
        break;
      case TipoPaquete.UNSUBSCRIBE:
        paquete = this.decodificarUnsubscribe(cuerpo);
        break;
      default:
        paquete = { tipo: "desconocido", codigo: tipo };
    }

    if (!paquete) return null;
    return { paquete, consumido };
  }

  static decodificarConnect(cuerpo) {
    const protocolo = this.leerString(cuerpo, 0);
    if (!protocolo) return null;
    let offset = protocolo.bytesLeidos;

    const nivel = cuerpo[offset];
    offset += 1;

    const flags = cuerpo[offset];
    offset += 1;

    offset += 2;

    const clientId = this.leerString(cuerpo, offset);
    if (!clientId) return null;

    return {
      tipo: "connect",
      protocolo: protocolo.valor,
      nivel,
      flags,
      clientId: clientId.valor,
    };
  }

  static decodificarConnack(cuerpo) {
    if (cuerpo.length < 2) return null;
    return {
      tipo: "connack",
      sesionPresente: cuerpo[0] & 0x01,
      codigoRetorno: cuerpo[1],
    };
  }

  static decodificarPublish(cuerpo, flags) {
    const qos = (flags >> 1) & 0x03;
    const topic = this.leerString(cuerpo, 0);
    if (!topic) return null;

    let offset = topic.bytesLeidos;
    let packetId = null;

    if (qos > 0) {
      packetId = cuerpo.readUInt16BE(offset);
      offset += 2;
    }

    const payload = cuerpo.slice(offset).toString("utf8");

    return {
      tipo: "publish",
      topic: topic.valor,
      payload,
      qos,
      packetId,
    };
  }

  static decodificarSubscribe(cuerpo) {
    const packetId = cuerpo.readUInt16BE(0);
    let offset = 2;
    const suscripciones = [];

    while (offset < cuerpo.length) {
      const topic = this.leerString(cuerpo, offset);
      if (!topic) break;
      offset += topic.bytesLeidos;
      const qos = cuerpo[offset];
      offset += 1;
      suscripciones.push({ topic: topic.valor, qos });
    }

    return { tipo: "subscribe", packetId, suscripciones };
  }

  static decodificarUnsubscribe(cuerpo) {
    const packetId = cuerpo.readUInt16BE(0);
    let offset = 2;
    const topics = [];

    while (offset < cuerpo.length) {
      const topic = this.leerString(cuerpo, offset);
      if (!topic) break;
      offset += topic.bytesLeidos;
      topics.push(topic.valor);
    }

    return { tipo: "unsubscribe", packetId, topics };
  }
}

module.exports = Decoder;
const Decoder = require("./Decoder");
const Encoder = require("./Encoder");

class ConexionCliente {
  constructor(socket, broker) {
    this.socket = socket;
    this.broker = broker;
    this.clientId = null;
    this.buffer = Buffer.alloc(0);

    this.socket.on("data", (data) => this.procesarDatos(data));
    this.socket.on("close", () => this.alCerrar());
    this.socket.on("error", (err) => {
      console.error(`[broker] error socket: ${err.message}`);
    });
  }

  procesarDatos(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length > 0) {
      const resultado = Decoder.intentarDecodificar(this.buffer);
      if (!resultado) return;

      this.buffer = this.buffer.slice(resultado.consumido);
      this.manejarPaquete(resultado.paquete);
    }
  }

  manejarPaquete(paquete) {
    switch (paquete.tipo) {
      case "connect":
        this.manejarConnect(paquete);
        break;
      case "publish":
        this.manejarPublish(paquete);
        break;
      case "subscribe":
        this.manejarSubscribe(paquete);
        break;
      case "unsubscribe":
        this.manejarUnsubscribe(paquete);
        break;
      case "pingreq":
        this.socket.write(Encoder.pingresp());
        break;
      case "disconnect":
        this.socket.end();
        break;
      default:
        console.log(`[broker] paquete desconocido: ${paquete.tipo}`);
    }
  }

  manejarConnect(paquete) {
    this.clientId = paquete.clientId || `anon-${Date.now()}`;
    console.log(`[broker] CONNECT de ${this.clientId}`);
    this.socket.write(Encoder.connack(0));
    this.broker.registrarCliente(this);
  }

  manejarPublish(paquete) {
    console.log(`[broker] PUBLISH de ${this.clientId} en ${paquete.topic}`);
    this.broker.enrutarMensaje(paquete.topic, paquete.payload, this);
  }

  manejarSubscribe(paquete) {
    const codigos = [];
    paquete.suscripciones.forEach((sub) => {
      this.broker.suscribirCliente(this, sub.topic);
      codigos.push(sub.qos);
      console.log(`[broker] SUBSCRIBE de ${this.clientId} a ${sub.topic}`);
    });
    this.socket.write(Encoder.suback(paquete.packetId, codigos));
  }

  manejarUnsubscribe(paquete) {
    paquete.topics.forEach((topic) => {
      this.broker.desuscribirCliente(this, topic);
      console.log(`[broker] UNSUBSCRIBE de ${this.clientId} de ${topic}`);
    });
  }

  enviarPublicacion(topic, payload) {
    const buffer = Encoder.publish(topic, payload);
    this.socket.write(buffer);
  }

  alCerrar() {
    console.log(`[broker] cliente desconectado: ${this.clientId}`);
    this.broker.eliminarCliente(this);
  }
}

module.exports = ConexionCliente;
const net = require("net");
const ConexionCliente = require("./ConexionCliente");
const ChannelManager = require("./ChannelManager");
const Observer = require("./Observer");

class BrokerMqtt {
  constructor(puerto) {
    this.puerto = puerto;
    this.servidor = null;
    this.clientes = new Set();
    this.canales = new ChannelManager();
    this.observersPorCliente = new Map();
  }

  iniciar() {
    return new Promise((resolve, reject) => {
      this.servidor = net.createServer((socket) => {
        console.log(`[broker] nueva conexion TCP desde ${socket.remoteAddress}`);
        const cliente = new ConexionCliente(socket, this);
        this.clientes.add(cliente);
      });

      this.servidor.once("error", reject);
      this.servidor.listen(this.puerto, () => {
        console.log(`[broker] broker MQTT escuchando en puerto ${this.puerto}`);
        resolve();
      });
    });
  }

  registrarCliente(cliente) {
    console.log(`[broker] cliente registrado: ${cliente.clientId}`);
  }

  eliminarCliente(cliente) {
    this.clientes.delete(cliente);

    const observers = this.observersPorCliente.get(cliente.clientId) || [];
    observers.forEach((obs) => {
      this.canales.eliminarSuscriptor(obs.canal, obs.id);
    });
    this.observersPorCliente.delete(cliente.clientId);

    console.log(
      `[broker] cliente ${cliente.clientId} limpiado del ChannelManager`
    );
  }

  suscribirCliente(cliente, canal) {
    const observer = new Observer(
      `${cliente.clientId}@${canal}`,
      cliente,
      canal
    );

    this.canales.agregarSuscriptor(canal, observer);

    if (!this.observersPorCliente.has(cliente.clientId)) {
      this.observersPorCliente.set(cliente.clientId, []);
    }
    this.observersPorCliente.get(cliente.clientId).push(observer);
  }

  desuscribirCliente(cliente, canal) {
    const observerId = `${cliente.clientId}@${canal}`;
    this.canales.eliminarSuscriptor(canal, observerId);

    const lista = this.observersPorCliente.get(cliente.clientId) || [];
    this.observersPorCliente.set(
      cliente.clientId,
      lista.filter((obs) => obs.id !== observerId)
    );
  }

  enrutarMensaje(canal, payload, emisor) {
    let contenido;
    try {
      contenido = JSON.parse(payload);
    } catch {
      contenido = {
        id: `msg-${Date.now()}`,
        canal,
        contenido: payload,
        emisor: emisor ? emisor.clientId : "interno",
        timestamp: Date.now(),
      };
    }

    if (!contenido.canal) contenido.canal = canal;

    console.log(
      `[broker] enrutando mensaje en ${canal} desde ${contenido.emisor}`
    );
    this.canales.publicar(canal, contenido);
  }

  obtenerMapaSuscriptores() {
    return this.canales.obtenerMapaSuscriptores();
  }

  async detener() {
    if (this.servidor) {
      await new Promise((resolve) => this.servidor.close(resolve));
    }
  }
}

module.exports = BrokerMqtt;
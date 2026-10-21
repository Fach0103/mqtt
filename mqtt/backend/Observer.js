class Observer {
  constructor(id, clienteBroker, canal) {
    this.id = id;
    this.clienteBroker = clienteBroker;
    this.canal = canal;
  }

  actualizar(mensaje) {
    if (!this.clienteBroker) {
      console.warn(`[observer] ${this.id} sin cliente asociado`);
      return;
    }

    const payload =
      typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje);

    this.clienteBroker.enviarPublicacion(this.canal, payload);
    console.log(`[observer] ${this.id} recibio mensaje en ${this.canal}`);
  }
}

module.exports = Observer;
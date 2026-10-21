const Subject = require("./Subject");

class ChannelManager {
  constructor() {
    this.canales = new Map();
  }

  obtenerOCrearSubject(canal) {
    if (!this.canales.has(canal)) {
      this.canales.set(canal, new Subject(canal));
      console.log(`[canal] canal creado: ${canal}`);
    }
    return this.canales.get(canal);
  }

  obtenerSubject(canal) {
    return this.canales.get(canal);
  }

  eliminarSubject(canal) {
    if (this.canales.delete(canal)) {
      console.log(`[canal] canal eliminado: ${canal}`);
    }
  }

  agregarSuscriptor(canal, observer) {
    const subject = this.obtenerOCrearSubject(canal);
    subject.agregarObservador(observer);
  }

  eliminarSuscriptor(canal, observerId) {
    const subject = this.obtenerSubject(canal);
    if (!subject) return;
    subject.eliminarObservador(observerId);

    if (subject.cantidadObservadores() === 0) {
      this.eliminarSubject(canal);
    }
  }

  publicar(canal, mensaje) {
    const subject = this.obtenerSubject(canal);
    if (!subject) {
      console.log(`[canal] no hay canal activo para ${canal}`);
      return;
    }
    subject.notificar(mensaje);
  }

  obtenerMapaSuscriptores() {
    const mapa = {};
    this.canales.forEach((subject, canal) => {
      mapa[canal] = subject.obtenerObservadores().map((obs) => obs.id);
    });
    return mapa;
  }
}

module.exports = ChannelManager;
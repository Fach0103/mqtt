class Subject {
  constructor(canal) {
    this.canal = canal;
    this.observadores = new Map();
  }

  agregarObservador(observer) {
    if (this.observadores.has(observer.id)) return;
    this.observadores.set(observer.id, observer);
    console.log(`[subject] ${observer.id} agregado al canal ${this.canal}`);
  }

  eliminarObservador(observerId) {
    if (this.observadores.delete(observerId)) {
      console.log(`[subject] ${observerId} eliminado del canal ${this.canal}`);
    }
  }

  notificar(mensaje) {
    if (this.observadores.size === 0) {
      console.log(`[subject] canal ${this.canal} sin observadores`);
      return;
    }

    this.observadores.forEach((observer) => {
      try {
        observer.actualizar(mensaje);
      } catch (err) {
        console.error(
          `[subject] error notificando a ${observer.id}: ${err.message}`
        );
      }
    });

    console.log(
      `[subject] ${this.canal} notificado a ${this.observadores.size} observador(es)`
    );
  }

  obtenerObservadores() {
    return Array.from(this.observadores.values());
  }

  cantidadObservadores() {
    return this.observadores.size;
  }
}

module.exports = Subject;
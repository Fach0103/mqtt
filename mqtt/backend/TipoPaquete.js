const TipoPaquete = {
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  PUBREC: 5,
  PUBREL: 6,
  PUBCOMP: 7,
  SUBSCRIBE: 8,
  SUBACK: 9,
  UNSUBSCRIBE: 10,
  UNSUBACK: 11,
  PINGREQ: 12,
  PINGRESP: 13,
  DISCONNECT: 14,
};

const CodigoConnack = {
  ACEPTADO: 0,
  PROTOCOLO_RECHAZADO: 1,
  IDENTIFICADOR_RECHAZADO: 2,
  SERVIDOR_NO_DISPONIBLE: 3,
  CREDENCIALES_INVALIDAS: 4,
  NO_AUTORIZADO: 5,
};

module.exports = { TipoPaquete, CodigoConnack };
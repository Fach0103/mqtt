const express = require("express");
const http = require("http");
const os = require("os");
const { Server: SocketServer } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const BrokerMqtt = require("./BrokerMqtt");
const ClienteMqtt = require("./ClienteMqtt");

const PUERTO_HTTP = Number(process.env.PUERTO_HTTP) || 3000;
const PUERTO_MQTT = Number(process.env.PUERTO_MQTT) || 1883;

class Servidor {
  constructor() {
    this.app = express();
    this.servidorHttp = http.createServer(this.app);
    this.io = new SocketServer(this.servidorHttp, {
      cors: { origin: "*" },
    });

    this.broker = new BrokerMqtt(PUERTO_MQTT);
    this.clienteBackend = new ClienteMqtt("127.0.0.1", PUERTO_MQTT);
    this.canalesConSuscriptores = new Set();
    this.historialMensajes = new Map();
  }

  obtenerIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    Object.values(interfaces).forEach((lista) => {
      lista.forEach((iface) => {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      });
    });
    return ips;
  }

  configurarMiddlewares() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  configurarRutas() {
    this.app.get("/", (_req, res) => {
      res.json({ ok: true, mensaje: "backend mqtt activo" });
    });

    this.app.get("/info", (_req, res) => {
      res.json({
        ok: true,
        data: {
          puertoHttp: PUERTO_HTTP,
          puertoMqtt: PUERTO_MQTT,
          ips: this.obtenerIps(),
          endpoints: {
            publicar: "POST /publish",
            suscribirse: "POST /subscribe",
            suscriptores: "GET /suscriptores",
            canales: "GET /canales",
            mensajes: "GET /mensajes/:canal",
          },
        },
      });
    });

    this.app.get("/suscriptores", (_req, res) => {
      res.json(this.broker.obtenerMapaSuscriptores());
    });

    this.app.get("/canales", (_req, res) => {
      const mapa = this.broker.obtenerMapaSuscriptores();
      const canales = Object.keys(mapa).map((canal) => ({
        canal,
        suscriptores: mapa[canal],
        cantidadMensajes: (this.historialMensajes.get(canal) || []).length,
      }));
      res.json({ ok: true, data: canales });
    });

    this.app.get("/mensajes/:canal", (req, res) => {
      const canal = decodeURIComponent(req.params.canal);
      const mensajes = this.historialMensajes.get(canal) || [];
      res.json({ ok: true, canal, cantidad: mensajes.length, data: mensajes });
    });

    this.app.post("/publish", (req, res) => {
      const { canal, contenido, emisor } = req.body;

      if (!canal || !contenido || !emisor) {
        return res.status(400).json({
          ok: false,
          mensaje: "canal, contenido y emisor son obligatorios",
        });
      }

      const mensaje = {
        id: `msg-${Date.now()}`,
        canal,
        contenido,
        emisor,
        timestamp: Date.now(),
      };

      this.clienteBackend.publicar(canal, JSON.stringify(mensaje));

      res.json({
        ok: true,
        mensaje: "mensaje publicado",
        data: mensaje,
      });
    });

    this.app.post("/subscribe", (req, res) => {
      const { canal, consumidorId } = req.body;

      if (!canal || !consumidorId) {
        return res.status(400).json({
          ok: false,
          mensaje: "canal y consumidorId son obligatorios",
        });
      }

      if (!this.canalesConSuscriptores.has(canal)) {
        this.canalesConSuscriptores.add(canal);
        this.clienteBackend.suscribir(canal);
      }

      res.json({
        ok: true,
        mensaje: `consumidor ${consumidorId} suscrito a ${canal}`,
        data: { canal, consumidorId },
      });
    });
  }

  configurarSockets() {
    this.io.on("connection", (socket) => {
      console.log(`[socket] cliente conectado: ${socket.id}`);

      socket.on("suscribir", ({ canal, consumidorId }) => {
        socket.join(canal);
        console.log(
          `[socket] ${consumidorId} (${socket.id}) se unio al canal ${canal}`
        );
      });

      socket.on("disconnect", () => {
        console.log(`[socket] cliente desconectado: ${socket.id}`);
      });
    });
  }

  conectarClienteBackend() {
    this.clienteBackend.alRecibir((canal, payload) => {
      let mensaje;
      try {
        mensaje = JSON.parse(payload);
      } catch {
        mensaje = {
          id: `msg-${Date.now()}`,
          canal,
          contenido: payload,
          emisor: "desconocido",
          timestamp: Date.now(),
        };
      }

      if (!this.historialMensajes.has(canal)) {
        this.historialMensajes.set(canal, []);
      }
      const lista = this.historialMensajes.get(canal);
      lista.push(mensaje);
      if (lista.length > 50) lista.shift();

      console.log(`[puente] reenviando mensaje de ${canal} por socket.io`);
      this.io.to(canal).emit("mensaje", mensaje);
    });
  }

  async iniciar() {
    this.configurarMiddlewares();
    this.configurarRutas();
    this.configurarSockets();

    await this.broker.iniciar();
    this.conectarClienteBackend();
    await this.clienteBackend.conectar("backend-interno");

    this.servidorHttp.listen(PUERTO_HTTP, "0.0.0.0", () => {
      const ips = this.obtenerIps();
      console.log(`[http] servidor escuchando en 0.0.0.0:${PUERTO_HTTP}`);
      console.log(`[http] accesible desde:`);
      console.log(`[http]   local:    http://localhost:${PUERTO_HTTP}`);
      ips.forEach((ip) => {
        console.log(`[http]   red:      http://${ip}:${PUERTO_HTTP}`);
      });
      console.log(`[broker] mqtt escuchando en 0.0.0.0:${PUERTO_MQTT}`);
    });
  }
}

const servidor = new Servidor();
servidor.iniciar();
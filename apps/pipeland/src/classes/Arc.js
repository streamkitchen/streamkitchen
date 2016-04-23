
/**
 * Most of this file is going away.
 */

import dgram from "dgram";
import url from "url";
import munger from "mpeg-munger";
import winston from "winston";

import {SERVER_START_TIME} from "../constants";
import PortManager from "./PortManager";
import Base from "./Base";
// import UDPBuffer from "./UDPBuffer";
import SK from "../sk";
import NoSignalStream from "./NoSignalStream";

export default class Arc extends Base {
  constructor(params) {
    super(params);
    // Watch my vertex, so I can respond appropriately.
    const {id, broadcast} = params;
    this.id = id;
    this.broadcast = broadcast;

    // Set up our UDP buffer
    // this.buffer = new UDPBuffer({delay: 0});
    this.mpegStream = munger();

    // Bind all of our handlers, so that we can `.on` and `.removeListener` them with impunity
    this.handleSocketMessage = this.handleSocketMessage.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleBufferMessage = this.handleBufferMessage.bind(this);
    this.handleNoSignalMessage = this.handleNoSignalMessage.bind(this);
    this.handleBufferInfo = this.handleBufferInfo.bind(this);

    // this.buffer.on("message", this.handleBufferMessage);
    // this.buffer.on("info", this.handleBufferInfo);
    this.mpegStream.on("data", this.handleBufferMessage);

    let ptsOffset;
    let dtsOffset;
    this.mpegStream.transformPTS = (pts) => {
      if (!ptsOffset) {
        // Normalize to the server's clock
        const timeOffset = ((new Date()).getTime() - SERVER_START_TIME) * 90;
        ptsOffset = timeOffset - pts;
      }
      const outputPTS = pts + ptsOffset + (parseInt(this.doc.delay) * 90);
      return outputPTS;
    };
    this.mpegStream.transformDTS = (dts) => {
      const outputDTS = dts + ptsOffset + (parseInt(this.doc.delay) * 90);
      return outputDTS;
    };

    // Watch our arc!
    SK.arcs.watch({id: this.id})
    .then(([arc]) => {
      this.doc = arc;
      if (arc.delay !== "passthrough") {
        this.noSignalStream = new NoSignalStream({
          type: arc.type,
          delay: 2000,
        });
        this.noSignalStream.on("data", this.handleNoSignalMessage);
      }
      // this.buffer.setDelay(arc.delay);
      this.init();
    })
    .on("updated", ([arc]) => {
      if (this.doc.delay !== arc.delay) {
        // this.buffer.setDelay(arc.delay);
      }
      // If the vertices that we're connecting changed, reinit.
      const shouldReinit =
        arc.from.vertexId !== this.doc.from.vertexId ||
        arc.to.vertexId !== this.doc.to.vertexId;
      this.doc = arc;
      if (shouldReinit) {
        this.init();
      }
    })
    .on("deleted", () => {
      this.closeListener();
      this.cleanup();
    })

    .catch((err) => {
      this.error("Error on initial pull", err);
    });

    this.sendSocket = dgram.createSocket("udp4");
  }

  setupFromPipe() {
    this.closeListener();
    const {port} = url.parse(this.fromSocket);
    this.server = PortManager.createSocket(port);
    this.server.on("error", this.handleError);
    this.server.on("message", this.handleSocketMessage);
  }

  closeListener() {
    if (this.server) {
      this.server.removeListener("error", this.handleError);
      this.server.removeListener("message", this.handleSocketMessage);
      this.server.close();
      this.server = null;
    }
  }

  handleError(err) {
    this.error(err);
  }

  handleSocketMessage(msg, rinfo) {
    // If we're rewriting, pass to the rewriter. Otherwise just pass to the output.
    if (this.doc.delay === "passthrough") {
      this.sendPacket(msg);
    }
    else {
      this.mpegStream.write(msg);
    }
  }

  sendPacket(msg) {
    if (this.sendPort) {
      this.sendSocket.send(msg, 0, msg.length, this.sendPort, "127.0.0.1");
    }
  }

  handleBufferMessage(msg) {
    this.noSignalStream.write(msg);
  }

  handleNoSignalMessage(msg) {
    this.sendPacket(msg);
  }

  handleBufferInfo({size}) {
    SK.arcs.update(this.id, {size});
  }

  setupToPipe() {
    const {port} = url.parse(this.toSocket);
    this.sendPort = parseInt(port);
  }

  cleanup() {
    if (this.fromHandle) {
      this.fromHandle.stop();
    }
    if (this.toHandle) {
      this.toHandle.stop();
    }
  }

  init() {
    this.cleanup();
    this.fromHandle = SK.vertices.watch({id: this.doc.from.vertexId})
    .on("data", ([vertex]) => {
      const fromSocket = vertex.outputs[this.doc.from.output].socket;
      if (fromSocket && this.fromSocket !== fromSocket) {
        this.fromSocket = fromSocket;
        this.setupFromPipe();
      }
    })
    .catch((err) => {
      this.error(err);
    });

    this.toHandle = SK.vertices.watch({id: this.doc.to.vertexId})
    .on("data", ([vertex]) => {
      const toSocket = vertex.inputs[this.doc.to.input].socket;
      if (toSocket && this.toSocket !== toSocket) {
        this.toSocket = toSocket;
        this.setupToPipe();
      }
    })
    .catch((err) => {
      this.error(err);
    });
  }
}

Arc.create = function(params) {
  try {
    return new Arc(params);
  }
  catch (e) {
    winston.error(e);
  }
};

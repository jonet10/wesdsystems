let ioInstance = null;

export const initSocket = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true, socketId: socket.id });
  });

  return io;
};

export const emitEvent = (event, payload) => {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
};

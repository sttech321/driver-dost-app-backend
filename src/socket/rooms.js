// Socket.IO room-name helpers (single source of truth for room naming).
export const userRoom = (id) => `user:${id}`;
export const driverRoom = (id) => `driver:${id}`;
export const bookingRoom = (id) => `booking:${id}`;
export const DRIVERS = 'drivers'; // all online drivers

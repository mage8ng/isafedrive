import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');
      const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
      (client.data as { userId?: string; role?: string }).userId = payload.sub;
      (client.data as { userId?: string; role?: string }).role = payload.role;
      await client.join(`user:${payload.sub}`);
      if (payload.role === 'admin' || payload.role === 'super_admin') {
        await client.join('admins');
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  @SubscribeMessage('driver:location')
  handleDriverLocation(client: Socket, data: { latitude: number; longitude: number }) {
    const { userId } = client.data as { userId?: string };
    if (!userId) return;
    this.server.to('admins').emit('driver_location', { driverId: userId, ...data });
  }

  @SubscribeMessage('ride:subscribe')
  async subscribeToRide(client: Socket, data: { rideId: string }) {
    const { userId } = client.data as { userId?: string };
    if (!userId) return;
    await client.join(`ride:${data.rideId}`);
  }

  emitRideStatus<T extends { id: string; status: string; passenger?: { id: string }; driver?: { id: string } | null }>(
    ride: T,
  ) {
    const payload = { rideId: ride.id, status: ride.status };
    this.server.to(`ride:${ride.id}`).emit('ride_status', ride);
    if (ride.passenger?.id) {
      this.server.to(`user:${ride.passenger.id}`).emit('ride_status', payload);
    }
    if (ride.driver?.id) {
      this.server.to(`user:${ride.driver.id}`).emit('ride_status', payload);
    }
    this.server.to('admins').emit('ride_status', payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToDriver(driverId: string | null | undefined, event: string, payload: unknown) {
    if (!driverId) return;
    this.emitToUser(driverId, event, payload);
  }

  emitToPassenger(passengerId: string | null | undefined, event: string, payload: unknown) {
    if (!passengerId) return;
    this.emitToUser(passengerId, event, payload);
  }
}

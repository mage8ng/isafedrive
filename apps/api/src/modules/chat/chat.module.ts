import { Body, Controller, Get, Injectable, Module, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { ChatService } from './chat.service';
import { RidesModule } from '../rides/rides.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('rides/:id/messages')
  messages(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chatService.forRide(user, id);
  }

  @Post('rides/:id/messages')
  send(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.send(user, id, dto.text);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage]),
    RidesModule,
    RealtimeModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
